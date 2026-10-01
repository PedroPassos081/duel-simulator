import { prisma } from "@/lib/prisma";
import { createPost } from "@/lib/news";
import { ART, cardArt } from "@/lib/card-art";
import { BAN_STATUS_INFO, isBanStatus, type BanStatus } from "@/lib/banlist-shared";

export class BanlistError extends Error {}

// Transações com várias consultas: margem para a latência do banco
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

const ORDER: BanStatus[] = ["forbidden", "limited", "semi-limited", "unlimited"];

/** Banlists do jogo (salas primeiro) com quantas cartas cada uma tem. */
export async function listBanlists() {
  const [lists, counts] = await Promise.all([
    prisma.banlist.findMany({ orderBy: [{ kind: "asc" }, { createdAt: "asc" }] }),
    prisma.banlistEntry.groupBy({ by: ["format", "status"], _count: { _all: true } }),
  ]);
  const pending = await prisma.banlistChange.groupBy({ by: ["format"], where: { announcedAt: null }, _count: { _all: true } });
  return lists.map((b) => ({
    id: b.id,
    name: b.name,
    kind: b.kind,
    description: b.description,
    counts: Object.fromEntries(ORDER.slice(0, 3).map((s) => [s, counts.find((c) => c.format === b.id && c.status === s)?._count._all ?? 0])) as Record<BanStatus, number>,
    pendingChanges: pending.find((p) => p.format === b.id)?._count._all ?? 0,
  }));
}

export async function banlistExists(id: string) {
  return Boolean(await prisma.banlist.findUnique({ where: { id }, select: { id: true } }));
}

/** Cartas de uma banlist, com nome e imagem. */
export async function getBanlistEntries(format: string) {
  if (!(await banlistExists(format))) throw new BanlistError("Banlist não encontrada.");
  const entries = await prisma.banlistEntry.findMany({
    where: { format },
    include: { card: { select: { id: true, name: true, imageUrl: true, type: true } } },
    orderBy: { card: { name: "asc" } },
  });
  return entries.map((e) => ({ cardId: e.cardId, status: e.status as BanStatus, name: e.card.name, imageUrl: e.card.imageUrl, type: e.card.type }));
}

/**
 * Muda o status de uma carta numa banlist ("unlimited" tira da lista) e anota a
 * mudança para o próximo anúncio. Voltar ao status anunciado desfaz a anotação.
 */
export async function setCardStatus(adminId: string, format: string, cardId: number, status: BanStatus) {
  if (!(await banlistExists(format))) throw new BanlistError("Banlist não encontrada.");
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { name: true } });
  if (!card) throw new BanlistError("Carta não encontrada.");

  const current = await prisma.banlistEntry.findUnique({ where: { cardId_format: { cardId, format } } });
  const from = (isBanStatus(current?.status) ? current!.status : "unlimited") as BanStatus;
  if (from === status) return { changed: false, name: card.name };

  await prisma.$transaction(async (tx) => {
    if (status === "unlimited") await tx.banlistEntry.delete({ where: { cardId_format: { cardId, format } } });
    else
      await tx.banlistEntry.upsert({
        where: { cardId_format: { cardId, format } },
        update: { status },
        create: { cardId, format, status },
      });

    // Uma anotação pendente por carta: guarda de onde veio (o último status anunciado)
    const pending = await tx.banlistChange.findFirst({ where: { format, cardId, announcedAt: null } });
    if (!pending) await tx.banlistChange.create({ data: { format, cardId, fromStatus: from, toStatus: status, adminId } });
    else if (pending.fromStatus === status) await tx.banlistChange.delete({ where: { id: pending.id } });
    else await tx.banlistChange.update({ where: { id: pending.id }, data: { toStatus: status, adminId } });
  }, TX_OPTIONS);
  return { changed: true, name: card.name };
}

const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Nova banlist (ex.: de um torneio), vazia ou copiando outra. */
export async function createBanlist(data: { name: string; description?: string | null; copyFrom?: string | null }) {
  const name = data.name.trim();
  if (name.length < 3) throw new BanlistError("Dê um nome à banlist.");
  let id = slugify(name) || "banlist";
  for (let i = 2; await banlistExists(id); i++) id = `${slugify(name)}-${i}`;
  if (data.copyFrom && !(await banlistExists(data.copyFrom))) throw new BanlistError("Banlist de origem não encontrada.");

  await prisma.$transaction(async (tx) => {
    await tx.banlist.create({ data: { id, name, kind: "tournament", description: data.description?.trim() || null } });
    if (data.copyFrom) {
      const source = await tx.banlistEntry.findMany({ where: { format: data.copyFrom } });
      if (source.length) await tx.banlistEntry.createMany({ data: source.map((e) => ({ cardId: e.cardId, format: id, status: e.status })) });
    }
  }, TX_OPTIONS);
  return id;
}

/** Apaga uma banlist de torneio que nenhum torneio aberto usa. As das salas não saem. */
export async function deleteBanlist(id: string) {
  const list = await prisma.banlist.findUnique({ where: { id } });
  if (!list) throw new BanlistError("Banlist não encontrada.");
  if (list.kind === "room") throw new BanlistError("As banlists das salas não podem ser apagadas.");
  const inUse = await prisma.tournament.findFirst({ where: { format: id, status: "open" }, select: { name: true } });
  if (inUse) throw new BanlistError(`O torneio "${inUse.name}" usa essa banlist.`);
  await prisma.$transaction([
    prisma.banlistEntry.deleteMany({ where: { format: id } }),
    prisma.banlistChange.deleteMany({ where: { format: id } }),
    prisma.banlist.delete({ where: { id } }),
  ]);
}

// ---------------------------------------------------------------------------
// ANÚNCIO NO JORNAL
// ---------------------------------------------------------------------------

async function pendingChanges(format: string) {
  const changes = await prisma.banlistChange.findMany({ where: { format, announcedAt: null }, orderBy: { createdAt: "asc" } });
  const cards = await prisma.card.findMany({ where: { id: { in: changes.map((c) => c.cardId) } }, select: { id: true, name: true } });
  return changes.map((c) => ({
    id: c.id,
    cardId: c.cardId,
    name: cards.find((x) => x.id === c.cardId)?.name ?? `#${c.cardId}`,
    from: c.fromStatus as BanStatus,
    to: c.toStatus as BanStatus,
  }));
}

export async function getPendingChanges(format: string) {
  return pendingChanges(format);
}

const bullet = (names: string[]) => names.map((n) => `• ${n}`).join("\n");

/**
 * Texto pronto do anúncio: as mudanças desde o último anúncio (ou a lista
 * completa, se não houver mudança anotada ou se o Admin pedir).
 */
export async function buildBanlistAnnouncement(format: string, full = false) {
  const list = await prisma.banlist.findUnique({ where: { id: format } });
  if (!list) throw new BanlistError("Banlist não encontrada.");
  const changes = await pendingChanges(format);
  const useFull = full || changes.length === 0;
  const where = list.kind === "room" ? `na ${list.name}` : `do ${list.name}`;
  const sections: string[] = [];

  if (useFull) {
    const entries = await getBanlistEntries(format);
    for (const status of ORDER.slice(0, 3)) {
      const names = entries.filter((e) => e.status === status).map((e) => e.name);
      if (names.length) sections.push(`${BAN_STATUS_INFO[status].label.toUpperCase()}S (${BAN_STATUS_INFO[status].copies} ${BAN_STATUS_INFO[status].copies === 1 ? "cópia" : "cópias"})\n${bullet(names)}`);
    }
  } else {
    const group = (label: string, filter: (c: (typeof changes)[number]) => boolean, detail = false) => {
      const items = changes.filter(filter);
      if (items.length)
        sections.push(`${label}\n${bullet(items.map((c) => (detail ? `${c.name} (${BAN_STATUS_INFO[c.from].label} → ${BAN_STATUS_INFO[c.to].label})` : c.name)))}`);
    };
    group("⛔ AGORA PROIBIDAS", (c) => c.to === "forbidden");
    group("🔒 LIMITADAS A 1", (c) => c.to === "limited");
    group("⚠️ SEMI-LIMITADAS (2)", (c) => c.to === "semi-limited");
    group("✅ LIBERADAS", (c) => c.to === "unlimited", true);
  }

  const title = useFull ? `Banlist oficial ${where}` : `Nova banlist ${where}!`;
  const summary = useFull
    ? `Confira todas as cartas proibidas e limitadas ${where}.`
    : `${changes.length} ${changes.length === 1 ? "carta mudou" : "cartas mudaram"} ${where}. Hora de revisar o seu deck!`;
  const intro = useFull
    ? `Duelistas, esta é a lista que vale ${where}. Monte o seu deck respeitando as cópias de cada carta: o deck só entra na fila se estiver dentro da banlist.`
    : `Duelistas, as areias do deserto se moveram! O conselho do Faraó revisou a banlist ${where} e as mudanças já estão valendo.`;
  const outro = useFull
    ? "Bons duelos, e que o coração das cartas esteja com você!"
    : "Confira o seu deck no Deck Builder antes de entrar na fila: deck fora da banlist não entra. Que o coração das cartas esteja com você!";

  return { title, summary, content: [intro, ...sections, outro].join("\n\n"), pendingCount: changes.length, full: useFull };
}

/** Publica o anúncio (fixado no Jornal) e marca as mudanças como anunciadas. */
export async function publishBanlistAnnouncement(adminId: string, format: string, text: { title: string; summary?: string; content: string }) {
  if (!(await banlistExists(format))) throw new BanlistError("Banlist não encontrada.");
  if (text.title.trim().length < 3 || text.content.trim().length < 10) throw new BanlistError("Escreva um título e um texto para o anúncio.");
  const post = await createPost({
    type: "notice",
    title: text.title.trim(),
    summary: text.summary?.trim() || null,
    content: text.content.trim(),
    imageUrl: cardArt(ART.exodia),
    pinned: true,
    authorId: adminId,
  });
  await prisma.banlistChange.updateMany({ where: { format, announcedAt: null }, data: { announcedAt: new Date() } });
  return post;
}
