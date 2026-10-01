import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDuelGameState, type DuelGameState } from "@/lib/duel/game-state";
import { getOcgDuelSessionSnapshot } from "@/lib/duel/ocgcore-session";
import { settleMatch } from "@/lib/match-results";
import { onBracketGameFinished } from "@/lib/brackets";

// ---------------------------------------------------------------------------
// RELÓGIO DO DUELO (tipo relógio de xadrez)
// - Cada duelista começa com 3:30. O relógio já corre no pedra-papel-tesoura.
// - Só corre o tempo de quem o jogo está esperando (turno, corrente ou decisão).
// - Passar o turno: +30s.
// - Ativar efeito / invocar monstro: +5s se agiu em até 6s, senão +3s.
// - Responder a uma corrente (ativando ou passando — quem conclui também):
//   +5s se respondeu em até 10s, senão +3s.
// - A cada 40s parado sem agir: perde mais 20s de uma vez (40s, 80s, 120s...).
// - Quem zera o tempo perde o duelo. Só o relógio vale (a corrente não tem prazo próprio).
// ---------------------------------------------------------------------------

export const CLOCK_START_MS = 210_000; // 3 min 30 s
export const TURN_BONUS_MS = 30_000;
export const SLOW_BONUS_MS = 3_000;
export const FAST_BONUS_MS = 5_000;
export const FAST_ACTION_MS = 6_000; // ativar efeito / invocar rápido
export const FAST_CHAIN_MS = 10_000; // responder corrente rápido
export const SLOW_LIMIT_MS = 40_000; // demorou isso sem agir...
export const SLOW_PENALTY_MS = 20_000; // ...perde mais isso

export interface DuelClock {
  /** Tempo de cada jogador no instante `since` (ms). */
  remaining: Record<string, number>;
  /** De quem o tempo está correndo agora (no pedra-papel-tesoura podem ser os dois). */
  running: string[];
  since: string;
}

export type ClockBonus = { userId: string; kind: "turn" | "action" | "chain"; at: number };

export function isDuelClock(value: unknown): value is DuelClock {
  const c = value as DuelClock | null;
  return Boolean(c && typeof c === "object" && c.remaining && Array.isArray(c.running) && typeof c.since === "string");
}

/** Tempo gasto numa espera: o tempo corrido e mais 20s de multa a cada 40s sem agir. */
export function spentMs(elapsed: number) {
  return elapsed + Math.floor(elapsed / SLOW_LIMIT_MS) * SLOW_PENALTY_MS;
}

/** Tempo que sobra para cada jogador agora. */
export function clockNow(clock: DuelClock, now = Date.now()) {
  const spent = spentMs(Math.max(0, now - new Date(clock.since).getTime()));
  return Object.fromEntries(
    Object.entries(clock.remaining).map(([id, ms]) => [id, clock.running.includes(id) ? Math.max(0, ms - spent) : ms])
  ) as Record<string, number>;
}

/** Quem zerou o tempo (se os dois, quem tinha menos). */
export function clockLoser(clock: DuelClock, now = Date.now()) {
  const left = clockNow(clock, now);
  const out = clock.running.filter((id) => left[id] <= 0);
  if (out.length === 0) return null;
  return out.sort((a, b) => clock.remaining[a] - clock.remaining[b])[0];
}

function bonusMs(clock: DuelClock, bonus: ClockBonus) {
  if (bonus.kind === "turn") return TURN_BONUS_MS;
  // Tempo de reação: desde que o relógio dele começou a correr até a ação
  const reaction = clock.running.includes(bonus.userId) ? bonus.at - new Date(clock.since).getTime() : Infinity;
  const fast = bonus.kind === "chain" ? FAST_CHAIN_MS : FAST_ACTION_MS;
  return reaction <= fast ? FAST_BONUS_MS : SLOW_BONUS_MS;
}

/** De quem o jogo está esperando agora. */
function actingPlayers(room: {
  id: string;
  status: string;
  rpsWinnerId: string | null;
  engineState: Prisma.JsonValue;
  players: { userId: string; rpsChoice: string | null }[];
}): string[] {
  if (room.status === "rps") return room.players.filter((p) => !p.rpsChoice).map((p) => p.userId);
  if (room.status === "choosing") return room.rpsWinnerId ? [room.rpsWinnerId] : [];
  if (room.status !== "active" || !isDuelGameState(room.engineState)) return [];
  const state = room.engineState as DuelGameState;
  if (state.winnerId) return [];
  const snapshot = getOcgDuelSessionSnapshot(room.id);
  const ids = room.players.map((p) => p.userId);
  const acting = state.chain?.awaitingPlayerId ?? snapshot?.pendingPlayerId ?? state.turnPlayerId;
  return ids.includes(acting) ? [acting] : [];
}

/**
 * Atualiza o relógio depois de qualquer mudança no duelo: desconta o tempo de
 * quem estava jogando, soma o bônus da ação e passa a contar para quem o jogo
 * espera agora. Cria o relógio na primeira vez.
 */
export async function syncClock(matchId: string, bonus?: ClockBonus) {
  return prisma.$transaction(async (tx) => {
    // Uma atualização por vez por sala
    await tx.$queryRaw`SELECT 1 FROM "Match" WHERE id = ${matchId} FOR UPDATE`;
    const room = await tx.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        rpsWinnerId: true,
        engineState: true,
        clock: true,
        players: { select: { userId: true, rpsChoice: true } },
      },
    });
    if (!room || !["rps", "choosing", "active"].includes(room.status)) return null;
    const now = bonus?.at ?? Date.now();
    let clock: DuelClock;
    if (isDuelClock(room.clock)) {
      const left = clockNow(room.clock, now);
      clock = { remaining: left, running: room.clock.running, since: room.clock.since };
      if (bonus && clock.remaining[bonus.userId] > 0) {
        clock.remaining[bonus.userId] += bonusMs(room.clock, bonus);
      }
    } else {
      clock = { remaining: Object.fromEntries(room.players.map((p) => [p.userId, CLOCK_START_MS])), running: [], since: "" };
    }
    clock.running = actingPlayers(room);
    clock.since = new Date(Math.max(now, Date.now())).toISOString();
    await tx.match.update({ where: { id: matchId }, data: { clock: clock as unknown as Prisma.InputJsonValue } });
    return clock;
  });
}

/**
 * Confere se alguém zerou o tempo; se sim, encerra o duelo (quem zerou perde).
 * Chamado a cada atualização da sala e antes de cada ação.
 */
export async function checkClockTimeout(matchId: string) {
  const room = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true, clock: true, engineState: true, players: { select: { userId: true } } },
  });
  if (!room || !["rps", "choosing", "active"].includes(room.status) || !isDuelClock(room.clock)) return null;
  const loserId = clockLoser(room.clock);
  if (!loserId) return null;
  const winnerId = room.players.find((p) => p.userId !== loserId)?.userId;
  if (!winnerId) return null;

  const state = isDuelGameState(room.engineState) ? (structuredClone(room.engineState) as DuelGameState) : null;
  if (state) state.winnerId = winnerId;
  const finalClock: DuelClock = { remaining: clockNow(room.clock), running: [], since: new Date().toISOString() };
  const done = await prisma.$transaction(async (tx) => {
    const { count } = await tx.match.updateMany({
      where: { id: matchId, status: room.status },
      data: {
        status: "finished",
        finishedAt: new Date(),
        currentPhase: "timeout",
        rpsDeadline: null,
        clock: finalClock as unknown as Prisma.InputJsonValue,
        ...(state ? { engineState: state as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    if (count === 0) return false;
    await tx.matchPlayer.updateMany({ where: { matchId, userId: winnerId }, data: { result: "win" } });
    await tx.matchPlayer.updateMany({ where: { matchId, userId: loserId }, data: { result: "loss" } });
    return true;
  });
  if (!done) return null;
  await settleMatch(matchId).catch((err) => console.error("[clock settle]", matchId, err));
  await onBracketGameFinished(matchId).catch((err) => console.error("[clock brackets]", matchId, err));
  return { loserId, winnerId };
}

/** Relógio para a tela: tempo de cada um agora e de quem está correndo. */
export function clockView(value: Prisma.JsonValue | null) {
  if (!isDuelClock(value)) return null;
  return { remaining: clockNow(value), running: value.running, serverNow: new Date().toISOString() };
}
