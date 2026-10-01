import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/brt";

export class SeasonError extends Error {}

/** Season acontecendo agora. Se não houver, cria a do mês (dia 1 às 00:00 até o dia 1 seguinte). */
export async function getCurrentSeason(now = new Date()) {
  const current = await prisma.season.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
  });
  if (current) return current;

  // Season automática do mês, encaixada entre as seasons que o Admin já ajustou
  const month = monthRange(now);
  const [before, after] = await Promise.all([
    prisma.season.findFirst({ where: { endsAt: { lte: now } }, orderBy: { endsAt: "desc" } }),
    prisma.season.findFirst({ where: { startsAt: { gt: now } }, orderBy: { startsAt: "asc" } }),
  ]);
  const startsAt = before && before.endsAt > month.start ? before.endsAt : month.start;
  const endsAt = after && after.startsAt < month.end ? after.startsAt : month.end;
  try {
    return await prisma.season.create({ data: { name: `Season ${month.name}`, startsAt, endsAt } });
  } catch (err) {
    // Outra requisição criou a mesma season ao mesmo tempo
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.season.findFirst({ where: { startsAt: { lte: now }, endsAt: { gt: now } } });
    }
    throw err;
  }
}

async function checkPeriod(startsAt: Date, endsAt: Date, ignoreId?: string) {
  if (!(endsAt > startsAt)) throw new SeasonError("O fim precisa ser depois do início.");
  const clash = await prisma.season.findFirst({
    where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
  });
  if (clash) throw new SeasonError(`Esse período se sobrepõe à season "${clash.name}".`);
}

async function isClosed(seasonId: string) {
  return Boolean(await prisma.rankingClosing.findUnique({ where: { kind_periodKey: { kind: "season", periodKey: seasonId } } }));
}

export async function createSeason(data: { name: string; startsAt: Date; endsAt: Date }) {
  await checkPeriod(data.startsAt, data.endsAt);
  return prisma.season.create({ data });
}

/** Ajusta nome, início ou fim. Season já encerrada (com prêmios entregues) não muda. */
export async function updateSeason(id: string, data: { name: string; startsAt: Date; endsAt: Date }) {
  const season = await prisma.season.findUnique({ where: { id } });
  if (!season) throw new SeasonError("Season não encontrada.");
  if (await isClosed(id)) throw new SeasonError("Essa season já foi encerrada e premiada.");
  if (data.endsAt <= new Date()) throw new SeasonError("O fim precisa ser no futuro.");
  await checkPeriod(data.startsAt, data.endsAt, id);
  return prisma.season.update({ where: { id }, data });
}

/** Apaga uma season que ainda não começou. */
export async function deleteSeason(id: string) {
  const season = await prisma.season.findUnique({ where: { id } });
  if (!season) throw new SeasonError("Season não encontrada.");
  if (season.startsAt <= new Date()) throw new SeasonError("Só dá para apagar uma season que ainda não começou.");
  await prisma.season.delete({ where: { id } });
}

export async function listSeasons() {
  const [seasons, closings] = await Promise.all([
    prisma.season.findMany({ orderBy: { startsAt: "desc" }, take: 24 }),
    prisma.rankingClosing.findMany({ where: { kind: "season" }, select: { periodKey: true } }),
  ]);
  const closed = new Set(closings.map((c) => c.periodKey));
  return seasons.map((s) => ({ ...s, closed: closed.has(s.id) }));
}
