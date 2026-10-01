import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateDeck, type BanlistInfo, type DeckIssue } from "@/lib/validate-deck";
import { getPool, getPools, isInPool } from "@/lib/card-pools";
import { getRoomAvailability } from "@/lib/card-releases";
import { DUEL_ROOMS, getDuelRoom, isDuelRoomId, type DuelRoomId } from "@/lib/duel-rooms";

// Quem parou de consultar a fila há mais que isso (fechou a aba, caiu a
// internet) é ignorado e removido. É longo de propósito: no celular a pessoa
// troca de aplicativo enquanto espera e a tela para de consultar. Se o duelo
// sair e ela não abrir a tempo, o duelo é cancelado (ver a sala do duelo).
export const QUEUE_STALE_MS = 10 * 60_000;

// Chave do lock do Postgres que serializa a formação de duelos, evitando que
// dois jogadores entrando ao mesmo tempo "se percam" ou peguem o mesmo oponente.
const MATCHMAKING_LOCK_KEY = 7_355_608;

// O duelo do Random é o mesmo de /duel: começa no pedra-papel-tesoura (mesmo
// prazo que o lobby usa quando o segundo jogador chega) e segue em /duel/play.
// Duelo saído da fila: 45 s para o pedra-papel-tesoura, para dar tempo de voltar de outro app
const RPS_WINDOW_MS = 45_000;
const ACTIVE_MATCH_STATUSES = ["rps", "choosing", "active"];
// Uma partida só "prende" o jogador enquanto ele está na tela do duelo (ela
// atualiza lastSeenAt a cada consulta). Partida abandonada não bloqueia a fila.
const ACTIVE_MATCH_SEEN_MS = 10 * 60_000;

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
    include: { cards: { include: { card: { select: { name: true, releaseDate: true, released: true } } } } },
  });
}

/** Valida o deck equipado do jogador contra a banlist de cada sala. */
export async function validateDeckForRooms(userId: string) {
  const deck = await getEquippedDeck(userId);
  if (!deck) return { deck: null, issuesByRoom: null };

  const [banlist, ownerships, pools] = await Promise.all([
    prisma.banlistEntry.findMany({ where: { format: { in: DUEL_ROOMS.map((r) => r.id) } } }),
    prisma.userCardOwnership.findMany({ where: { userId } }),
    getPools(DUEL_ROOMS.map((r) => r.id)),
  ]);
  const cardNames = new Map(deck.cards.map((c) => [c.cardId, c.card.name]));
  const cardById = new Map(deck.cards.map((c) => [c.cardId, { id: c.cardId, releaseDate: c.card.releaseDate }]));
  const unreleased = new Set(deck.cards.filter((c) => !c.card.released).map((c) => c.cardId));
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
        { formatLabel: `banlist da ${room.name}`, cardNames, unreleased, inPool: (id) => isInPool(cardById.get(id)!, pools.get(room.id)!) }
      ).filter((i) => i.level === "error"),
    ])
  ) as Record<DuelRoomId, DeckIssue[]>;

  return { deck, issuesByRoom };
}

/** Valida o deck equipado contra uma banlist qualquer (ex.: a própria de um torneio). */
export async function validateDeckForBanlist(userId: string, format: string) {
  const deck = await getEquippedDeck(userId);
  if (!deck) return { deck: null, issues: [] as DeckIssue[], banlistName: format };
  const [banlist, ownerships, list, pool] = await Promise.all([
    prisma.banlistEntry.findMany({ where: { format } }),
    prisma.userCardOwnership.findMany({ where: { userId } }),
    prisma.banlist.findUnique({ where: { id: format }, select: { name: true } }),
    getPool(format),
  ]);
  const cardById = new Map(deck.cards.map((c) => [c.cardId, { id: c.cardId, releaseDate: c.card.releaseDate }]));
  const banlistName = list?.name ?? format;
  const issues = validateDeck(
    deck.cards.map((c) => ({ cardId: c.cardId, section: c.section as "main" | "extra" | "side", quantity: c.quantity })),
    banlist.map((b) => ({ cardId: b.cardId, status: b.status as BanlistInfo["status"] })),
    ownerships,
    {
      formatLabel: `banlist ${banlistName}`,
      cardNames: new Map(deck.cards.map((c) => [c.cardId, c.card.name])),
      unreleased: new Set(deck.cards.filter((c) => !c.card.released).map((c) => c.cardId)),
      inPool: (id) => isInPool(cardById.get(id)!, pool),
    }
  ).filter((i) => i.level === "error");
  return { deck, issues, banlistName };
}

/** Duelo em andamento (RPS, escolha de ordem ou duelo) em que o jogador ainda está. */
async function findActiveMatchId(userId: string, client: Prisma.TransactionClient = prisma) {
  const player = await client.matchPlayer.findFirst({
    where: {
      userId,
      lastSeenAt: { gte: new Date(Date.now() - ACTIVE_MATCH_SEEN_MS) },
      match: { status: { in: ACTIVE_MATCH_STATUSES }, finishedAt: null },
    },
    select: { matchId: true },
    orderBy: { match: { createdAt: "desc" } },
  });
  return player?.matchId ?? null;
}

/** Tira o jogador da fila do lobby de /duel (sala "waiting" em que ele está sozinho). */
async function leaveLobbyQueue(tx: Prisma.TransactionClient, userId: string) {
  const rooms = await tx.match.findMany({
    where: { status: "waiting", players: { some: { userId } } },
    include: { players: true },
  });
  for (const room of rooms) {
    if (room.players.length !== 1) continue;
    await tx.matchPlayer.deleteMany({ where: { matchId: room.id } });
    await tx.match.delete({ where: { id: room.id } });
  }
}

/**
 * Entra na fila de uma ou mais salas. Se já houver alguém aguardando em alguma
 * delas, o duelo é criado na hora com quem está esperando há mais tempo.
 */
export async function joinQueue(userId: string, rooms: DuelRoomId[]): Promise<QueueStatus> {
  const activeMatchId = await findActiveMatchId(userId);
  if (activeMatchId) return { status: "matched", matchId: activeMatchId };

  // Sala fechada (ex.: a Obelisco antes da data de abertura)
  const availability = await getRoomAvailability();
  const closed = rooms.filter((r) => !availability[r]?.open);
  if (closed.length > 0) {
    throw new MatchmakingError(`A ${closed.map((r) => getDuelRoom(r)!.name).join(" e ")} ainda está fechada.`);
  }

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

    const candidates = await tx.matchQueueEntry.findMany({
      where: { room: { in: rooms }, userId: { not: userId }, lastSeenAt: { gte: cutoff } },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
    // Quem já caiu num duelo (pelo lobby de /duel, por exemplo) sai da fila
    let opponent: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (await findActiveMatchId(candidate.userId, tx)) {
        await tx.matchQueueEntry.deleteMany({ where: { userId: candidate.userId } });
        continue;
      }
      opponent = candidate;
      break;
    }

    if (opponent) {
      const now = new Date();
      const match = await tx.match.create({
        data: {
          format: opponent.room,
          status: "rps",
          currentPhase: "rps",
          rpsDeadline: new Date(now.getTime() + RPS_WINDOW_MS),
          players: {
            create: [
              { userId: opponent.userId, deckId: opponent.deckId, lastSeenAt: now },
              { userId, deckId: deck.id, lastSeenAt: now },
            ],
          },
        },
      });
      // Sai de todas as salas (inclusive a outra, se estava aguardando nas duas)
      // e da fila do lobby de /duel, para não cair em dois duelos ao mesmo tempo
      await tx.matchQueueEntry.deleteMany({ where: { userId: { in: [userId, opponent.userId] } } });
      await leaveLobbyQueue(tx, userId);
      await leaveLobbyQueue(tx, opponent.userId);
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
export async function getQueueStatus(userId: string, scope: "random" | { tournamentId: string } = "random"): Promise<QueueStatus> {
  const activeMatchId = await findActiveMatchId(userId);
  if (activeMatchId) return { status: "matched", matchId: activeMatchId };

  // Cada tela só enxerga a própria fila: o Random as salas dele, o torneio a sala do torneio
  const roomFilter =
    scope === "random" ? { not: { startsWith: TOURNAMENT_ROOM_PREFIX } } : { equals: tournamentRoom(scope.tournamentId) };
  await prisma.matchQueueEntry.updateMany({ where: { userId, room: roomFilter }, data: { lastSeenAt: new Date() } });
  const entries = await prisma.matchQueueEntry.findMany({
    where: { userId, room: roomFilter },
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

// ---------------------------------------------------------------------------
// SALA DE TORNEIO: só os inscritos, só durante o torneio
// ---------------------------------------------------------------------------

const TOURNAMENT_ROOM_PREFIX = "t:";
export const tournamentRoom = (tournamentId: string) => `${TOURNAMENT_ROOM_PREFIX}${tournamentId}`;

/**
 * Entra na sala de um torneio. Se já houver outro inscrito aguardando, o duelo
 * começa na hora; ele vale os pontos do tipo do torneio (oficial ou rápido).
 */
export async function joinTournamentQueue(userId: string, tournamentId: string): Promise<QueueStatus> {
  const activeMatchId = await findActiveMatchId(userId);
  if (activeMatchId) return { status: "matched", matchId: activeMatchId };

  const now = new Date();
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { entries: { where: { userId }, select: { id: true } } },
  });
  if (!tournament || tournament.status !== "open") throw new MatchmakingError("Esse torneio não está aberto.");
  if (now < tournament.startsAt) throw new MatchmakingError("O torneio ainda não começou.");
  if (now >= tournament.endsAt) throw new MatchmakingError("O período de duelos do torneio já terminou.");
  if (tournament.entries.length === 0) throw new MatchmakingError("Inscreva-se no torneio antes de entrar na sala.");

  // Banlist do torneio: a de uma sala ou a própria dele
  const format = tournament.format;
  const { deck, issues, banlistName } = await validateDeckForBanlist(userId, format);
  if (!deck) throw new MatchmakingError("Equipe um deck no Deck Builder antes de entrar na sala.");
  if (issues.length > 0) {
    throw new MatchmakingError(`Seu deck equipado não é válido na banlist do torneio (${banlistName}): ${issues[0].message}`);
  }

  const room = tournamentRoom(tournamentId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCHMAKING_LOCK_KEY})`;
    const cutoff = staleCutoff();
    await tx.matchQueueEntry.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });

    const candidates = await tx.matchQueueEntry.findMany({
      where: { room, userId: { not: userId }, lastSeenAt: { gte: cutoff } },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
    let opponent: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (await findActiveMatchId(candidate.userId, tx)) {
        await tx.matchQueueEntry.deleteMany({ where: { userId: candidate.userId } });
        continue;
      }
      opponent = candidate;
      break;
    }

    if (opponent) {
      const at = new Date();
      const match = await tx.match.create({
        data: {
          format,
          tournamentId,
          status: "rps",
          currentPhase: "rps",
          rpsDeadline: new Date(at.getTime() + RPS_WINDOW_MS),
          players: {
            create: [
              { userId: opponent.userId, deckId: opponent.deckId, lastSeenAt: at },
              { userId, deckId: deck.id, lastSeenAt: at },
            ],
          },
        },
      });
      await tx.matchQueueEntry.deleteMany({ where: { userId: { in: [userId, opponent.userId] } } });
      await leaveLobbyQueue(tx, userId);
      await leaveLobbyQueue(tx, opponent.userId);
      return { status: "matched", matchId: match.id } as const;
    }

    // Só uma fila por vez: sai das salas do Random e entra na do torneio
    await tx.matchQueueEntry.deleteMany({ where: { userId, room: { not: room } } });
    await tx.matchQueueEntry.upsert({
      where: { userId_room: { userId, room } },
      update: { deckId: deck.id, lastSeenAt: new Date() },
      create: { userId, room, deckId: deck.id },
    });
    return { status: "waiting", rooms: [room as DuelRoomId], since: new Date() } as const;
  });
}
