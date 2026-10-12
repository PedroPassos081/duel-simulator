// Preço BASE das cartas na loja (Normal, sem borda). Raridade e borda somam em
// cima deste valor (ver src/lib/card-finish.ts).
//
// Teto: 5000 gold / 50 crédito (1 crédito = 100 gold). Usado pelo seed e pelo
// script que reaplica os preços. Para mudar uma carta de faixa, mova o nome.

export const PRICE_TIERS = {
  top: { label: "Topo", gold: 5000, cash: 50 },
  strong: { label: "Fortes", gold: 2500, cash: 25 },
  high: { label: "Comum nível 7+ / Fusão", gold: 800, cash: 8 },
  mid: { label: "Comum nível 5–6 / Mágica / Armadilha", gold: 400, cash: 4 },
  low: { label: "Comum nível 1–4", gold: 200, cash: 2 },
} as const;

export type PriceTier = keyof typeof PRICE_TIERS;

// As principais do formato (catálogo até 2006): ficam no teto
export const TOP_CARDS = [
  "Chaos Emperor Dragon - Envoy of the End",
  "Black Luster Soldier - Envoy of the Beginning",
  "Pot of Greed",
  "Graceful Charity",
  "Painful Choice",
  "Delinquent Duo",
  "Harpie's Feather Duster",
  "Raigeki",
  "Change of Heart",
  "Snatch Steal",
  "Confiscation",
  "Heavy Storm",
  "Imperial Order",
  "Mirror Force",
  "Monster Reborn",
  "Yata-Garasu",
  "Cyber-Stein",
  "Thousand-Eyes Restrict",
  "Exodia the Forbidden One",
  "Dark Magician of Chaos",
];

// Muito usadas ou icônicas: metade do teto
export const STRONG_CARDS = [
  "Sinister Serpent",
  "Witch of the Black Forest",
  "Sangan",
  "Tribe-Infecting Virus",
  "Breaker the Magical Warrior",
  "Jinzo",
  "Tsukuyomi",
  "Airknight Parshath",
  "Magician of Faith",
  "Morphing Jar",
  "Zaborg the Thunder Monarch",
  "Spirit Reaper",
  "Marshmallon",
  "D.D. Warrior Lady",
  "Blue-Eyes White Dragon",
  "Dark Magician",
  "Red-Eyes Black Dragon",
  "Elemental HERO Flame Wingman",
  "Cyber Dragon",
  "Left Arm of the Forbidden One",
  "Right Arm of the Forbidden One",
  "Left Leg of the Forbidden One",
  "Right Leg of the Forbidden One",
  "Ring of Destruction",
  "Torrential Tribute",
  "Call of the Haunted",
  "Magic Cylinder",
  "Solemn Judgment",
  "Premature Burial",
  "Scapegoat",
  "Book of Moon",
  "Nobleman of Crossout",
  "Metamorphosis",
  "Mystical Space Typhoon",
  "Smashing Ground",
  "Dark Hole",
  "Dimension Fusion",
  "Last Turn",
  "Polymerization",
];

/** Faixa de preço de uma carta pelo nome, tipo e nível. */
export function priceTierFor(card: { name: string; type: string; level: number | null }): PriceTier {
  if (TOP_CARDS.includes(card.name)) return "top";
  if (STRONG_CARDS.includes(card.name)) return "strong";
  const type = card.type.toLowerCase();
  const level = card.level ?? 0;
  if (type.includes("fusion") || level >= 7) return "high";
  if (level === 5 || level === 6 || type.includes("spell") || type.includes("trap")) return "mid";
  return "low";
}

// Limites de cópias por carta (pelo nome). O resto usa o padrão: 3 no total,
// as 2 primeiras podem ser em gold e a 3ª só em crédito.
export const CARD_LIMITS: Record<string, { maxTotal?: number; maxGold?: number; maxCash?: number }> = {
  "Monster Reborn": { maxTotal: 1, maxGold: 1, maxCash: 1 }, // limitada
  "Solemn Judgment": { maxCash: 1 },
};

/** Preço base e limites de uma carta na loja. */
export type TierPrices = Record<PriceTier, { gold: number; cash: number }>;

/** Preço de cada categoria (padrão). O Admin pode mudar no painel; ver shop-pricing. */
export const DEFAULT_TIER_PRICES: TierPrices = Object.fromEntries(
  Object.entries(PRICE_TIERS).map(([k, t]) => [k, { gold: t.gold, cash: t.cash }])
) as TierPrices;

export function listingFor(card: { name: string; type: string; level: number | null }, tiers: TierPrices = DEFAULT_TIER_PRICES) {
  const tier = tiers[priceTierFor(card)];
  const limits = CARD_LIMITS[card.name] ?? {};
  return {
    priceGold: tier.gold,
    priceCash: tier.cash,
    maxTotal: limits.maxTotal ?? 3,
    maxGold: limits.maxGold ?? 2,
    maxCash: limits.maxCash ?? 3,
  };
}
