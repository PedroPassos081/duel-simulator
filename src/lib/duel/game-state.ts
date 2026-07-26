export type FieldCardState = {
  cardId: number;
  zone: number;
  position:
    | "face_up_attack"
    | "face_up_defense"
    | "face_down_defense"
    | "face_down";
};

export type DuelPlayerState = {
  deck: number[];
  hand: number[];
  extra: number[];
  monsters: FieldCardState[];
  spellTraps: FieldCardState[];
  graveyard: number[];
  normalSummoned: boolean;
};

export type DuelChainState = {
  links: {
    playerId: string;
    cardId: number;
  }[];
  awaitingPlayerId: string;
};

export type DuelGameState = {
  players: Record<string, DuelPlayerState>;
  turnPlayerId: string;
  turn: number;
  chain?: DuelChainState;
};

export function isDuelGameState(value: unknown): value is DuelGameState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<DuelGameState>;
  return (
    typeof state.turnPlayerId === "string" &&
    typeof state.turn === "number" &&
    Boolean(state.players && typeof state.players === "object")
  );
}
