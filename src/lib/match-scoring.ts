// Pontuação e gold por duelo (código puro: tela e servidor). Os valores ficam em
// SiteSetting e o Admin muda na aba Season; aqui estão os tipos e os padrões.

export type MatchKind = "random" | "official" | "quick";
export type MatchOutcome = "win" | "loss" | "draw";

export type PointsTable = Record<MatchKind, Record<MatchOutcome, number>>;
export type GoldTable = Record<MatchOutcome, number>;

export const MATCH_KIND_LABELS: Record<MatchKind, string> = {
  random: "Random",
  official: "Torneio oficial",
  quick: "Torneio rápido",
};

export const DEFAULT_POINTS: PointsTable = {
  random: { win: 4, loss: -2, draw: 1 },
  official: { win: 10, loss: -2, draw: 2 },
  quick: { win: 6, loss: -2, draw: 2 },
};

// Gold pago a cada duelo do Random (os eventos de gold somam um bônus em cima)
export const DEFAULT_GOLD: GoldTable = { win: 50, loss: 20, draw: 30 };
// Gold por duelo de torneio (oficial ou rápido, pontos ou chaves)
export const DEFAULT_TOURNAMENT_GOLD: GoldTable = { win: 100, loss: 40, draw: 50 };
// VIP: bônus sobre o gold do duelo (sem contar o bônus de evento)
export const VIP_GOLD_BONUS_PERCENT = 30;

export interface MatchScoring {
  points: PointsTable;
  gold: GoldTable;
  tournamentGold: GoldTable;
}

export const DEFAULT_MATCH_SCORING: MatchScoring = { points: DEFAULT_POINTS, gold: DEFAULT_GOLD, tournamentGold: DEFAULT_TOURNAMENT_GOLD };

export function isOutcome(value: string | null | undefined): value is MatchOutcome {
  return value === "win" || value === "loss" || value === "draw";
}
