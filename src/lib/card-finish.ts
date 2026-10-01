// Raridades visuais das cartas, bordas e os itens que evoluem as cartas.
// Código puro: usado pelo servidor (regras) e pela tela (etiquetas e efeitos).
// O visual de cada raridade/borda fica em .foil-* no globals.css.

export const FINISHES = {
  normal: { label: "Normal", rank: 0, badge: "bg-zinc-700 text-zinc-200" },
  rara: { label: "Rara", rank: 1, badge: "bg-amber-500/20 text-amber-200 border border-amber-400/40" },
  ultra: { label: "Ultra", rank: 2, badge: "bg-sky-500/20 text-sky-200 border border-sky-400/40" },
  secreta: { label: "Secreta", rank: 3, badge: "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/40" },
} as const;

export const BORDERS = {
  none: { label: "Sem borda", rank: 0 },
  prata: { label: "Borda prata", rank: 1 },
  ouro: { label: "Borda dourada", rank: 2 },
} as const;

export type Finish = keyof typeof FINISHES;
export type Border = keyof typeof BORDERS;

export interface Variant {
  finish: Finish;
  border: Border;
}

export const NORMAL_VARIANT: Variant = { finish: "normal", border: "none" };

/**
 * Itens de evolução. Cada uso gasta 1 item e evolui 1 cópia da carta.
 * - finish: sobe a raridade de `from` para `to`
 * - border: coloca a borda (ou troca prata por dourada)
 */
export const ITEMS = {
  po_milenio_raro: {
    name: "Pó do Milênio Raro",
    short: "Raro",
    group: "Pó do Milênio",
    description: "Evolui uma carta Normal para Rara.",
    kind: "finish",
    from: "normal",
    to: "rara",
    color: "text-amber-300",
  },
  po_milenio_ultra: {
    name: "Pó do Milênio Ultra",
    short: "Ultra",
    group: "Pó do Milênio",
    description: "Evolui uma carta Rara para Ultra.",
    kind: "finish",
    from: "rara",
    to: "ultra",
    color: "text-sky-300",
  },
  po_milenio_secret: {
    name: "Pó do Milênio Secret",
    short: "Secret",
    group: "Pó do Milênio",
    description: "Evolui uma carta Ultra para Secreta.",
    kind: "finish",
    from: "ultra",
    to: "secreta",
    color: "text-fuchsia-300",
  },
  moldura_prata: {
    name: "Moldura Prata",
    short: "Prata",
    group: "Molduras",
    description: "Coloca borda prata em uma cópia.",
    kind: "border",
    border: "prata",
    color: "text-zinc-200",
  },
  moldura_dourada: {
    name: "Moldura Dourada",
    short: "Dourada",
    group: "Molduras",
    description: "Coloca borda dourada em uma cópia.",
    kind: "border",
    border: "ouro",
    color: "text-amber-300",
  },
} as const;

export type ItemKey = keyof typeof ITEMS;

export function isItemKey(value: string): value is ItemKey {
  return value in ITEMS;
}

/** Variante que a cópia vira ao usar o item, ou null se o item não serve nela. */
export function applyItem(variant: Variant, itemKey: ItemKey): Variant | null {
  const item = ITEMS[itemKey];
  if (item.kind === "finish") {
    return variant.finish === item.from ? { ...variant, finish: item.to } : null;
  }
  // Moldura só melhora a borda: sem borda → prata → dourada (nunca rebaixa)
  return BORDERS[item.border].rank > BORDERS[variant.border].rank ? { ...variant, border: item.border } : null;
}

export function variantKey(v: Variant) {
  return `${v.finish}:${v.border}`;
}

export function variantLabel(v: Variant) {
  return v.border === "none" ? FINISHES[v.finish].label : `${FINISHES[v.finish].label} · ${BORDERS[v.border].label}`;
}

/** A versão mais bonita entre as que o jogador tem (para mostrar a carta). */
export function bestVariant(variants: Variant[]): Variant {
  return variants.reduce(
    (best, v) =>
      FINISHES[v.finish].rank > FINISHES[best.finish].rank ||
      (FINISHES[v.finish].rank === FINISHES[best.finish].rank && BORDERS[v.border].rank > BORDERS[best.border].rank)
        ? v
        : best,
    NORMAL_VARIANT
  );
}

// Preço de cada raridade em % do preço base da carta (Normal = 100%).
// Padrão: no teto de 5000, Rara 7500 (150%), Ultra 10000 (200%), Secreta 15000 (300%).
// O Admin muda essas porcentagens no painel; o preço de cada raridade acompanha o
// preço base da carta, subindo e descendo na mesma proporção.
export type FinishPercents = { rara: number; ultra: number; secreta: number };
export const DEFAULT_FINISH_PERCENTS: FinishPercents = { rara: 150, ultra: 200, secreta: 300 };

export function finishPercent(finish: Finish, percents: FinishPercents = DEFAULT_FINISH_PERCENTS) {
  return finish === "normal" ? 100 : percents[finish];
}

/** Multiplicador da raridade sobre o preço base (ex.: 1.5 para Rara). */
export function finishPriceMultiplier(finish: Finish, percents: FinishPercents = DEFAULT_FINISH_PERCENTS) {
  return finishPercent(finish, percents) / 100;
}

export function priceWithFinish(basePrice: number, finish: Finish, percents: FinishPercents = DEFAULT_FINISH_PERCENTS) {
  return Math.round((basePrice * finishPercent(finish, percents)) / 100);
}

/**
 * Quanto custa subir a raridade de uma cópia que o jogador já tem: a diferença
 * entre o preço da raridade nova e o da atual (a cópia continua a mesma).
 */
export function upgradeCost(basePrice: number, from: Finish, to: Finish, percents: FinishPercents = DEFAULT_FINISH_PERCENTS) {
  return Math.max(0, priceWithFinish(basePrice, to, percents) - priceWithFinish(basePrice, from, percents));
}

// Borda comprada junto com a cópia: preço próprio, que NÃO se multiplica pela
// raridade (Prata = 2x o preço base, Dourada = 3x). Paga uma vez, a borda segue
// com a cópia quando ela evolui de raridade.
export const BORDER_PRICE_MULTIPLIER: Record<Border, number> = { none: 0, prata: 2, ouro: 3 };

export function borderPrice(basePrice: number, border: Border) {
  return basePrice * BORDER_PRICE_MULTIPLIER[border];
}

/** Preço total da cópia: raridade (% do base) + borda (base × 2 ou 3). */
export function priceWithVariant(basePrice: number, variant: Variant, percents: FinishPercents = DEFAULT_FINISH_PERCENTS) {
  return priceWithFinish(basePrice, variant.finish, percents) + borderPrice(basePrice, variant.border);
}
