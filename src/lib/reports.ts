import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { REPORT_MAX_LENGTH, REPORT_MIN_LENGTH, REPORT_REASONS, type ReportReason, type ReportStatus } from "@/lib/reports-shared";
export * from "@/lib/reports-shared";

// Limite para não virar spam: 5 denúncias por dia por jogador
const DAILY_LIMIT = 5;

export class ReportError extends Error {}

/** Denuncia um jogador pelo perfil dele. */
export async function createReport(reporterId: string, targetUsername: string, reason: ReportReason, message: string) {
  const text = message.replace(/\r\n/g, "\n").trim();
  if (text.length < REPORT_MIN_LENGTH) throw new ReportError(`Conte o que aconteceu (mínimo ${REPORT_MIN_LENGTH} caracteres).`);
  if (text.length > REPORT_MAX_LENGTH) throw new ReportError(`Máximo de ${REPORT_MAX_LENGTH} caracteres.`);

  const target = await prisma.user.findUnique({ where: { username: targetUsername.replace(/^@/, "").toLowerCase() }, select: { id: true } });
  if (!target) throw new ReportError("Jogador não encontrado.");
  if (target.id === reporterId) throw new ReportError("Você não pode denunciar a si mesmo.");

  const open = await prisma.playerReport.findFirst({ where: { reporterId, targetId: target.id, status: "open" } });
  if (open) throw new ReportError("Você já tem uma denúncia aberta contra este jogador. A equipe vai analisar.");
  const today = await prisma.playerReport.count({ where: { reporterId, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (today >= DAILY_LIMIT) throw new ReportError("Você chegou ao limite de denúncias de hoje. Tente amanhã.");

  await prisma.playerReport.create({ data: { reporterId, targetId: target.id, reason, message: text } });
}

/** Denúncias para o Admin (abertas primeiro). */
export async function listReports(status: ReportStatus) {
  const reports = await prisma.playerReport.findMany({
    where: { status },
    orderBy: { createdAt: status === "open" ? "asc" : "desc" },
    take: 100,
    include: {
      reporter: { select: { id: true, ...userAvatarSelect } },
      target: { select: { id: true, suspendedUntil: true, ...userAvatarSelect } },
    },
  });
  // Quantas denúncias abertas cada denunciado tem (ajuda a ver quem é reincidente)
  const counts = await prisma.playerReport.groupBy({
    by: ["targetId"],
    where: { status: "open", targetId: { in: [...new Set(reports.map((r) => r.targetId))] } },
    _count: { _all: true },
  });
  const openBy = new Map(counts.map((c) => [c.targetId, c._count._all]));
  const adminIds = [...new Set(reports.map((r) => r.resolvedById).filter((id): id is string => Boolean(id)))];
  const admins = await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, username: true } });

  return reports.map((r) => ({
    id: r.id,
    reason: r.reason,
    reasonLabel: REPORT_REASONS[r.reason as ReportReason] ?? r.reason,
    message: r.message,
    status: r.status,
    adminNote: r.adminNote,
    resolvedBy: admins.find((a) => a.id === r.resolvedById)?.username ?? null,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    reporter: { username: r.reporter.username, avatar: toAvatarProps(r.reporter), playerName: toPlayerNameProps(r.reporter) },
    target: {
      username: r.target.username,
      avatar: toAvatarProps(r.target),
      playerName: toPlayerNameProps(r.target),
      suspended: Boolean(r.target.suspendedUntil && r.target.suspendedUntil > new Date()),
      openReports: openBy.get(r.targetId) ?? 0,
    },
  }));
}

export async function countOpenReports() {
  return prisma.playerReport.count({ where: { status: "open" } });
}

/** Admin fecha a denúncia: resolvida (tomou providência) ou arquivada (sem motivo). */
export async function closeReport(adminId: string, id: string, status: "resolved" | "dismissed", note?: string) {
  const { count } = await prisma.playerReport.updateMany({
    where: { id, status: "open" },
    data: { status, adminNote: note?.trim() || null, resolvedById: adminId, resolvedAt: new Date() },
  });
  if (count === 0) throw new ReportError("Essa denúncia já foi fechada.");
}
