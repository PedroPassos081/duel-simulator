import "server-only";

import { randomBytes } from "node:crypto";
import { loadOcgCore } from "@/lib/duel/ocgcore";
import {
  readOcgCard,
  readOcgScriptSync,
  type OcgCardData,
} from "@/lib/duel/ocgcore-resources";

const MODE_MR5 = 190464n;
const PSEUDO_SHUFFLE = 16n;
const LOCATION_DECK = 1;
const LOCATION_EXTRA = 64;
const POSITION_FACEDOWN_DEFENSE = 8;
const PROCESS_END = 0;
const PROCESS_WAITING = 1;
const MESSAGE_SELECT_IDLECMD = 11;
const MESSAGE_SELECT_BATTLECMD = 10;
const MESSAGE_SELECT_PLACE = 18;
const RESPONSE_SELECT_IDLECMD = 1;
const RESPONSE_SELECT_BATTLECMD = 0;
const RESPONSE_SELECT_PLACE = 10;
const IDLE_SUMMON = 0;
const IDLE_MONSTER_SET = 3;
const IDLE_TO_END_PHASE = 7;
const IDLE_TO_BATTLE_PHASE = 6;
const BATTLE_TO_MAIN2 = 2;
const BATTLE_TO_END_PHASE = 3;
const LOCATION_MZONE = 4;

type OcgSession = {
  handle: unknown;
  players: [string, string];
  status: "waiting" | "ended";
  messages: Array<Record<string, unknown>>;
  errors: string[];
  createdAt: number;
  busy: boolean;
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

function getPendingMessage(session: OcgSession) {
  return [...session.messages]
    .reverse()
    .find(
      (message) =>
        typeof message.player === "number" &&
        typeof message.type === "number" &&
        message.type >= 10 &&
        message.type <= 26
    );
}

function cardIndex(
  message: Record<string, unknown>,
  list: string,
  cardId: number
) {
  const cards = Array.isArray(message[list])
    ? (message[list] as Array<Record<string, unknown>>)
    : [];
  return cards.findIndex((card) => card.code === cardId);
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
    // O servidor já embaralha os decks com uma fonte segura. Desabilitar o
    // segundo embaralhamento do core mantém a mão visual e a mão real iguais.
    flags: MODE_MR5 | PSEUDO_SHUFFLE,
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
    busy: false,
  };

  try {
    for (const [team, playerId] of session.players.entries()) {
      const deck = input.decks[playerId];
      for (const code of [...deck.main].reverse()) {
        await core.duelNewCard(handle, {
          team: team as 0 | 1,
          duelist: 0,
          code,
          controller: team as 0 | 1,
          location: LOCATION_DECK,
          sequence: 0,
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

export function getOcgLegalActions(matchId: string, userId: string) {
  const session = sessions.get(matchId);
  if (!session) return null;
  const pending = getPendingMessage(session);
  if (
    !pending ||
    pending.type !== MESSAGE_SELECT_IDLECMD ||
    session.players[Number(pending.player)] !== userId
  ) {
    return {};
  }

  const actions: Record<string, string[]> = {};
  const add = (list: string, action: string) => {
    const cards = Array.isArray(pending[list])
      ? (pending[list] as Array<Record<string, unknown>>)
      : [];
    for (const card of cards) {
      if (typeof card.code !== "number") continue;
      const key = String(card.code);
      actions[key] ??= [];
      if (!actions[key].includes(action)) actions[key].push(action);
    }
  };
  add("summons", "summon");
  add("monster_sets", "set_monster");
  return actions;
}

export async function performOcgMonsterAction(input: {
  matchId: string;
  userId: string;
  action: "summon" | "set_monster";
  cardId: number;
  zone: number;
}) {
  const session = sessions.get(input.matchId);
  if (!session) return null;
  if (session.busy) throw new Error("O motor já está processando outra ação.");

  const pending = getPendingMessage(session);
  if (
    !pending ||
    pending.type !== MESSAGE_SELECT_IDLECMD ||
    session.players[Number(pending.player)] !== input.userId
  ) {
    throw new Error("O OCGCore não está aguardando essa ação.");
  }

  const list = input.action === "summon" ? "summons" : "monster_sets";
  const index = cardIndex(pending, list, input.cardId);
  if (index < 0) {
    throw new Error("Essa carta não pode realizar essa ação agora.");
  }

  session.busy = true;
  try {
    const core = await loadOcgCore();
    core.duelSetResponse(session.handle, {
      type: RESPONSE_SELECT_IDLECMD,
      action: input.action === "summon" ? IDLE_SUMMON : IDLE_MONSTER_SET,
      index,
    });
    await processUntilDecision(core, session);

    const placeRequest = getPendingMessage(session);
    if (placeRequest?.type === MESSAGE_SELECT_PLACE) {
      if (session.players[Number(placeRequest.player)] !== input.userId) {
        throw new Error("O motor solicitou a zona ao jogador incorreto.");
      }
      core.duelSetResponse(session.handle, {
        type: RESPONSE_SELECT_PLACE,
        places: [
          {
            player: Number(placeRequest.player),
            location: LOCATION_MZONE,
            sequence: input.zone,
          },
        ],
      });
      await processUntilDecision(core, session);
    }

    return getOcgDuelSessionSnapshot(input.matchId);
  } finally {
    session.busy = false;
  }
}

export async function performOcgEndTurn(matchId: string, userId: string) {
  const session = sessions.get(matchId);
  if (!session) return null;
  if (session.busy) throw new Error("O motor já está processando outra ação.");

  const pending = getPendingMessage(session);
  if (!pending || session.players[Number(pending.player)] !== userId) {
    throw new Error("O OCGCore não permite terminar o turno agora.");
  }

  session.busy = true;
  try {
    const core = await loadOcgCore();
    if (pending.type === MESSAGE_SELECT_IDLECMD && pending.to_ep === true) {
      core.duelSetResponse(session.handle, {
        type: RESPONSE_SELECT_IDLECMD,
        action: IDLE_TO_END_PHASE,
        index: null,
      });
    } else if (
      pending.type === MESSAGE_SELECT_BATTLECMD &&
      pending.to_ep === true
    ) {
      core.duelSetResponse(session.handle, {
        type: RESPONSE_SELECT_BATTLECMD,
        action: BATTLE_TO_END_PHASE,
        index: null,
      });
    } else {
      throw new Error("O OCGCore não permite terminar o turno agora.");
    }
    await processUntilDecision(core, session);
    return getOcgDuelSessionSnapshot(matchId);
  } finally {
    session.busy = false;
  }
}

export async function performOcgPhaseChange(
  matchId: string,
  userId: string,
  target: "battle" | "main2"
) {
  const session = sessions.get(matchId);
  if (!session) return null;
  if (session.busy) throw new Error("O motor já está processando outra ação.");

  const pending = getPendingMessage(session);
  if (!pending || session.players[Number(pending.player)] !== userId) {
    throw new Error("O OCGCore não permite mudar para essa fase agora.");
  }

  session.busy = true;
  try {
    const core = await loadOcgCore();
    if (
      target === "battle" &&
      pending.type === MESSAGE_SELECT_IDLECMD &&
      pending.to_bp === true
    ) {
      core.duelSetResponse(session.handle, {
        type: RESPONSE_SELECT_IDLECMD,
        action: IDLE_TO_BATTLE_PHASE,
        index: null,
      });
    } else if (
      target === "main2" &&
      pending.type === MESSAGE_SELECT_BATTLECMD &&
      pending.to_m2 === true
    ) {
      core.duelSetResponse(session.handle, {
        type: RESPONSE_SELECT_BATTLECMD,
        action: BATTLE_TO_MAIN2,
        index: null,
      });
    } else {
      throw new Error("O OCGCore não permite mudar para essa fase agora.");
    }
    await processUntilDecision(core, session);
    return getOcgDuelSessionSnapshot(matchId);
  } finally {
    session.busy = false;
  }
}

export function getOcgDuelSessionSnapshot(matchId: string) {
  const session = sessions.get(matchId);
  if (!session) return null;
  const pendingMessage = getPendingMessage(session);
  return {
    active: true,
    status: session.status,
    players: session.players,
    messageCount: session.messages.length,
    pendingMessageType:
      typeof pendingMessage?.type === "number" ? pendingMessage.type : null,
    errorCount: session.errors.length,
    createdAt: new Date(session.createdAt).toISOString(),
  };
}
