import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { grantCurrency } from "@/lib/economy";
import { brtDate, brtParts } from "@/lib/brt";
import { CREDIT_LABEL } from "@/lib/shop-rules";
import { addPassXp } from "@/lib/battle-pass";

// ---------------------------------------------------------------------------
// DESAFIOS DIÁRIOS (renovam à meia-noite de Brasília) e MISSÕES da conta
// (progressão: cada uma é resgatada uma vez só). Prêmios em gold/crédito.
// ---------------------------------------------------------------------------

export class ChallengeError extends Error {}

type Metric = "played" | "wins" | "clan" | "tournaments" | "cards" | "podiums" | "titles";

export interface Challenge {
  key: string;
  title: string;
  metric: Metric;
  goal: number;
  gold: number;
  cash?: number;
  xp: number; // XP do Passe de Batalha (se houver passe ativo)
}

export const DAILY: Challenge[] = [
  { xp: 150, key: "d_play5", title: "Jogue 5 duelos", metric: "played", goal: 5, gold: 50 },
  { xp: 150, key: "d_play10", title: "Jogue 10 duelos", metric: "played", goal: 10, gold: 50 },
  { xp: 250, key: "d_play20", title: "Jogue 20 duelos", metric: "played", goal: 20, gold: 100 },
  { xp: 250, key: "d_win10", title: "Consiga 10 vitórias", metric: "wins", goal: 10, gold: 150 },
  { xp: 350, key: "d_win20", title: "Consiga 20 vitórias", metric: "wins", goal: 20, gold: 250 },
];

// Extras do dia: para quem joga muito
export const DAILY_EXTRA: Challenge[] = [
  { xp: 300, key: "x_win40", title: "Consiga 40 vitórias", metric: "wins", goal: 40, gold: 250 },
  { xp: 400, key: "x_win60", title: "Consiga 60 vitórias", metric: "wins", goal: 60, gold: 450 },
  { xp: 300, key: "x_play80", title: "Jogue 80 duelos", metric: "played", goal: 80, gold: 200 },
];

export const MISSIONS: Challenge[] = [
  { xp: 300, key: "m_clan", title: "Participe de um clã", metric: "clan", goal: 1, gold: 200 },
  { xp: 300, key: "m_play10", title: "Jogue 10 duelos", metric: "played", goal: 10, gold: 150 },
  { xp: 500, key: "m_play50", title: "Jogue 50 duelos", metric: "played", goal: 50, gold: 300 },
  { xp: 800, key: "m_win100", title: "Tenha 100 vitórias", metric: "wins", goal: 100, gold: 500 },
  { xp: 800, key: "m_tour5", title: "Participe de 5 torneios ou competições", metric: "tournaments", goal: 5, gold: 500 },
  { xp: 800, key: "m_cards120", title: "Tenha 120 cartas na sua Maleta", metric: "cards", goal: 120, gold: 1500 },
  { xp: 1000, key: "m_podium1", title: "Conquiste um pódio (1º, 2º ou 3º)", metric: "podiums", goal: 1, gold: 1500, cash: 20 },
  { xp: 1500, key: "m_podium5", title: "Conquiste 5 pódios", metric: "podiums", goal: 5, gold: 2500, cash: 50 },
  { xp: 2000, key: "m_title5", title: "Conquiste 5 títulos (1º lugar)", metric: "titles", goal: 5, gold: 5000, cash: 100 },
  { xp: 2000, key: "m_win1000", title: "Tenha 1.000 vitórias", metric: "wins", goal: 1000, gold: 2000 },
];

const ALL = [...DAILY, ...DAILY_EXTRA, ...MISSIONS];
const isDaily = (key: string) => key.startsWith("d_") || key.startsWith("x_");

function today(now = new Date()) {
  const p = brtParts(now);
  return { start: brtDate(p.year, p.month, p.day), end: brtDate(p.year, p.month, p.day + 1), key: `${p.year}-${p.month + 1}-${p.day}` };
}

const rewardText = (c: Challenge) => [`${c.gold.toLocaleString("pt-BR")} gold`, c.cash ? `${c.cash} ${CREDIT_LABEL.toLowerCase()}` : null].filter(Boolean).join(" + ");

/** Números do jogador: do dia (desafios) e da conta toda (missões). */
async function stats(userId: string) {
  const day = today();
  const finished = { result: { in: ["win", "loss", "draw"] } };
  const [playedToday, winsToday, played, wins, clan, entries, comps, cards, podiums, titles] = await Promise.all([
    prisma.matchPlayer.count({ where: { userId, ...finished, match: { finishedAt: { gte: day.start, lt: day.end } } } }),
    prisma.matchPlayer.count({ where: { userId, result: "win", match: { finishedAt: { gte: day.start, lt: day.end } } } }),
    prisma.matchPlayer.count({ where: { userId, ...finished } }),
    prisma.matchPlayer.count({ where: { userId, result: "win" } }),
    prisma.clanMember.findUnique({ where: { userId }, select: { id: true } }),
    prisma.tournamentEntry.findMany({ where: { userId }, select: { tournament: { select: { name: true } } } }),
    prisma.competitionResult.findMany({ where: { userId }, select: { competition: { select: { name: true } } } }),
    prisma.userCardOwnership.aggregate({ where: { userId }, _sum: { quantity: true } }),
    prisma.trophy.count({ where: { userId, placement: { lte: 3 } } }),
    prisma.trophy.count({ where: { userId, placement: 1 } }),
  ]);
  // Torneios + competições (a competição criada pelo próprio torneio não conta duas vezes)
  const tourNames = new Set(entries.map((e) => e.tournament.name));
  const tournaments = entries.length + comps.filter((c) => !tourNames.has(c.competition.name)).length;
  return {
    daily: { played: playedToday, wins: winsToday },
    total: { played, wins, clan: clan ? 1 : 0, tournaments, cards: cards._sum.quantity ?? 0, podiums, titles },
    dayKey: day.key,
    resetsAt: day.end,
  };
}

/** Desafios do dia e missões, com progresso e o que já foi resgatado. */
export async function getChallenges(userId: string) {
  const s = await stats(userId);
  const claims = await prisma.challengeClaim.findMany({ where: { userId, OR: [{ periodKey: s.dayKey }, { periodKey: "once" }] }, select: { key: true, periodKey: true } });
  const claimed = new Set(claims.map((c) => `${c.key}:${c.periodKey}`));
  const view = (c: Challenge, value: number, period: string) => ({
    key: c.key,
    xp: c.xp,
    title: c.title,
    goal: c.goal,
    progress: Math.min(value, c.goal),
    gold: c.gold,
    cash: c.cash ?? 0,
    reward: rewardText(c),
    claimed: claimed.has(`${c.key}:${period}`),
  });
  const dailyValue = (c: Challenge) => (c.metric === "wins" ? s.daily.wins : s.daily.played);
  return {
    resetsAt: s.resetsAt.toISOString(),
    today: s.daily,
    daily: DAILY.map((c) => view(c, dailyValue(c), s.dayKey)),
    extra: DAILY_EXTRA.map((c) => view(c, dailyValue(c), s.dayKey)),
    missions: MISSIONS.map((c) => view(c, s.total[c.metric], "once")),
  };
}

/** Resgata um desafio do dia ou uma missão concluída. */
export async function claimChallenge(userId: string, key: string) {
  const c = ALL.find((x) => x.key === key);
  if (!c) throw new ChallengeError("Desafio não encontrado.");
  const s = await stats(userId);
  const daily = isDaily(key);
  const value = daily ? (c.metric === "wins" ? s.daily.wins : s.daily.played) : s.total[c.metric];
  if (value < c.goal) throw new ChallengeError("Ainda não concluído.");

  const periodKey = daily ? s.dayKey : "once";
  let claim;
  try {
    claim = await prisma.challengeClaim.create({ data: { userId, key, periodKey, summary: rewardText(c) } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ChallengeError("Você já resgatou esse prêmio.");
    throw err;
  }
  const reason = daily ? "daily_challenge" : "mission";
  await grantCurrency(userId, "gold", c.gold, reason, "ChallengeClaim", claim.id);
  // Motivo próprio: a proteção contra pagamento duplicado olha (ref + motivo)
  if (c.cash) await grantCurrency(userId, "cash", c.cash, `${reason}_credit`, "ChallengeClaim", claim.id);
  const xp = await addPassXp(userId, c.xp).catch(() => 0);
  return { message: `+${rewardText(c)}${xp ? ` e +${xp} XP do passe` : ""}! "${c.title}" resgatado.` };
}
