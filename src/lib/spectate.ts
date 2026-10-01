import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { isDuelGameState, type FieldCardState } from "@/lib/duel/game-state";
import { getDuelRoom } from "@/lib/duel-rooms";

// Modo espectador: qualquer jogador logado assiste aos duelos em andamento.
// Só o que é público: campo (cartas viradas para baixo ficam escondidas),
// cemitérios, banidas, pontos de vida e QUANTAS cartas há na mão/deck.

const LIVE = ["rps", "choosing", "active"];
const STAGE: Record<string, string> = { A: "Chave A", B: "Chave B", final: "Final" };

function label(m: { format: string; tournament: { name: string } | null; series: { stageKey: string } | null; gameNumber: number | null }) {
  if (m.tournament) {
    const stage = m.series ? ` · ${STAGE[m.series.stageKey] ?? m.series.stageKey} · Duelo ${m.gameNumber ?? 1}` : "";
    return { kind: "tournament" as const, text: `Torneio: ${m.tournament.name}${stage}` };
  }
  return { kind: "random" as const, text: `Random · ${getDuelRoom(m.format)?.name ?? "Sala"}` };
}

/** Duelos acontecendo agora. */
export async function listLiveDuels() {
  const matches = await prisma.match.findMany({
    where: { status: { in: LIVE } },
    orderBy: { startedAt: "desc" },
    take: 40,
    include: {
      tournament: { select: { name: true } },
      series: { select: { stageKey: true } },
      players: { include: { user: { select: { id: true, ...userAvatarSelect } } } },
    },
  });
  return matches.map((m) => {
    const state = isDuelGameState(m.engineState) ? m.engineState : null;
    return {
      id: m.id,
      ...label(m),
      status: m.status,
      turn: m.currentTurn,
      startedAt: m.startedAt?.toISOString() ?? null,
      players: m.players.map((p) => ({
        userId: p.userId,
        avatar: toAvatarProps(p.user),
        playerName: toPlayerNameProps(p.user),
        lifePoints: state?.players[p.userId]?.lifePoints ?? 8000,
      })),
    };
  });
}

/** Estado público de um duelo (sem a mão nem o deck). */
export async function getSpectatorState(matchId: string) {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { name: true } },
      series: { select: { stageKey: true, playerAId: true, winsA: true, winsB: true } },
      players: { include: { user: { select: { id: true, ...userAvatarSelect } } } },
    },
  });
  if (!m) return null;
  const state = isDuelGameState(m.engineState) ? m.engineState : null;

  // Só as cartas visíveis vão para a tela
  const visible = new Set<number>();
  const field = (cards: FieldCardState[]) =>
    cards.map((c) => {
      const faceDown = c.position.startsWith("face_down");
      if (!faceDown) visible.add(c.cardId);
      return { zone: c.zone, position: c.position, cardId: faceDown ? null : c.cardId };
    });

  const players = m.players.map((p) => {
    const s = state?.players[p.userId];
    s?.graveyard.forEach((id) => visible.add(id));
    s?.banished.forEach((id) => visible.add(id));
    return {
      userId: p.userId,
      avatar: toAvatarProps(p.user),
      playerName: toPlayerNameProps(p.user),
      lifePoints: s?.lifePoints ?? 8000,
      handCount: s?.hand.length ?? 0,
      deckCount: s?.deck.length ?? 0,
      extraCount: s?.extra.length ?? 0,
      monsters: s ? field(s.monsters) : [],
      spellTraps: s ? field(s.spellTraps) : [],
      graveyard: s?.graveyard ?? [],
      banished: s?.banished ?? [],
    };
  });

  const cards = await prisma.card.findMany({ where: { id: { in: [...visible] } }, select: { id: true, name: true, imageUrl: true, type: true } });
  const score = m.series ? { a: m.series.playerAId, winsA: m.series.winsA, winsB: m.series.winsB } : null;
  return {
    id: m.id,
    ...label(m),
    status: m.status,
    phase: m.currentPhase,
    turn: state?.turn ?? m.currentTurn,
    turnPlayerId: state?.turnPlayerId ?? null,
    winnerId: state?.winnerId ?? m.players.find((p) => p.result === "win")?.userId ?? null,
    score,
    players,
    cards: Object.fromEntries(cards.map((c) => [c.id, { name: c.name, imageUrl: c.imageUrl, type: c.type }])),
  };
}
