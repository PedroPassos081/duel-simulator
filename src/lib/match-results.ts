import { prisma } from "@/lib/prisma";
import { addMatchXp } from "@/lib/battle-pass";
import { grantCurrency } from "@/lib/economy";
import { addClanBonus } from "@/lib/clans/service";
import { getMatchScoring } from "@/lib/site-settings";
import { VIP_GOLD_BONUS_PERCENT, isOutcome, type MatchKind } from "@/lib/match-scoring";

/** Bônus de gold por duelo dos eventos ativos agora (somados, se houver mais de um). */
export async function getActiveGoldBonus(at = new Date()) {
  const events = await prisma.goldEvent.findMany({ where: { startsAt: { lte: at }, endsAt: { gt: at } }, select: { bonusGold: true } });
  return events.reduce((sum, e) => sum + e.bonusGold, 0);
}

/** Tipo da partida: Random ou torneio (oficial/rápido). */
export function matchKind(tournament: { type: string } | null | undefined): MatchKind {
  if (!tournament) return "random";
  return tournament.type === "official" ? "official" : "quick";
}

/**
 * Fecha uma partida terminada: grava os pontos de cada jogador (tabela do Admin
 * para o tipo da partida) e paga o gold do duelo (Random ou torneio, + 30% para VIP,
 * + bônus de evento no Random).
 * Roda uma vez só por partida (Match.settledAt).
 */
export async function settleMatch(matchId: string) {
  // Reivindica o fechamento: se duas requisições chegarem juntas, só uma passa
  const { count } = await prisma.match.updateMany({
    where: { id: matchId, status: "finished", settledAt: null },
    data: { settledAt: new Date() },
  });
  if (count === 0) return null;

  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { players: true, tournament: { select: { type: true } } },
  });
  const kind = matchKind(match.tournament);
  const { points, gold, tournamentGold } = await getMatchScoring();
  const at = match.finishedAt ?? new Date();
  // Bônus de evento de gold: só no Random
  const bonus = kind === "random" ? await getActiveGoldBonus(at) : 0;
  // VIP: +30% sobre o gold do duelo
  const vips = new Set(
    (await prisma.user.findMany({ where: { id: { in: match.players.map((p) => p.userId) }, vipUntil: { gt: at } }, select: { id: true } })).map((u) => u.id)
  );

  const summary: { userId: string; result: string; points: number; gold: number }[] = [];
  for (const player of match.players) {
    if (!isOutcome(player.result)) continue;
    const earnedPoints = points[kind][player.result];
    const base = kind === "random" ? gold[player.result] : tournamentGold[player.result];
    const vipBonus = vips.has(player.userId) ? Math.round((base * VIP_GOLD_BONUS_PERCENT) / 100) : 0;
    const earnedGold = base + vipBonus + bonus;
    await prisma.matchPlayer.update({ where: { id: player.id }, data: { points: earnedPoints, goldEarned: earnedGold } });
    if (earnedGold > 0) {
      await grantCurrency(player.userId, "gold", earnedGold, `match_${player.result}`, "Match", matchId);
      await addClanBonus(player.userId, "gold", earnedGold, "match_bonus", { type: "Match", id: matchId });
    }
    // XP do Passe de Batalha (se houver passe ativo)
    await addMatchXp(player.userId, player.result).catch((err) => console.error("[battle-pass] xp", err));
    summary.push({ userId: player.userId, result: player.result, points: earnedPoints, gold: earnedGold });
  }
  return { kind, bonus, players: summary };
}
