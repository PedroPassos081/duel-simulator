import { prisma } from "@/lib/prisma";
import { createPost } from "@/lib/news";
import { ART, cardArt } from "@/lib/card-art";
import { DUEL_ROOMS } from "@/lib/duel-rooms";
import { getRoomSchedules, setRoomSchedule, type RoomSchedule } from "@/lib/site-settings";

export class ReleaseError extends Error {}

const MAX_PROMO_HOURS = 24;
const MAX_PROMO_PERCENT = 50; // acima disso, comprar na promoção e vender daria lucro
const CHECK_EVERY_MS = 30_000;

// ---------------------------------------------------------------------------
// SALAS: aberta, fechada ou com data para abrir
// ---------------------------------------------------------------------------

export function isRoomOpen(schedule: RoomSchedule | undefined, now = new Date()) {
  if (!schedule) return true;
  return schedule.open || Boolean(schedule.opensAt && new Date(schedule.opensAt) <= now);
}

/** Situação de cada sala para a tela Random e para a fila. */
export async function getRoomAvailability(now = new Date()) {
  const schedules = await getRoomSchedules();
  return Object.fromEntries(
    DUEL_ROOMS.map((room) => {
      const s = schedules[room.id];
      return [room.id, { open: isRoomOpen(s, now), opensAt: s?.opensAt ?? null }];
    })
  ) as Record<string, { open: boolean; opensAt: string | null }>;
}

async function syncCalendarEvent(eventId: string | null | undefined, data: { title: string; description: string; startsAt: Date | null; type: string }) {
  if (!data.startsAt) {
    if (eventId) await prisma.calendarEvent.deleteMany({ where: { id: eventId } });
    return null;
  }
  if (eventId && (await prisma.calendarEvent.findUnique({ where: { id: eventId } }))) {
    await prisma.calendarEvent.update({ where: { id: eventId }, data: { title: data.title, description: data.description, startsAt: data.startsAt, type: data.type } });
    return eventId;
  }
  const created = await prisma.calendarEvent.create({ data: { title: data.title, description: data.description, startsAt: data.startsAt, type: data.type } });
  return created.id;
}

/** Admin abre, fecha ou agenda a abertura de uma sala (a data vai para o calendário). */
export async function scheduleRoom(adminId: string, roomId: string, input: { open: boolean; opensAt: Date | null }) {
  const room = DUEL_ROOMS.find((r) => r.id === roomId);
  if (!room) throw new ReleaseError("Sala não encontrada.");
  const current = (await getRoomSchedules())[roomId];
  const opensAt = input.open ? null : input.opensAt;
  const calendarEventId = await syncCalendarEvent(current?.calendarEventId, {
    title: `${room.name} abre!`,
    description: `A ${room.name} (${room.level}) abre as portas: ${room.description}`,
    startsAt: opensAt,
    type: "update",
  });
  await setRoomSchedule(roomId, { open: input.open, opensAt: opensAt?.toISOString() ?? null, calendarEventId }, adminId);
}

// ---------------------------------------------------------------------------
// LANÇAMENTOS DE CARTAS
// ---------------------------------------------------------------------------

export interface ReleaseInput {
  name: string;
  description?: string | null;
  releaseAt: Date | null;
  promoPercent: number;
  promoHours: number;
}

function validateRelease(input: ReleaseInput) {
  if (input.name.trim().length < 3) throw new ReleaseError("Dê um nome ao lançamento.");
  if (input.promoPercent < 0 || input.promoPercent > MAX_PROMO_PERCENT) throw new ReleaseError(`A promoção vai de 0% a ${MAX_PROMO_PERCENT}%.`);
  if (input.promoHours < 0 || input.promoHours > MAX_PROMO_HOURS) throw new ReleaseError(`A promoção dura no máximo ${MAX_PROMO_HOURS} horas.`);
}

const promoText = (r: { promoPercent: number; promoHours: number }) =>
  r.promoPercent > 0 && r.promoHours > 0 ? ` Promoção de ${r.promoPercent}% nas cartas do lançamento nas primeiras ${r.promoHours}h!` : "";

async function syncReleaseCalendar(release: { id: string; name: string; description: string | null; releaseAt: Date | null; promoPercent: number; promoHours: number; calendarEventId: string | null }) {
  const eventId = await syncCalendarEvent(release.calendarEventId, {
    title: `Lançamento: ${release.name}`,
    description: `${release.description ?? "Novas cartas chegam à loja."}${promoText(release)}`,
    startsAt: release.releaseAt,
    type: "event",
  });
  if (eventId !== release.calendarEventId) await prisma.cardRelease.update({ where: { id: release.id }, data: { calendarEventId: eventId } });
}

export async function createRelease(input: ReleaseInput) {
  validateRelease(input);
  const release = await prisma.cardRelease.create({
    data: { name: input.name.trim(), description: input.description?.trim() || null, releaseAt: input.releaseAt, promoPercent: input.promoPercent, promoHours: input.promoHours },
  });
  await syncReleaseCalendar(release);
  return release;
}

export async function updateRelease(id: string, input: ReleaseInput) {
  validateRelease(input);
  const current = await prisma.cardRelease.findUnique({ where: { id } });
  if (!current) throw new ReleaseError("Lançamento não encontrado.");
  if (current.releasedAt && input.releaseAt?.getTime() !== current.releaseAt?.getTime()) throw new ReleaseError("Esse lançamento já aconteceu: a data não muda mais.");
  const release = await prisma.cardRelease.update({
    where: { id },
    data: { name: input.name.trim(), description: input.description?.trim() || null, releaseAt: input.releaseAt, promoPercent: input.promoPercent, promoHours: input.promoHours },
  });
  await syncReleaseCalendar(release);
  return release;
}

/** Apaga um lançamento que ainda não aconteceu. As cartas continuam não lançadas (sem data). */
export async function deleteRelease(id: string) {
  const release = await prisma.cardRelease.findUnique({ where: { id } });
  if (!release) throw new ReleaseError("Lançamento não encontrado.");
  if (release.releasedAt) throw new ReleaseError("Esse lançamento já aconteceu.");
  await prisma.card.updateMany({ where: { releaseId: id }, data: { releaseId: null } });
  if (release.calendarEventId) await prisma.calendarEvent.deleteMany({ where: { id: release.calendarEventId } });
  await prisma.cardRelease.delete({ where: { id } });
}

/** Coloca cartas não lançadas num lançamento (ou tira, com releaseId null). */
export async function assignCards(cardIds: number[], releaseId: string | null) {
  if (releaseId) {
    const release = await prisma.cardRelease.findUnique({ where: { id: releaseId } });
    if (!release || release.releasedAt) throw new ReleaseError("Escolha um lançamento que ainda não aconteceu.");
  }
  const { count } = await prisma.card.updateMany({ where: { id: { in: cardIds }, released: false }, data: { releaseId } });
  return count;
}

/** Lança cartas na hora (entram na loja e nos decks). */
export async function releaseCardsNow(cardIds: number[]) {
  const { count } = await prisma.card.updateMany({ where: { id: { in: cardIds }, released: false }, data: { released: true, siteAddedAt: new Date() } });
  return count;
}

/** Faz o lançamento: as cartas entram na loja e sai um anúncio no Jornal. Roda uma vez só. */
async function runRelease(id: string, at: Date) {
  const { count } = await prisma.cardRelease.updateMany({ where: { id, releasedAt: null }, data: { releasedAt: at } });
  if (count === 0) return false;
  const release = await prisma.cardRelease.findUniqueOrThrow({ where: { id }, include: { cards: { select: { id: true, name: true } } } });
  await prisma.card.updateMany({ where: { releaseId: id }, data: { released: true, siteAddedAt: at } });

  const names = release.cards.map((c) => `• ${c.name}`).join("\n");
  const post = await createPost({
    type: "notice",
    title: `Chegou: ${release.name}!`,
    summary: `${release.cards.length} cartas novas já estão na loja.${promoText(release)}`,
    content: [
      `Duelistas, o lançamento "${release.name}" chegou!`,
      release.description ?? "",
      promoText(release).trim() ? `🔥 ${promoText(release).trim()} Corra para a loja!` : "Corra para a loja e monte o seu deck!",
      `Cartas do lançamento:\n${names}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    imageUrl: cardArt(ART.ultimateDragon),
    pinned: true,
  });
  await prisma.cardRelease.update({ where: { id }, data: { newsPostId: post.id } });
  return true;
}

/** Admin lança agora, sem esperar a data. */
export async function releaseNow(id: string) {
  const release = await prisma.cardRelease.findUnique({ where: { id } });
  if (!release) throw new ReleaseError("Lançamento não encontrado.");
  const now = new Date();
  // A promoção conta a partir de agora
  await prisma.cardRelease.update({ where: { id }, data: { releaseAt: now } });
  if (!(await runRelease(id, now))) throw new ReleaseError("Esse lançamento já aconteceu.");
  await syncReleaseCalendar({ ...release, releaseAt: now });
}

let lastCheck = 0;
let running: Promise<void> | null = null;

/** Lança o que chegou na data (checa no máximo a cada 30 s; chamado pela loja, Random, calendário e Jornal). */
export function processDueReleases() {
  if (running) return running;
  if (Date.now() - lastCheck < CHECK_EVERY_MS) return Promise.resolve();
  lastCheck = Date.now();
  running = (async () => {
    try {
      const due = await prisma.cardRelease.findMany({ where: { releasedAt: null, releaseAt: { lte: new Date() } }, select: { id: true, releaseAt: true } });
      for (const r of due) await runRelease(r.id, r.releaseAt!);
    } catch (err) {
      console.error("[card-releases]", err);
    } finally {
      running = null;
    }
  })();
  return running;
}

export interface Promo {
  percent: number;
  endsAt: string;
  releaseName: string;
}

/** Cartas em promoção agora (primeiras horas de um lançamento). */
export async function getActivePromos(now = new Date()): Promise<Map<number, Promo>> {
  const since = new Date(now.getTime() - MAX_PROMO_HOURS * 3_600_000);
  const releases = await prisma.cardRelease.findMany({
    where: { releasedAt: { not: null, gte: since }, promoPercent: { gt: 0 }, promoHours: { gt: 0 } },
    include: { cards: { select: { id: true } } },
  });
  const promos = new Map<number, Promo>();
  for (const r of releases) {
    const endsAt = new Date(r.releasedAt!.getTime() + r.promoHours * 3_600_000);
    if (endsAt <= now) continue;
    for (const c of r.cards) promos.set(c.id, { percent: r.promoPercent, endsAt: endsAt.toISOString(), releaseName: r.name });
  }
  return promos;
}

/** Preço com o desconto da promoção (arredonda para cima; nunca abaixo de 1). */
export function promoPrice(price: number | null, promo: Promo | undefined) {
  if (price == null || !promo) return price;
  return Math.max(1, Math.ceil((price * (100 - promo.percent)) / 100));
}

// ---------------------------------------------------------------------------
// ADMIN: lançamentos e cartas não lançadas
// ---------------------------------------------------------------------------

export async function listReleases() {
  const releases = await prisma.cardRelease.findMany({ orderBy: [{ releasedAt: "asc" }, { releaseAt: "asc" }, { createdAt: "asc" }], include: { _count: { select: { cards: true } } } });
  return releases.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    releaseAt: r.releaseAt?.toISOString() ?? null,
    releasedAt: r.releasedAt?.toISOString() ?? null,
    promoPercent: r.promoPercent,
    promoHours: r.promoHours,
    cards: r._count.cards,
  }));
}

export async function listUnreleasedCards() {
  const cards = await prisma.card.findMany({
    where: { released: false },
    select: { id: true, name: true, type: true, imageUrl: true, releaseDate: true, releaseId: true },
    orderBy: { name: "asc" },
  });
  return cards.map((c) => ({ ...c, releaseDate: c.releaseDate?.toISOString() ?? null }));
}
