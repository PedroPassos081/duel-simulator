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
const MESSAGE_SELECT_CHAIN = 16;
const MESSAGE_SELECT_PLACE = 18;
const MESSAGE_SELECT_EFFECT_YN = 12;
const MESSAGE_SELECT_YES_NO = 13;
const MESSAGE_SELECT_OPTION = 14;
const MESSAGE_SELECT_CARD = 15;
const MESSAGE_SELECT_POSITION = 19;
const MESSAGE_SELECT_TRIBUTE = 20;
const MESSAGE_WIN = 5;
const MESSAGE_NEW_TURN = 40;
const MESSAGE_NEW_PHASE = 41;
const RESPONSE_SELECT_IDLECMD = 1;
const RESPONSE_SELECT_BATTLECMD = 0;
const RESPONSE_SELECT_CHAIN = 8;
const RESPONSE_SELECT_PLACE = 10;
const RESPONSE_SELECT_EFFECT_YN = 2;
const RESPONSE_SELECT_YES_NO = 3;
const RESPONSE_SELECT_OPTION = 4;
const RESPONSE_SELECT_CARD = 5;
const RESPONSE_SELECT_POSITION = 11;
const RESPONSE_SELECT_TRIBUTE = 12;
const IDLE_SUMMON = 0;
const IDLE_SPECIAL_SUMMON = 1;
const IDLE_MONSTER_SET = 3;
const IDLE_SPELL_SET = 4;
const IDLE_ACTIVATE = 5;
const IDLE_TO_END_PHASE = 7;
const IDLE_TO_BATTLE_PHASE = 6;
const BATTLE_TO_MAIN2 = 2;
const BATTLE_TO_END_PHASE = 3;
const BATTLE_ATTACK = 1;
const LOCATION_MZONE = 4;
const LOCATION_SZONE = 8;
const LOCATION_FZONE = 256;
const MESSAGE_MOVE = 50;
const MESSAGE_POS_CHANGE = 53;
const MESSAGE_DRAW = 90;
const MESSAGE_DAMAGE = 91;
const MESSAGE_RECOVER = 92;
const MESSAGE_LP_UPDATE = 94;

type OcgSession = {
  handle: unknown;
  players: [string, string];
  status: "waiting" | "ended";
  messages: Array<Record<string, unknown>>;
  errors: string[];
  createdAt: number;
  busy: boolean;
  pendingMessage: Record<string, unknown> | null;
  selectingBattleTarget: boolean;
};

export type OcgStateEvent =
  | { type: "draw"; playerId: string; cards: number[] }
  | {
      type: "move";
      cardId: number;
      from: {
        playerId: string;
        location: number;
        sequence: number;
        position: number;
      };
      to: {
        playerId: string;
        location: number;
        sequence: number;
        position: number;
      };
    }
  | {
      type: "position";
      playerId: string;
      cardId: number;
      location: number;
      sequence: number;
      position: number;
    }
  | {
      type: "life_points";
      playerId: string;
      value: number;
      absolute: boolean;
    }
  | { type: "turn"; playerId: string }
  | { type: "phase"; phase: number }
  | { type: "win"; playerId: string; reason: number };

export type OcgPendingDecision =
  | {
      type: "yes_no";
      source: "effect" | "generic";
      cardId?: number;
      description: string;
    }
  | { type: "option"; options: string[] }
  | {
      type: "cards" | "tributes" | "battle_targets";
      min: number;
      max: number;
      canCancel: boolean;
      candidates: Array<{
        index: number;
        cardId: number;
        controllerId: string;
        location: number;
        sequence: number;
      }>;
    }
  | { type: "position"; cardId: number; positions: number[] }
  | {
      type: "place";
      count: number;
      places: Array<{
        index: number;
        controllerId: string;
        location: number;
        sequence: number;
      }>;
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
  session: OcgSession,
  autoPassOptionalChain = true,
  preserveOptionalChainForUserId?: string
) {
  for (let step = 0; step < 1_000; step += 1) {
    const status = await core.duelProcess(session.handle);
    const messages = core.duelGetMessage(session.handle);
    session.messages.push(...messages);
    if (status === PROCESS_END) {
      session.status = "ended";
      session.pendingMessage = null;
      return;
    }
    if (status === PROCESS_WAITING) {
      const pending = [...messages]
        .reverse()
        .find(
          (message) =>
            typeof message.player === "number" &&
            typeof message.type === "number" &&
            message.type >= 10 &&
            message.type <= 26
        ) ?? null;
      session.pendingMessage = pending;
      if (
        pending?.type === MESSAGE_SELECT_CHAIN &&
        pending.forced !== true &&
        (autoPassOptionalChain ||
          (preserveOptionalChainForUserId !== undefined &&
            session.players[Number(pending.player)] !==
              preserveOptionalChainForUserId))
      ) {
        core.duelSetResponse(session.handle, {
          type: RESPONSE_SELECT_CHAIN,
          index: null,
        });
        continue;
      }
      session.status = "waiting";
      return;
    }
  }
  throw new Error("OCGCore excedeu o limite de processamento inicial.");
}

function getPendingMessage(session: OcgSession) {
  return session.pendingMessage;
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

function stateEventsSince(session: OcgSession, start: number): OcgStateEvent[] {
  const events: OcgStateEvent[] = [];
  for (const message of session.messages.slice(start)) {
    if (message.type === MESSAGE_DRAW && typeof message.player === "number") {
      const drawn = Array.isArray(message.drawn)
        ? (message.drawn as Array<Record<string, unknown>>)
        : [];
      events.push({
        type: "draw",
        playerId: session.players[message.player],
        cards: drawn
          .map((card) => card.code)
          .filter((code): code is number => typeof code === "number"),
      });
    }
    if (
      message.type === MESSAGE_MOVE &&
      typeof message.card === "number" &&
      message.from &&
      message.to
    ) {
      const from = message.from as Record<string, unknown>;
      const to = message.to as Record<string, unknown>;
      if (
        typeof from.controller === "number" &&
        typeof from.location === "number" &&
        typeof from.sequence === "number" &&
        typeof from.position === "number" &&
        typeof to.controller === "number" &&
        typeof to.location === "number" &&
        typeof to.sequence === "number" &&
        typeof to.position === "number"
      ) {
        events.push({
          type: "move",
          cardId: message.card,
          from: {
            playerId: session.players[from.controller],
            location: from.location,
            sequence: from.sequence,
            position: from.position,
          },
          to: {
            playerId: session.players[to.controller],
            location: to.location,
            sequence: to.sequence,
            position: to.position,
          },
        });
      }
    }
    if (
      message.type === MESSAGE_POS_CHANGE &&
      typeof message.code === "number" &&
      typeof message.controller === "number" &&
      typeof message.location === "number" &&
      typeof message.sequence === "number" &&
      typeof message.position === "number"
    ) {
      events.push({
        type: "position",
        playerId: session.players[message.controller],
        cardId: message.code,
        location: message.location,
        sequence: message.sequence,
        position: message.position,
      });
    }
    if (
      (message.type === MESSAGE_DAMAGE ||
        message.type === MESSAGE_RECOVER ||
        message.type === MESSAGE_LP_UPDATE) &&
      typeof message.player === "number"
    ) {
      const playerId = session.players[message.player];
      if (message.type === MESSAGE_LP_UPDATE && typeof message.lp === "number") {
        events.push({
          type: "life_points",
          playerId,
          value: message.lp,
          absolute: true,
        });
      } else if (typeof message.amount === "number") {
        events.push({
          type: "life_points",
          playerId,
          value:
            message.type === MESSAGE_DAMAGE ? -message.amount : message.amount,
          absolute: false,
        });
      }
    }
    if (message.type === MESSAGE_NEW_TURN && typeof message.player === "number") {
      events.push({ type: "turn", playerId: session.players[message.player] });
    }
    if (message.type === MESSAGE_NEW_PHASE && typeof message.phase === "number") {
      events.push({ type: "phase", phase: message.phase });
    }
    if (
      message.type === MESSAGE_WIN &&
      typeof message.player === "number" &&
      typeof message.reason === "number"
    ) {
      events.push({
        type: "win",
        playerId: session.players[message.player],
        reason: message.reason,
      });
    }
  }
  return events;
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

  for (const name of ["constant.lua", "utility.lua"]) {
    const content = readOcgScriptSync(name);
    if (!content || !(await core.loadScript(handle, name, content))) {
      core.destroyDuel(handle);
      throw new Error(`O OCGCore não conseguiu carregar ${name}.`);
    }
  }

  const session: OcgSession = {
    handle,
    players: [input.firstPlayerId, input.secondPlayerId],
    status: "waiting",
    messages: [],
    errors,
    createdAt: Date.now(),
    busy: false,
    pendingMessage: null,
    selectingBattleTarget: false,
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
  if (!pending || session.players[Number(pending.player)] !== userId) {
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
  if (pending.type === MESSAGE_SELECT_IDLECMD) {
    add("summons", "summon");
    add("special_summons", "special_summon");
    add("monster_sets", "set_monster");
    add("spell_sets", "set_spell_trap");
    add("activates", "activate");
    add("pos_changes", "change_position");
  } else if (pending.type === MESSAGE_SELECT_BATTLECMD) {
    add("attacks", "attack");
    add("chains", "activate");
  } else if (pending.type === MESSAGE_SELECT_CHAIN) {
    add("selects", "activate");
  }
  return actions;
}

export function getOcgAttackableMonsters(matchId: string, userId: string) {
  const session = sessions.get(matchId);
  const pending = session ? getPendingMessage(session) : null;
  if (
    !session ||
    !pending ||
    pending.type !== MESSAGE_SELECT_BATTLECMD ||
    session.players[Number(pending.player)] !== userId
  ) {
    return [];
  }
  const controller = session.players.indexOf(userId);
  const attacks = Array.isArray(pending.attacks)
    ? (pending.attacks as Array<Record<string, unknown>>)
    : [];
  return attacks.flatMap((card) =>
    typeof card.code === "number" &&
    card.controller === controller &&
    card.location === LOCATION_MZONE &&
    typeof card.sequence === "number"
      ? [{
          cardId: card.code,
          zone: card.sequence,
          canDirect: card.can_direct === true,
        }]
      : []
  );
}

function pendingPlaces(
  session: OcgSession,
  message: Record<string, unknown>
) {
  if (typeof message.field_mask !== "number") return [];
  const places: Array<{
    index: number;
    controllerId: string;
    location: number;
    sequence: number;
  }> = [];
  for (let controller = 0; controller < 2; controller += 1) {
    const controllerOffset = controller * 16;
    for (const [location, start, zones] of [
      [LOCATION_MZONE, 0, 7],
      [LOCATION_SZONE, 8, 8],
    ] as const) {
      for (let sequence = 0; sequence < zones; sequence += 1) {
        const bit = controllerOffset + start + sequence;
        if ((message.field_mask & 2 ** bit) !== 0) continue;
        places.push({
          index: places.length,
          controllerId: session.players[controller],
          location,
          sequence,
        });
      }
    }
  }
  return places;
}

function pendingCards(message: Record<string, unknown>) {
  const cards = Array.isArray(message.selects)
    ? (message.selects as Array<Record<string, unknown>>)
    : [];
  return cards.flatMap((card, index) => {
    if (
      typeof card.code !== "number" ||
      typeof card.controller !== "number" ||
      typeof card.location !== "number" ||
      typeof card.sequence !== "number"
    ) {
      return [];
    }
    return [{
      index,
      cardId: card.code,
      controller: card.controller,
      location: card.location,
      sequence: card.sequence,
    }];
  });
}

export function getOcgPendingDecision(
  matchId: string,
  userId: string
): OcgPendingDecision | null {
  const session = sessions.get(matchId);
  const pending = session ? getPendingMessage(session) : null;
  if (!session || !pending || session.players[Number(pending.player)] !== userId) {
    return null;
  }

  if (
    pending.type === MESSAGE_SELECT_EFFECT_YN ||
    pending.type === MESSAGE_SELECT_YES_NO
  ) {
    return {
      type: "yes_no",
      source:
        pending.type === MESSAGE_SELECT_EFFECT_YN ? "effect" : "generic",
      ...(typeof pending.code === "number" ? { cardId: pending.code } : {}),
      description:
        typeof pending.description === "bigint"
          ? pending.description.toString()
          : "",
    };
  }

  if (pending.type === MESSAGE_SELECT_OPTION) {
    const options = Array.isArray(pending.options) ? pending.options : [];
    return {
      type: "option",
      options: options.map((option) => String(option)),
    };
  }

  if (
    pending.type === MESSAGE_SELECT_CARD ||
    pending.type === MESSAGE_SELECT_TRIBUTE
  ) {
    return {
      type:
        pending.type === MESSAGE_SELECT_TRIBUTE
          ? "tributes"
          : session.selectingBattleTarget
            ? "battle_targets"
            : "cards",
      min: typeof pending.min === "number" ? pending.min : 1,
      max: typeof pending.max === "number" ? pending.max : 1,
      canCancel: pending.can_cancel === true,
      candidates: pendingCards(pending).map((card) => ({
        index: card.index,
        cardId: card.cardId,
        controllerId: session.players[card.controller],
        location: card.location,
        sequence: card.sequence,
      })),
    };
  }

  if (
    pending.type === MESSAGE_SELECT_POSITION &&
    typeof pending.code === "number" &&
    typeof pending.positions === "number"
  ) {
    const positionMask = pending.positions;
    return {
      type: "position",
      cardId: pending.code,
      positions: [1, 2, 4, 8].filter(
        (position) => (positionMask & position) !== 0
      ),
    };
  }

  if (pending.type === MESSAGE_SELECT_PLACE) {
    return {
      type: "place",
      count: typeof pending.count === "number" ? pending.count : 1,
      places: pendingPlaces(session, pending),
    };
  }

  return null;
}

export async function performOcgDecision(input: {
  matchId: string;
  userId: string;
  yes?: boolean;
  optionIndex?: number;
  cardIndices?: number[] | null;
  position?: number;
  placeIndices?: number[];
  preserveOptionalChain?: boolean;
  preserveOptionalChainForUserId?: string;
}) {
  const session = sessions.get(input.matchId);
  if (!session) return null;
  if (session.busy) throw new Error("O motor já está processando outra ação.");
  const pending = getPendingMessage(session);
  if (!pending || session.players[Number(pending.player)] !== input.userId) {
    throw new Error("O OCGCore não está aguardando uma decisão sua.");
  }

  let response: Record<string, unknown>;
  if (
    pending.type === MESSAGE_SELECT_EFFECT_YN ||
    pending.type === MESSAGE_SELECT_YES_NO
  ) {
    if (typeof input.yes !== "boolean") {
      throw new Error("Escolha Sim ou Não.");
    }
    response = {
      type:
        pending.type === MESSAGE_SELECT_EFFECT_YN
          ? RESPONSE_SELECT_EFFECT_YN
          : RESPONSE_SELECT_YES_NO,
      yes: input.yes,
    };
  } else if (pending.type === MESSAGE_SELECT_OPTION) {
    const options = Array.isArray(pending.options) ? pending.options : [];
    if (
      !Number.isInteger(input.optionIndex) ||
      input.optionIndex! < 0 ||
      input.optionIndex! >= options.length
    ) {
      throw new Error("Escolha uma opção válida.");
    }
    response = { type: RESPONSE_SELECT_OPTION, index: input.optionIndex };
  } else if (
    pending.type === MESSAGE_SELECT_CARD ||
    pending.type === MESSAGE_SELECT_TRIBUTE
  ) {
    const cards = pendingCards(pending);
    const indicies = input.cardIndices ?? null;
    if (indicies === null) {
      if (pending.can_cancel !== true) {
        throw new Error("Esta escolha não pode ser cancelada.");
      }
    } else {
      const unique = new Set(indicies);
      const min = typeof pending.min === "number" ? pending.min : 1;
      const max = typeof pending.max === "number" ? pending.max : 1;
      if (
        unique.size !== indicies.length ||
        indicies.length < min ||
        indicies.length > max ||
        indicies.some(
          (index) => !Number.isInteger(index) || index < 0 || index >= cards.length
        )
      ) {
        throw new Error(`Selecione entre ${min} e ${max} carta(s).`);
      }
    }
    response = {
      type:
        pending.type === MESSAGE_SELECT_TRIBUTE
          ? RESPONSE_SELECT_TRIBUTE
          : RESPONSE_SELECT_CARD,
      indicies,
    };
    if (pending.type === MESSAGE_SELECT_CARD && session.selectingBattleTarget) {
      session.selectingBattleTarget = false;
    }
  } else if (pending.type === MESSAGE_SELECT_POSITION) {
    if (
      !Number.isInteger(input.position) ||
      ![1, 2, 4, 8].includes(input.position!) ||
      typeof pending.positions !== "number" ||
      (pending.positions & input.position!) === 0
    ) {
      throw new Error("Escolha uma posição válida.");
    }
    response = {
      type: RESPONSE_SELECT_POSITION,
      position: input.position,
    };
  } else if (pending.type === MESSAGE_SELECT_PLACE) {
    const places = pendingPlaces(session, pending);
    const count = typeof pending.count === "number" ? pending.count : 1;
    const indices = input.placeIndices ?? [];
    const unique = new Set(indices);
    if (
      indices.length !== count ||
      unique.size !== indices.length ||
      indices.some(
        (index) => !Number.isInteger(index) || index < 0 || index >= places.length
      )
    ) {
      throw new Error(`Escolha exatamente ${count} zona(s) válida(s).`);
    }
    response = {
      type: RESPONSE_SELECT_PLACE,
      places: indices.map((index) => ({
        player: session.players.indexOf(
          places[index].controllerId
        ),
        location: places[index].location,
        sequence: places[index].sequence,
      })),
    };
  } else {
    throw new Error("Esta decisão do OCGCore ainda não é suportada.");
  }

  session.busy = true;
  try {
    const core = await loadOcgCore();
    const eventStart = session.messages.length;
    core.duelSetResponse(session.handle, response as never);
    // Triggered effects such as Armed Dragon LV3 can open an optional
    // chain window before asking for the card/position/place choices.
    // Preserve it only when the application already has a visible chain;
    // otherwise pass the orphan window so the next real decision is exposed.
    await processUntilDecision(
      core,
      session,
      !input.preserveOptionalChain,
      input.preserveOptionalChainForUserId
    );
    return {
      ...getOcgDuelSessionSnapshot(input.matchId),
      events: stateEventsSince(session, eventStart),
    };
  } finally {
    session.busy = false;
  }
}

export async function performOcgAttack(input: {
  matchId: string;
  userId: string;
  cardId: number;
  zone: number;
}) {
  const session = sessions.get(input.matchId);
  if (!session) return null;
  if (session.busy) throw new Error("O motor já está processando outra ação.");

  const pending = getPendingMessage(session);
  if (
    !pending ||
    pending.type !== MESSAGE_SELECT_BATTLECMD ||
    session.players[Number(pending.player)] !== input.userId
  ) {
    throw new Error("O OCGCore não permite declarar um ataque agora.");
  }

  const attacks = Array.isArray(pending.attacks)
    ? (pending.attacks as Array<Record<string, unknown>>)
    : [];
  const controller = session.players.indexOf(input.userId);
  const index = attacks.findIndex(
    (card) =>
      card.code === input.cardId &&
      card.controller === controller &&
      card.location === LOCATION_MZONE &&
      card.sequence === input.zone
  );
  if (index < 0) {
    throw new Error("Este monstro não pode atacar agora.");
  }

  session.busy = true;
  session.selectingBattleTarget = false;
  try {
    const core = await loadOcgCore();
    const eventStart = session.messages.length;
    core.duelSetResponse(session.handle, {
      type: RESPONSE_SELECT_BATTLECMD,
      action: BATTLE_ATTACK,
      index,
    });
    await processUntilDecision(core, session);
    session.selectingBattleTarget =
      getPendingMessage(session)?.type === MESSAGE_SELECT_CARD;
    return {
      ...getOcgDuelSessionSnapshot(input.matchId),
      events: stateEventsSince(session, eventStart),
    };
  } finally {
    session.busy = false;
  }
}

export async function performOcgMonsterAction(input: {
  matchId: string;
  userId: string;
  action: "summon" | "special_summon" | "set_monster";
  cardId: number;
  zone?: number;
  preserveOptionalChain?: boolean;
  preserveOptionalChainForUserId?: string;
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

  const list =
    input.action === "summon"
      ? "summons"
      : input.action === "special_summon"
        ? "special_summons"
        : "monster_sets";
  const index = cardIndex(pending, list, input.cardId);
  if (index < 0) {
    throw new Error("Essa carta não pode realizar essa ação agora.");
  }

  session.busy = true;
  try {
    const core = await loadOcgCore();
    const eventStart = session.messages.length;
    core.duelSetResponse(session.handle, {
      type: RESPONSE_SELECT_IDLECMD,
      action:
        input.action === "summon"
          ? IDLE_SUMMON
          : input.action === "special_summon"
            ? IDLE_SPECIAL_SUMMON
            : IDLE_MONSTER_SET,
      index,
    });
    await processUntilDecision(
      core,
      session,
      !input.preserveOptionalChain,
      input.preserveOptionalChainForUserId
    );

    const placeRequest = getPendingMessage(session);
    if (
      input.action !== "special_summon" &&
      placeRequest?.type === MESSAGE_SELECT_PLACE &&
      Number.isInteger(input.zone)
    ) {
      if (session.players[Number(placeRequest.player)] !== input.userId) {
        throw new Error("O motor solicitou a zona ao jogador incorreto.");
      }
      core.duelSetResponse(session.handle, {
        type: RESPONSE_SELECT_PLACE,
        places: [
          {
            player: Number(placeRequest.player),
            location: LOCATION_MZONE,
            sequence: input.zone!,
          },
        ],
      });
      await processUntilDecision(
        core,
        session,
        !input.preserveOptionalChain,
        input.preserveOptionalChainForUserId
      );
    }

    return {
      ...getOcgDuelSessionSnapshot(input.matchId),
      events: stateEventsSince(session, eventStart),
    };
  } finally {
    session.busy = false;
  }
}

export async function performOcgSpellAction(input: {
  matchId: string;
  userId: string;
  action: "set_spell_trap" | "activate";
  cardId: number;
  zone?: number;
  fieldSpell: boolean;
  preserveOptionalChain?: boolean;
  preserveOptionalChainForUserId?: string;
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
  const list = input.action === "activate" ? "activates" : "spell_sets";
  const index = cardIndex(pending, list, input.cardId);
  if (index < 0) throw new Error("Essa carta não pode realizar essa ação agora.");

  session.busy = true;
  try {
    const core = await loadOcgCore();
    const eventStart = session.messages.length;
    core.duelSetResponse(session.handle, {
      type: RESPONSE_SELECT_IDLECMD,
      action: input.action === "activate" ? IDLE_ACTIVATE : IDLE_SPELL_SET,
      index,
    });
    await processUntilDecision(
      core,
      session,
      input.action !== "activate" || !input.preserveOptionalChain,
      input.preserveOptionalChainForUserId
    );
    const placeRequest = getPendingMessage(session);
    if (
      placeRequest?.type === MESSAGE_SELECT_PLACE &&
      Number.isInteger(input.zone)
    ) {
      const allowedPlace = pendingPlaces(session, placeRequest).find(
        (place) =>
          place.controllerId === input.userId &&
          place.location ===
            (input.fieldSpell ? LOCATION_FZONE : LOCATION_SZONE) &&
          place.sequence === (input.fieldSpell ? 0 : input.zone)
      );
      if (!allowedPlace) {
        throw new Error("Escolha uma das zonas permitidas pelo OCGCore.");
      }
      core.duelSetResponse(session.handle, {
        type: RESPONSE_SELECT_PLACE,
        places: [
          {
            player: Number(placeRequest.player),
            location: allowedPlace.location,
            sequence: allowedPlace.sequence,
          },
        ],
      });
      await processUntilDecision(
        core,
        session,
        input.action !== "activate" || !input.preserveOptionalChain,
        input.preserveOptionalChainForUserId
      );
    }
    return {
      ...getOcgDuelSessionSnapshot(input.matchId),
      events: stateEventsSince(session, eventStart),
    };
  } finally {
    session.busy = false;
  }
}

export async function performOcgChainActivation(input: {
  matchId: string;
  userId: string;
  cardId: number;
}) {
  const session = sessions.get(input.matchId);
  if (!session) return null;
  if (session.busy) throw new Error("O motor já está processando outra ação.");

  const pending = getPendingMessage(session);
  if (
    !pending ||
    pending.type !== MESSAGE_SELECT_CHAIN ||
    session.players[Number(pending.player)] !== input.userId
  ) {
    throw new Error("O OCGCore não está aguardando uma resposta sua.");
  }

  const candidates = Array.isArray(pending.selects)
    ? (pending.selects as Array<Record<string, unknown>>)
    : [];
  const index = candidates.findIndex((candidate) => candidate.code === input.cardId);
  if (index < 0) {
    throw new Error("Esta carta não pode ser ativada nesta corrente.");
  }

  session.busy = true;
  try {
    const core = await loadOcgCore();
    const eventStart = session.messages.length;
    core.duelSetResponse(session.handle, {
      type: RESPONSE_SELECT_CHAIN,
      index,
    });
    await processUntilDecision(core, session, false);
    return {
      ...getOcgDuelSessionSnapshot(input.matchId),
      events: stateEventsSince(session, eventStart),
    };
  } finally {
    session.busy = false;
  }
}

export async function passOcgChain(matchId: string, userId: string) {
  const session = sessions.get(matchId);
  if (!session) return null;
  const pending = getPendingMessage(session);
  if (
    !pending ||
    pending.type !== MESSAGE_SELECT_CHAIN ||
    pending.forced === true ||
    session.players[Number(pending.player)] !== userId
  ) {
    return null;
  }
  const core = await loadOcgCore();
  const eventStart = session.messages.length;
  core.duelSetResponse(session.handle, {
    type: RESPONSE_SELECT_CHAIN,
    index: null,
  });
  await processUntilDecision(core, session);
  return {
    ...getOcgDuelSessionSnapshot(matchId),
    events: stateEventsSince(session, eventStart),
  };
}

export async function performOcgEndTurn(matchId: string, userId: string) {
  const session = sessions.get(matchId);
  if (!session) return null;
  if (session.busy) throw new Error("O motor já está processando outra ação.");

  session.busy = true;
  try {
    const core = await loadOcgCore();
    const eventStart = session.messages.length;
    let pending = getPendingMessage(session);
    while (
      pending?.type === MESSAGE_SELECT_CHAIN &&
      pending.forced !== true
    ) {
      core.duelSetResponse(session.handle, {
        type: RESPONSE_SELECT_CHAIN,
        index: null,
      });
      await processUntilDecision(core, session);
      pending = getPendingMessage(session);
    }
    if (!pending || session.players[Number(pending.player)] !== userId) {
      throw new Error("O OCGCore não permite terminar o turno agora.");
    }
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
    return {
      ...getOcgDuelSessionSnapshot(matchId),
      events: stateEventsSince(session, eventStart),
    };
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
    const eventStart = session.messages.length;
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
    return {
      ...getOcgDuelSessionSnapshot(matchId),
      events: stateEventsSince(session, eventStart),
    };
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
    pendingPlayerId:
      typeof pendingMessage?.player === "number"
        ? session.players[Number(pendingMessage.player)] ?? null
        : null,
    errorCount: session.errors.length,
    createdAt: new Date(session.createdAt).toISOString(),
  };
}
