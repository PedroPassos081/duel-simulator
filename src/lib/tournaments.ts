import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { createCompetitionWithResults } from "@/lib/competitions";
import { deliverReward, describeReward, type GrantPayload } from "@/lib/admin-grants";
import { MATCH_RESULT } from "@/lib/rankings";

export class TournamentError extends Error {}

export const TOURNAMENT_TYPES = {
  official: { label: "Oficial", trophy: "Torneio Oficial" },
  quick: { label: "Rápido", trophy: "Torneio Rápido" },
} as const;
export type TournamentType = keyof typeof TOURNAMENT_TYPES;

/** Prêmios de uma colocação (1º, 2º, 3º...). */
export interface PrizeTier {
  placement: number;
  rewards: GrantPayload[];
}

// Troféus da estante: até o 3º lugar
export const TROPHY_PLACES = 3;

export type TournamentPhase = "scheduled" | "running" | "ended" | "finished" | "cancelled";

/** Fase do torneio: agendado, acontecendo, período encerrado (aguardando o Admin) ou finalizado. */
export function tournamentPhase(t: { status: string; startsAt: Date; endsAt: Date }, now = new Date()): TournamentPhase {
  if (t.status === "cancelled") return "cancelled";
  if (t.status === "finished") return "finished";
  if (now < t.startsAt) return "scheduled";
  if (now < t.endsAt) return "running";
  return "ended";
}

export function parsePrizes(value: unknown): PrizeTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p) => p && Number.isInteger(p.placement) && Array.isArray(p.rewards))
    .map((p) => ({ placement: p.placement as number, rewards: p.rewards as GrantPayload[] }))
    .sort((a, b) => a.placement - b.placement);
}

interface TournamentInput {
  name: string;
  description?: string | null;
  type: TournamentType;
  format: string; // id da banlist (sala ou do próprio torneio)
  startsAt: Date;
  endsAt: Date;
  prizes: PrizeTier[];
  structure?: "points" | "bracket";
  maxEntrants?: number | null;
  clockSeconds?: number;
  stages?: { key: string; startsAt: Date }[];
}

const STAGE_LABELS: Record<string, string> = { A: "Chave A", B: "Chave B", final: "Final" };

/** Chaves: grava os horários (Chave A, B e Final) e ajusta o período do torneio. */
async function saveStages(tournamentId: string, stages: { key: string; startsAt: Date }[] | undefined) {
  if (!stages?.length) return;
  for (const st of stages) {
    await prisma.tournamentStage.upsert({
      where: { tournamentId_key: { tournamentId, key: st.key } },
      update: { startsAt: st.startsAt },
      create: { tournamentId, key: st.key, name: STAGE_LABELS[st.key] ?? st.key, startsAt: st.startsAt },
    });
  }
  const times = stages.map((st) => st.startsAt.getTime());
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { startsAt: new Date(Math.min(...times)), endsAt: new Date(Math.max(...times) + 86_400_000) },
  });
}

async function validate(input: TournamentInput) {
  if (input.name.trim().length < 3) throw new TournamentError("Dê um nome ao torneio.");
  if (!(input.endsAt > input.startsAt)) throw new TournamentError("O fim precisa ser depois do início.");
  if (!(await prisma.banlist.findUnique({ where: { id: input.format }, select: { id: true } }))) throw new TournamentError("Escolha uma banlist que exista.");
}

/** Nome da banlist de cada torneio (para a página de Torneios). */
async function banlistNames(ids: string[]) {
  const lists = await prisma.banlist.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
  return new Map(lists.map((l) => [l.id, l.name]));
}

export async function createTournament(adminId: string, input: TournamentInput) {
  await validate(input);
  const { stages, ...data } = input;
  if (data.structure === "bracket" && (stages?.length ?? 0) < 3) throw new TournamentError("Defina o dia e a hora da Chave A, da Chave B e da Final.");
  const t = await prisma.tournament.create({
    data: { ...data, name: input.name.trim(), prizes: input.prizes as never, createdById: adminId },
  });
  await saveStages(t.id, stages);
  return t;
}

/** Edita um torneio que ainda não foi finalizado (inclusive os prêmios). */
export async function updateTournament(id: string, input: TournamentInput) {
  await validate(input);
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t) throw new TournamentError("Torneio não encontrado.");
  if (t.status !== "open") throw new TournamentError("Torneio finalizado ou cancelado não pode ser editado.");
  const { stages, structure, ...data } = input;
  // O formato (pontos ou chaves) não muda depois de criado
  void structure;
  const updated = await prisma.tournament.update({ where: { id }, data: { ...data, name: input.name.trim(), prizes: input.prizes as never } });
  await saveStages(id, stages);
  return updated;
}

export async function cancelTournament(id: string) {
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t || t.status !== "open") throw new TournamentError("Só dá para cancelar um torneio aberto.");
  await prisma.matchQueueEntry.deleteMany({ where: { room: `t:${id}` } });
  return prisma.tournament.update({ where: { id }, data: { status: "cancelled" } });
}

/** Classificação: pontos dos duelos do torneio (desempate por vitórias e depois por menos derrotas). */
export async function getStandings(tournamentId: string) {
  const [entries, played] = await Promise.all([
    prisma.tournamentEntry.findMany({
      where: { tournamentId },
      include: { user: { select: { id: true, ...userAvatarSelect } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.matchPlayer.findMany({
      where: { match: { tournamentId, finishedAt: { not: null } } },
      select: { userId: true, result: true, points: true },
    }),
  ]);
  const rows = entries.map((e) => {
    const mine = played.filter((p) => p.userId === e.userId);
    return {
      userId: e.userId,
      placement: e.placement,
      avatar: toAvatarProps(e.user),
      playerName: toPlayerNameProps(e.user),
      points: mine.reduce((s, p) => s + (p.points ?? 0), 0),
      wins: mine.filter((p) => p.result === MATCH_RESULT.win).length,
      losses: mine.filter((p) => p.result === MATCH_RESULT.loss).length,
      draws: mine.filter((p) => p.result === MATCH_RESULT.draw).length,
    };
  });
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses);
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

/** Prêmios em texto, para mostrar na tela. */
async function describePrizes(prizes: PrizeTier[]) {
  return Promise.all(
    prizes.map(async (p) => ({
      placement: p.placement,
      rewards: p.rewards,
      labels: await Promise.all(p.rewards.map((r) => describeReward(r).catch(() => "Prêmio indisponível"))),
    }))
  );
}

/** Torneios para a tela dos jogadores (abertos primeiro, depois os últimos finalizados). */
export async function listTournaments(viewerId?: string | null) {
  const tournaments = await prisma.tournament.findMany({
    where: { status: { not: "cancelled" } },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
    take: 20,
    include: {
      _count: { select: { entries: true, series: true } },
      stages: { select: { key: true, name: true, startsAt: true } },
      entries: viewerId ? { where: { userId: viewerId }, select: { id: true } } : false,
    },
  });
  const names = await banlistNames(tournaments.map((t) => t.format));
  const stageOrder = ["A", "B", "final"];
  return Promise.all(
    tournaments.map(async (t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      type: t.type as TournamentType,
      format: t.format,
      banlistName: names.get(t.format) ?? t.format,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      phase: tournamentPhase(t),
      entrants: t._count.entries,
      joined: Array.isArray(t.entries) && t.entries.length > 0,
      prizes: await describePrizes(parsePrizes(t.prizes)),
      // Chaves: vagas, horários da Chave A, B e Final, se já sorteou e se está ativo/pausado
      structure: t.structure,
      maxEntrants: t.maxEntrants,
      stages: t.stages.sort((a, b) => stageOrder.indexOf(a.key) - stageOrder.indexOf(b.key)),
      drawn: t._count.series > 0,
      activated: Boolean(t.activatedAt),
      paused: Boolean(t.pausedAt),
    }))
  );
}

/** Um torneio com a classificação. */
export async function getTournament(id: string, viewerId?: string | null) {
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t) return null;
  const standings = await getStandings(id);
  const names = await banlistNames([t.format]);
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    type: t.type as TournamentType,
    structure: t.structure,
    format: t.format,
    banlistName: names.get(t.format) ?? t.format,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    status: t.status,
    phase: tournamentPhase(t),
    prizes: await describePrizes(parsePrizes(t.prizes)),
    rawPrizes: parsePrizes(t.prizes),
    standings,
    joined: Boolean(viewerId && standings.some((s) => s.userId === viewerId)),
  };
}

/** Inscrição: vale enquanto o período de duelos não terminou. */
export async function joinTournament(userId: string, id: string) {
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t || t.status !== "open") throw new TournamentError("Esse torneio não está aberto.");
  if (t.structure === "bracket") {
    // Chaves: inscrição até sortear as chaves e enquanto houver vaga
    if (await prisma.tournamentSeries.count({ where: { tournamentId: id } })) throw new TournamentError("As chaves já foram sorteadas.");
    const already = await prisma.tournamentEntry.findUnique({ where: { tournamentId_userId: { tournamentId: id, userId } } });
    if (!already && t.maxEntrants && (await prisma.tournamentEntry.count({ where: { tournamentId: id } })) >= t.maxEntrants) {
      throw new TournamentError("As vagas acabaram.");
    }
  } else if (new Date() >= t.endsAt) throw new TournamentError("As inscrições terminaram.");
  await prisma.tournamentEntry.upsert({
    where: { tournamentId_userId: { tournamentId: id, userId } },
    update: {},
    create: { tournamentId: id, userId },
  });
  return { message: `Inscrição feita no ${t.name}!` };
}

/** Sair do torneio: só antes de começar. */
export async function leaveTournament(userId: string, id: string) {
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t || t.status !== "open") throw new TournamentError("Esse torneio não está aberto.");
  if (t.structure === "bracket") {
    if (await prisma.tournamentSeries.count({ where: { tournamentId: id } })) throw new TournamentError("As chaves já foram sorteadas; não dá para sair agora.");
  } else if (new Date() >= t.startsAt) throw new TournamentError("O torneio já começou; não dá para sair agora.");
  await prisma.tournamentEntry.deleteMany({ where: { tournamentId: id, userId } });
  return { message: "Inscrição cancelada." };
}

/**
 * Encerra o torneio: define as colocações pela classificação, dá troféus até o
 * 3º lugar, entrega os prêmios de cada colocação e publica o resultado no Jornal
 * (a Competição entra no ranking de Competição).
 */
export async function finalizeTournament(adminId: string, id: string) {
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (t?.structure === "bracket") throw new TournamentError("Torneio em chaves termina sozinho quando a Final acaba.");
  if (!t || t.status !== "open") throw new TournamentError("Esse torneio já foi finalizado ou cancelado.");
  if (new Date() < t.endsAt) throw new TournamentError("Aguarde o fim do período de duelos para finalizar.");

  // Marca como finalizado primeiro: se o Admin clicar duas vezes, os prêmios não saem em dobro
  const { count } = await prisma.tournament.updateMany({ where: { id, status: "open" }, data: { status: "finished", finishedAt: new Date() } });
  if (count === 0) throw new TournamentError("Esse torneio já foi finalizado.");
  await prisma.matchQueueEntry.deleteMany({ where: { room: `t:${id}` } });

  const standings = await getStandings(id);
  const played = standings.filter((s) => s.wins + s.losses + s.draws > 0);
  const prizes = parsePrizes(t.prizes);
  const typeInfo = TOURNAMENT_TYPES[(t.type as TournamentType) ?? "quick"] ?? TOURNAMENT_TYPES.quick;
  const delivered: string[] = [];

  for (const row of played) {
    const placement = row.position;
    await prisma.tournamentEntry.update({ where: { tournamentId_userId: { tournamentId: id, userId: row.userId } }, data: { placement } });

    if (placement <= TROPHY_PLACES) {
      await prisma.trophy.create({
        data: { userId: row.userId, kind: t.type, title: t.name, placement, refType: "Tournament", refId: id },
      });
    }
    const tier = prizes.find((p) => p.placement === placement);
    for (const reward of tier?.rewards ?? []) {
      const label = await deliverReward(adminId, row.userId, reward, "prize", `${typeInfo.trophy}: ${t.name} (${placement}º)`);
      delivered.push(`${placement}º: ${label}`);
    }
  }

  // Resultado no Jornal e no ranking de Competição
  if (played.length > 0) {
    await createCompetitionWithResults(
      t.name,
      t.endsAt,
      played.map((r) => ({ userId: r.userId, placement: r.position, points: r.points })),
      `${typeInfo.trophy} · ${played.length} duelistas`
    );
  }

  return {
    message:
      played.length === 0
        ? "Torneio finalizado sem duelos: ninguém recebeu troféu ou prêmio."
        : `Torneio finalizado! ${Math.min(TROPHY_PLACES, played.length)} troféu(s) e ${delivered.length} prêmio(s) entregues. O resultado foi publicado no Jornal.`,
  };
}

/** Troféus da estante do perfil. */
export async function getTrophies(userId: string) {
  return prisma.trophy.findMany({ where: { userId }, orderBy: [{ awardedAt: "desc" }], take: 50 });
}
