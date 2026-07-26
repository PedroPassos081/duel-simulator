import "server-only";

import { randomBytes } from "node:crypto";
import { loadOcgCore } from "@/lib/duel/ocgcore";
import {
  readOcgCard,
  readOcgScriptSync,
  type OcgCardData,
} from "@/lib/duel/ocgcore-resources";

const MODE_MR5 = 190464n;
const LOCATION_DECK = 1;
const LOCATION_EXTRA = 64;
const POSITION_FACEDOWN_DEFENSE = 8;
const PROCESS_END = 0;
const PROCESS_WAITING = 1;

type OcgSession = {
  handle: unknown;
  players: [string, string];
  status: "waiting" | "ended";
  messages: Array<Record<string, unknown>>;
  errors: string[];
  createdAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var ocgDuelSessions: Map<string, OcgSession> | undefined;
}

const sessions = (globalThis.ocgDuelSessions ??= new Map());

function createSeed(): [bigint, bigint, bigint, bigint] {
  const bytes = randomBytes(32);
  return [0, 8, 16, 24].map((offset) =>
    bytes.readBigUInt64LE(offset)
  ) as [bigint, bigint, bigint, bigint];
}

async function loadCards(codes: number[]) {
  const cards = new Map<number, OcgCardData>();
  await Promise.all(
    [...new Set(codes)].map(async (code) => {
      const card = await readOcgCard(code);
      if (!card) {
        throw new Error(`Carta ${code} não encontrada no cards.cdb.`);
      }
      cards.set(code, card);
    })
  );
  return cards;
}

async function processUntilDecision(
  core: Awaited<ReturnType<typeof loadOcgCore>>,
  session: OcgSession
) {
  for (let step = 0; step < 1_000; step += 1) {
    const status = await core.duelProcess(session.handle);
    session.messages.push(...core.duelGetMessage(session.handle));
    if (status === PROCESS_END) {
      session.status = "ended";
      return;
    }
    if (status === PROCESS_WAITING) {
      session.status = "waiting";
      return;
    }
  }
  throw new Error("OCGCore excedeu o limite de processamento inicial.");
}

export async function createOcgDuelSession(input: {
  matchId: string;
  firstPlayerId: string;
  secondPlayerId: string;
  decks: Record<string, { main: number[]; extra: number[] }>;
}) {
  const existing = sessions.get(input.matchId);
  if (existing) return getOcgDuelSessionSnapshot(input.matchId);

  const allCodes = [
    ...input.decks[input.firstPlayerId].main,
    ...input.decks[input.firstPlayerId].extra,
    ...input.decks[input.secondPlayerId].main,
    ...input.decks[input.secondPlayerId].extra,
  ];
  const cards = await loadCards(allCodes);
  const errors: string[] = [];
  const core = await loadOcgCore();
  const handle = await core.createDuel({
    flags: MODE_MR5,
    seed: createSeed(),
    team1: {
      startingLP: 8_000,
      startingDrawCount: 5,
      drawCountPerTurn: 1,
    },
    team2: {
      startingLP: 8_000,
      startingDrawCount: 5,
      drawCountPerTurn: 1,
    },
    cardReader: (code) => cards.get(code) ?? null,
    scriptReader: readOcgScriptSync,
    errorHandler: (_type, text) => {
      errors.push(text);
      console.error(`[OCGCore:${input.matchId}] ${text}`);
    },
  });

  if (!handle) throw new Error("O OCGCore não conseguiu criar o duelo.");

  const session: OcgSession = {
    handle,
    players: [input.firstPlayerId, input.secondPlayerId],
    status: "waiting",
    messages: [],
    errors,
    createdAt: Date.now(),
  };

  try {
    for (const [team, playerId] of session.players.entries()) {
      const deck = input.decks[playerId];
      for (const code of deck.main) {
        await core.duelNewCard(handle, {
          team: team as 0 | 1,
          duelist: 0,
          code,
          controller: team as 0 | 1,
          location: LOCATION_DECK,
          sequence: 2,
          position: POSITION_FACEDOWN_DEFENSE,
        });
      }
      for (const code of deck.extra) {
        await core.duelNewCard(handle, {
          team: team as 0 | 1,
          duelist: 0,
          code,
          controller: team as 0 | 1,
          location: LOCATION_EXTRA,
          sequence: 0,
          position: POSITION_FACEDOWN_DEFENSE,
        });
      }
    }

    sessions.set(input.matchId, session);
    await core.startDuel(handle);
    await processUntilDecision(core, session);
    return getOcgDuelSessionSnapshot(input.matchId);
  } catch (error) {
    sessions.delete(input.matchId);
    core.destroyDuel(handle);
    throw error;
  }
}

export function getOcgDuelSessionSnapshot(matchId: string) {
  const session = sessions.get(matchId);
  if (!session) return null;
  const lastMessage = session.messages.at(-1);
  return {
    active: true,
    status: session.status,
    players: session.players,
    messageCount: session.messages.length,
    pendingMessageType:
      typeof lastMessage?.type === "number" ? lastMessage.type : null,
    errorCount: session.errors.length,
    createdAt: new Date(session.createdAt).toISOString(),
  };
}
