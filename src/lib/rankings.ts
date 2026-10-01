import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { brtDate, brtParts, formatBrt, weekRange } from "@/lib/brt";
import { getCurrentSeason } from "@/lib/seasons";
import { getPeriodsStatus, getWeekSchedule } from "@/lib/site-settings";

export const RANKING_CATEGORIES = [
  {
    id: "points",
    label: "Pontos",
    unit: "pontos",
    description: "Pontos dos duelos: Random, torneios oficiais e rápidos (tabela definida pelo Admin).",
  },
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
  { id: "week", label: "Semana" },
  { id: "year", label: "Ano" },
] as const;

export type RankingCategory = (typeof RANKING_CATEGORIES)[number]["id"];
export type RankingPeriod = (typeof RANKING_PERIODS)[number]["id"];

// Resultados de partida que contam no ranking (gravados pelo motor de duelo)
export const MATCH_RESULT = { win: "win", loss: "loss", draw: "draw" } as const;

const RANKING_SIZE = 100;

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PeriodInfo {
  id: RankingPeriod;
  label: string;
  range: DateRange | null;
  // Season sem nenhuma season cadastrada para hoje
  unavailable?: boolean;
  // Quando o período vira (horário de Brasília), ex.: "06/10 00:00"
  endsLabel?: string;
}

export { getCurrentSeason };

export async function resolvePeriod(period: RankingPeriod, now = new Date()): Promise<PeriodInfo> {
  if (period === "year") {
    const { year } = brtParts(now);
    return { id: period, label: String(year), range: { start: brtDate(year, 0, 1), end: brtDate(year + 1, 0, 1) } };
  }
  if (period === "week") {
    // Semana no horário de Brasília; o Admin escolhe o dia e a hora da virada (padrão: segunda 00:00)
    const [schedule, status] = await Promise.all([getWeekSchedule(), getPeriodsStatus()]);
    const range = weekRange(now, schedule);
    return {
      id: period,
      label: `Semana de ${formatBrt(range.start)} a ${formatBrt(new Date(range.end.getTime() - 1))}`,
      range,
      // "termina..." só com a disputa ligada no Admin
      endsLabel: status.enabled ? formatBrt(range.end, true) : undefined,
    };
  }
  if (period === "season") {
    const season = await getCurrentSeason(now);
    if (!season) return { id: period, label: "Nenhuma season ativa", range: null, unavailable: true };
    const { enabled } = await getPeriodsStatus();
    return { id: period, label: season.name, range: { start: season.startsAt, end: season.endsAt }, endsLabel: enabled ? formatBrt(season.endsAt, true) : undefined };
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

/** Soma dos pontos de partida de cada jogador (gravados ao fim de cada duelo). */
async function sumMatchPoints(range: DateRange | null) {
  const groups = await prisma.matchPlayer.groupBy({
    by: ["userId"],
    where: { points: { not: null }, match: { finishedAt: range ? inRange(range) : { not: null } } },
    _sum: { points: true },
  });
  return new Map(groups.map((g) => [g.userId, g._sum.points ?? 0]));
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
    case "points":
      return sumMatchPoints(range);
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
  const rows = [...values.entries()].filter(([, value]) => (category === "score" || category === "points") || value > 0);
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


// ---------------------------------------------------------------------------
// RANKING DE CLÃS
// Cada membro só conta o que fez DEPOIS de entrar no clã (joinedAt). Quem sai
// leva a própria história junto: nada fica no clã antigo nem vai para o novo.
// ---------------------------------------------------------------------------

export const CLAN_RANKING_CATEGORIES = [
  { id: "wins", label: "Vitórias", unit: "vitórias", description: "Vitórias dos membros desde que entraram no clã." },
  {
    id: "score",
    label: "Score",
    unit: "score",
    description: "Vitórias menos derrotas dos membros desde que entraram no clã.",
  },
  {
    id: "competition",
    label: "Competição",
    unit: "pontos",
    description: "Pontos dos membros em competições desde que entraram no clã.",
  },
] as const;

export type ClanRankingCategory = (typeof CLAN_RANKING_CATEGORIES)[number]["id"];

/** Valor de cada clã na categoria/período. */
async function computeClanValues(category: ClanRankingCategory, range: DateRange | null) {
  const members = await prisma.clanMember.findMany({ select: { clanId: true, userId: true, joinedAt: true } });
  const memberOf = new Map(members.map((m) => [m.userId, m]));
  const userIds = members.map((m) => m.userId);
  const values = new Map<string, number>();
  const add = (userId: string, when: Date | null, amount: number) => {
    const member = memberOf.get(userId);
    if (!member || !when || when < member.joinedAt) return;
    values.set(member.clanId, (values.get(member.clanId) ?? 0) + amount);
  };

  if (category === "competition") {
    const results = await prisma.competitionResult.findMany({
      where: { userId: { in: userIds }, ...(range && { competition: { heldAt: inRange(range) } }) },
      select: { userId: true, points: true, competition: { select: { heldAt: true } } },
    });
    for (const r of results) add(r.userId, r.competition.heldAt, r.points);
    return values;
  }

  const results = category === "wins" ? [MATCH_RESULT.win] : [MATCH_RESULT.win, MATCH_RESULT.loss];
  const played = await prisma.matchPlayer.findMany({
    where: {
      userId: { in: userIds },
      result: { in: results },
      match: { finishedAt: range ? inRange(range) : { not: null } },
    },
    select: { userId: true, result: true, match: { select: { finishedAt: true } } },
  });
  for (const p of played) add(p.userId, p.match.finishedAt, p.result === MATCH_RESULT.win ? 1 : -1);
  return values;
}

export async function getClanRanking(category: ClanRankingCategory, period: RankingPeriod, viewerClanId?: string | null) {
  const periodInfo = await resolvePeriod(period);
  if (periodInfo.unavailable) return { period: periodInfo, entries: [], viewer: null };

  const values = await computeClanValues(category, periodInfo.range);
  // Score pode ser zero ou negativo (clã que duelou); nas outras só entra quem tem algo
  const rows = [...values.entries()].filter(([, value]) => category === "score" || value > 0);
  rows.sort((a, b) => b[1] - a[1]);

  // Empates dividem a posição (1, 1, 3...)
  const positioned = rows.map(([clanId, value], i) => ({ clanId, value, position: i + 1 }));
  for (let i = 1; i < positioned.length; i++) {
    if (positioned[i].value === positioned[i - 1].value) positioned[i].position = positioned[i - 1].position;
  }

  const top = positioned.slice(0, RANKING_SIZE);
  const viewerRow = viewerClanId ? positioned.find((r) => r.clanId === viewerClanId) ?? null : null;
  const clanIds = [...new Set([...top.map((r) => r.clanId), ...(viewerRow ? [viewerRow.clanId] : [])])];
  const clans = await prisma.clan.findMany({
    where: { id: { in: clanIds } },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  const clanById = new Map(clans.map((c) => [c.id, c]));

  const toEntry = (r: (typeof positioned)[number]) => ({
    position: r.position,
    clanId: r.clanId,
    value: r.value,
    name: clanById.get(r.clanId)?.name ?? "Clã",
    memberCount: clanById.get(r.clanId)?._count.members ?? 0,
  });

  return {
    period: periodInfo,
    entries: top.map(toEntry),
    viewer: viewerRow ? toEntry(viewerRow) : null,
  };
}

// ---------------------------------------------------------------------------
// FICHA DO PERFIL: posição, pontos, score, vitórias e derrotas por período
// ---------------------------------------------------------------------------

export const PROFILE_PERIODS = ["all", "season", "week"] as const;
export type ProfilePeriod = (typeof PROFILE_PERIODS)[number];

export interface ProfileStats {
  period: ProfilePeriod;
  label: string;
  unavailable: boolean;
  position: number | null; // posição no ranking de pontos (null = ainda não pontuou)
  players: number; // quantos jogadores estão no ranking de pontos do período
  points: number;
  score: number;
  wins: number;
  losses: number;
}

/** Números do jogador em Geral, Season e Semana (a posição é no ranking de Pontos). */
export async function getPlayerStats(userId: string): Promise<ProfileStats[]> {
  return Promise.all(
    PROFILE_PERIODS.map(async (period) => {
      const info = await resolvePeriod(period);
      if (info.unavailable) {
        return { period, label: info.label, unavailable: true, position: null, players: 0, points: 0, score: 0, wins: 0, losses: 0 };
      }
      const [points, wins, losses] = await Promise.all([
        sumMatchPoints(info.range),
        countMatchResults(MATCH_RESULT.win, info.range),
        countMatchResults(MATCH_RESULT.loss, info.range),
      ]);
      // Posição: quantos têm mais pontos + 1 (empate divide a posição)
      const mine = points.get(userId);
      const position = mine == null ? null : [...points.values()].filter((v) => v > mine).length + 1;
      const w = wins.get(userId) ?? 0;
      const l = losses.get(userId) ?? 0;
      return { period, label: info.label, unavailable: false, position, players: points.size, points: mine ?? 0, score: w - l, wins: w, losses: l };
    })
  );
}

/**
 * Classificação de Pontos de um período (fechamento da Semana e da Season):
 * mais pontos; empate → mais vitórias → menos derrotas. Só entra quem somou pontos.
 */
export async function getPeriodStandings(range: DateRange) {
  const [points, wins, losses] = await Promise.all([
    sumMatchPoints(range),
    countMatchResults(MATCH_RESULT.win, range),
    countMatchResults(MATCH_RESULT.loss, range),
  ]);
  const rows = [...points.entries()]
    .filter(([, value]) => value > 0)
    .map(([userId, value]) => ({ userId, points: value, wins: wins.get(userId) ?? 0, losses: losses.get(userId) ?? 0, position: 0 }));
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.position = prev && prev.points === r.points && prev.wins === r.wins && prev.losses === r.losses ? prev.position : i + 1;
  });
  return rows;
}
