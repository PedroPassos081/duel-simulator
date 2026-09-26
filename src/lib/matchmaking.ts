import { prisma } from "@/lib/prisma";
import { validateDeck, type BanlistInfo, type DeckIssue } from "@/lib/validate-deck";
import { DUEL_ROOMS, getDuelRoom, type DuelRoomId } from "@/lib/duel-rooms";

// Quem parou de consultar a fila há mais que isso (fechou a aba, caiu a
// internet) é ignorado e removido, para ninguém cair num duelo com ausente.
export const QUEUE_STALE_MS = 20_000;

// Chave do lock do Postgres que serializa a formação de duelos, evitando que
// dois jogadores entrando ao mesmo tempo "se percam" ou peguem o mesmo oponente.
const MATCHMAKING_LOCK_KEY = 7_355_608;

export class MatchmakingError extends Error {
  constructor(message: string, public issuesByRoom?: Record<string, DeckIssue[]>) {
    super(message);
  }
}

export type QueueStatus =
  | { status: "idle" }
  | { status: "waiting"; rooms: DuelRoomId[]; since: Date }
  | { status: "matched"; matchId: string };

function staleCutoff() {
  return new Date(Date.now() - QUEUE_STALE_MS);
}

export async function getEquippedDeck(userId: string) {
  return prisma.deck.findFirst({
    where: { userId, isEquipped: true },
    include: { cards: { include: { card: { select: { name: true } } } } },
  });
}

/** Valida o deck equipado do jogador contra a banlist de cada sala. */
export async function validateDeckForRooms(userId: string) {
  const deck = await getEquippedDeck(userId);
  if (!deck) return { deck: null, issuesByRoom: null };

  const [banlist, ownerships] = await Promise.all([
    prisma.banlistEntry.findMany({ where: { format: { in: DUEL_ROOMS.map((r) => r.id) } } }),
    prisma.userCardOwnership.findMany({ where: { userId } }),
  ]);
  const cardNames = new Map(deck.cards.map((c) => [c.cardId, c.card.name]));
  const entries = deck.cards.map((c) => ({
    cardId: c.cardId,
    section: c.section as "main" | "extra" | "side",
    quantity: c.quantity,
  }));

  const issuesByRoom = Object.fromEntries(
    DUEL_ROOMS.map((room) => [
      room.id,
      validateDeck(
        entries,
        banlist
          .filter((b) => b.format === room.id)
          .map((b) => ({ cardId: b.cardId, status: b.status as BanlistInfo["status"] })),
        ownerships,
        { formatLabel: `banlist da ${room.name}`, cardNames }
      ).filter((i) => i.level === "error"),
    ])
  ) as Record<DuelRoomId, DeckIssue[]>;

  return { deck, issuesByRoom };
}

async function findActiveMatchId(userId: string) {
  const player = await prisma.matchPlayer.findFirst({
    where: { userId, match: { finishedAt: null } },
    select: { matchId: true },
    orderBy: { match: { createdAt: "desc" } },
  });
  return player?.matchId ?? null;
}

/**
 * Entra na fila de uma ou mais salas. Se já houver alguém aguardando em alguma
 * delas, o duelo é criado na hora com quem está esperando há mais tempo.
 */
export async function joinQueue(userId: string, rooms: DuelRoomId[]): Promise<QueueStatus> {
  const activeMatchId = await findActiveMatchId(userId);
  if (activeMatchId) return { status: "matched", matchId: activeMatchId };

  const { deck, issuesByRoom } = await validateDeckForRooms(userId);
  if (!deck || !issuesByRoom) {
    throw new MatchmakingError("Equipe um deck no Deck Builder antes de entrar em uma sala.");
  }
  const invalidRooms = rooms.filter((r) => issuesByRoom[r].length > 0);
  if (invalidRooms.length > 0) {
    const names = invalidRooms.map((r) => getDuelRoom(r)!.name).join(" e ");
    throw new MatchmakingError(`Seu deck equipado não é válido na ${names}.`, issuesByRoom);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCHMAKING_LOCK_KEY})`;

    const cutoff = staleCutoff();
    await tx.matchQueueEntry.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });

    const opponent = await tx.matchQueueEntry.findFirst({
      where: { room: { in: rooms }, userId: { not: userId }, lastSeenAt: { gte: cutoff } },
      orderBy: { createdAt: "asc" },
    });

    if (opponent) {
      const match = await tx.match.create({
        data: {
          format: opponent.room,
          players: {
            create: [
              { userId: opponent.userId, deckId: opponent.deckId },
              { userId, deckId: deck.id },
            ],
          },
        },
      });
      // Sai de todas as salas (inclusive a outra, se estava aguardando nas duas)
      await tx.matchQueueEntry.deleteMany({ where: { userId: { in: [userId, opponent.userId] } } });
      return { status: "matched", matchId: match.id } as const;
    }

    await tx.matchQueueEntry.deleteMany({ where: { userId, room: { notIn: rooms } } });
    for (const room of rooms) {
      await tx.matchQueueEntry.upsert({
        where: { userId_room: { userId, room } },
        update: { deckId: deck.id, lastSeenAt: new Date() },
        create: { userId, room, deckId: deck.id },
      });
    }
    return { status: "waiting", rooms, since: new Date() } as const;
  });
}

/**
 * Consultado periodicamente por quem está aguardando: mantém a vaga na fila
 * e avisa quando o duelo foi encontrado.
 */
export async function getQueueStatus(userId: string): Promise<QueueStatus> {
  const activeMatchId = await findActiveMatchId(userId);
  if (activeMatchId) return { status: "matched", matchId: activeMatchId };

  await prisma.matchQueueEntry.updateMany({ where: { userId }, data: { lastSeenAt: new Date() } });
  const entries = await prisma.matchQueueEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (entries.length === 0) return { status: "idle" };

  return {
    status: "waiting",
    rooms: entries.map((e) => e.room as DuelRoomId),
    since: entries[0].createdAt,
  };
}

export async function leaveQueue(userId: string) {
  await prisma.matchQueueEntry.deleteMany({ where: { userId } });
}

/** Quantos jogadores (fora você) estão aguardando em cada sala agora. */
export async function countWaitingByRoom(userId: string) {
  const groups = await prisma.matchQueueEntry.groupBy({
    by: ["room"],
    where: { userId: { not: userId }, lastSeenAt: { gte: staleCutoff() } },
    _count: { _all: true },
  });
  return Object.fromEntries(
    DUEL_ROOMS.map((r) => [r.id, groups.find((g) => g.room === r.id)?._count._all ?? 0])
  ) as Record<DuelRoomId, number>;
}

/** Encerra o duelo (enquanto o motor de duelo não existe, é só "sair"). */
export async function leaveMatch(userId: string, matchId: string) {
  const player = await prisma.matchPlayer.findUnique({
    where: { matchId_userId: { matchId, userId } },
    include: { match: true },
  });
  if (!player) throw new MatchmakingError("Duelo não encontrado.");
  if (player.match.finishedAt) return;

  await prisma.$transaction([
    prisma.matchPlayer.update({ where: { id: player.id }, data: { result: "left" } }),
    prisma.match.update({ where: { id: matchId }, data: { finishedAt: new Date() } }),
  ]);
}
