import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";

export const RANKING_CATEGORIES = [
  { id: "cards", label: "Cartas", unit: "cartas", description: "Quem possui mais cartas." },
  { id: "wins", label: "Vitórias", unit: "vitórias", description: "Quem venceu mais duelos." },
  {
    id: "score",
    label: "Score",
    unit: "score",
    description: "Saldo de vitórias menos derrotas (venceu 4 e perdeu 2 = score 2).",
  },
  {
    id: "competition",
    label: "Competição",
    unit: "pontos",
    description: "Pontos somados em competições.",
  },
] as const;

export const RANKING_PERIODS = [
  { id: "all", label: "Geral" },
  { id: "season", label: "Season" },
  { id: "year", label: "Ano" },
] as const;

export type RankingCategory = (typeof RANKING_CATEGORIES)[number]["id"];
export type RankingPeriod = (typeof RANKING_PERIODS)[number]["id"];

// Resultados de partida que contam no ranking (gravados pelo motor de duelo)
export const MATCH_RESULT = { win: "win", loss: "loss", draw: "draw" } as const;

const RANKING_SIZE = 100;

interface DateRange {
  start: Date;
  end: Date;
}

export interface PeriodInfo {
  id: RankingPeriod;
  label: string;
  range: DateRange | null;
  // Season sem nenhuma season cadastrada para hoje
  unavailable?: boolean;
}

export async function getCurrentSeason(now = new Date()) {
  return prisma.season.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
  });
}

export async function resolvePeriod(period: RankingPeriod, now = new Date()): Promise<PeriodInfo> {
  if (period === "year") {
    const year = now.getFullYear();
    return {
      id: period,
      label: String(year),
      range: { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) },
    };
  }
  if (period === "season") {
    const season = await getCurrentSeason(now);
    if (!season) return { id: period, label: "Nenhuma season ativa", range: null, unavailable: true };
    return { id: period, label: season.name, range: { start: season.startsAt, end: season.endsAt } };
  }
  return { id: period, label: "Todos os tempos", range: null };
}

function inRange(range: DateRange | null) {
  return range ? { gte: range.start, lt: range.end } : undefined;
}

async function countMatchResults(result: string, range: DateRange | null) {
  const groups = await prisma.matchPlayer.groupBy({
    by: ["userId"],
    where: { result, match: { finishedAt: range ? inRange(range) : { not: null } } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.userId, g._count._all]));
}

/** Valor de cada jogador na categoria/período. Só entra quem tem algo para mostrar. */
async function computeValues(category: RankingCategory, range: DateRange | null) {
  switch (category) {
    case "cards": {
      // Geral: tudo o que o jogador possui. Season/Ano: cartas adquiridas no período.
      if (!range) {
        const groups = await prisma.userCardOwnership.groupBy({
          by: ["userId"],
          _sum: { quantity: true },
        });
        return new Map(groups.map((g) => [g.userId, g._sum.quantity ?? 0]));
      }
      const groups = await prisma.purchase.groupBy({
        by: ["userId"],
        where: { createdAt: inRange(range) },
        _count: { _all: true },
      });
      return new Map(groups.map((g) => [g.userId, g._count._all]));
    }
    case "wins":
      return countMatchResults(MATCH_RESULT.win, range);
    case "score": {
      const [wins, losses] = await Promise.all([
        countMatchResults(MATCH_RESULT.win, range),
        countMatchResults(MATCH_RESULT.loss, range),
      ]);
      const values = new Map<string, number>();
      for (const userId of new Set([...wins.keys(), ...losses.keys()])) {
        values.set(userId, (wins.get(userId) ?? 0) - (losses.get(userId) ?? 0));
      }
      return values;
    }
    case "competition": {
      const groups = await prisma.competitionResult.groupBy({
        by: ["userId"],
        where: range ? { competition: { heldAt: inRange(range) } } : undefined,
        _sum: { points: true },
      });
      return new Map(groups.map((g) => [g.userId, g._sum.points ?? 0]));
    }
  }
}

export async function getRanking(category: RankingCategory, period: RankingPeriod, viewerId?: string | null) {
  const periodInfo = await resolvePeriod(period);
  if (periodInfo.unavailable) return { period: periodInfo, entries: [], viewer: null };

  const values = await computeValues(category, periodInfo.range);
  // Score pode ser zero ou negativo; nas outras categorias só entra quem tem algo
  const rows = [...values.entries()].filter(([, value]) => category === "score" || value > 0);
  rows.sort((a, b) => b[1] - a[1]);

  // Empates dividem a posição (1, 1, 3...)
  const positioned = rows.map(([userId, value], i) => ({ userId, value, position: 0, index: i }));
  for (const row of positioned) {
    row.position = row.index > 0 && positioned[row.index - 1].value === row.value
      ? positioned[row.index - 1].position
      : row.index + 1;
  }

  const top = positioned.slice(0, RANKING_SIZE);
  const viewerRow = viewerId ? positioned.find((r) => r.userId === viewerId) ?? null : null;
  const userIds = [...new Set([...top.map((r) => r.userId), ...(viewerRow ? [viewerRow.userId] : [])])];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, ...userAvatarSelect },
  });
  const avatarById = new Map(users.map((u) => [u.id, toAvatarProps(u)]));
  const nameById = new Map(users.map((u) => [u.id, toPlayerNameProps(u)]));

  const toEntry = (r: (typeof positioned)[number]) => ({
    position: r.position,
    userId: r.userId,
    value: r.value,
    avatar: avatarById.get(r.userId) ?? { image: null, name: null, frameUrl: null },
    playerName: nameById.get(r.userId) ?? { name: null, effect: null },
  });

  return {
    period: periodInfo,
    entries: top.map(toEntry),
    viewer: viewerRow ? toEntry(viewerRow) : null,
  };
}
