// Regras da venda de cartas na loja (código puro: roda no navegador e no servidor).
//
// - A cópia vende por X% do preço ATUAL da loja (X definido pelo Admin; padrão 40%).
// - Recebe na moeda em que a cópia foi comprada: gold -> gold, crédito -> crédito.
//   Cópias ganhas (prêmio, presente, evento) recebem em gold.
//   Se a carta não tiver preço nessa moeda, recebe na outra.
// - Não vendem: cópias que vieram de Structure Deck e cópias usadas em algum deck salvo.
// - Cópias com raridade/borda valem pelo preço daquela versão (Rara 2x, Secreta 8x...).
//   As versões mais simples saem primeiro, para ninguém vender uma rara sem querer.
import { BORDERS, DEFAULT_FINISH_PERCENTS, FINISHES, NORMAL_VARIANT, priceWithVariant, type Border, type Finish, type FinishPercents, type Variant } from "@/lib/card-finish";

export const DEFAULT_SALE_PERCENT = 40;
export const MIN_SALE_PERCENT = 1;
export const MAX_SALE_PERCENT = 100;
export const MAX_BULK_SALE = 60; // cópias por venda

export type SaleOrigin = "cash" | "gold" | "free";
export type SaleCurrency = "gold" | "cash";

// Ordem em que as origens são usadas ao vender (crédito primeiro: é a moeda mais valiosa)
export const ORIGIN_ORDER: SaleOrigin[] = ["cash", "gold", "free"];

export interface ListingPrices {
  priceGold: number | null;
  priceCash: number | null;
}

/** Quanto uma cópia rende, e em que moeda, conforme a origem dela. */
export function copySaleValue(
  listing: ListingPrices,
  origin: SaleOrigin,
  percent: number,
  variant: Variant = NORMAL_VARIANT,
  finishPercents: FinishPercents = DEFAULT_FINISH_PERCENTS
): { currency: SaleCurrency; amount: number } {
  const wanted: SaleCurrency = origin === "cash" ? "cash" : "gold";
  const priceOf = (c: SaleCurrency) => (c === "gold" ? listing.priceGold : listing.priceCash);
  const currency: SaleCurrency = priceOf(wanted) != null ? wanted : wanted === "gold" ? "cash" : "gold";
  const price = priceWithVariant(priceOf(currency) ?? 0, variant, finishPercents);
  return { currency, amount: Math.max(1, Math.floor((price * percent) / 100)) };
}

export interface SellableInfo {
  listing: ListingPrices;
  /** Versões que o jogador tem e quantas cópias de cada podem ser vendidas. */
  versions: { finish: Finish; border: Border; sellable: number }[];
  /** Cópias vendáveis por origem (compra com crédito, compra com gold, ganhas). */
  origins: Record<SaleOrigin, number>;
  /** Total que pode ser vendido (já sem Structure Deck e sem as cópias usadas em decks). */
  sellable: number;
}

/**
 * Calcula a venda de `quantity` cópias de UMA carta: cada cópia recebe uma origem
 * (crédito, depois gold, depois ganha) e vale `percent`% do preço da loja.
 * Lança erro se pedir mais do que pode vender.
 */
export function quoteCardSale(info: SellableInfo, quantity: number, percent: number, finishPercents: FinishPercents = DEFAULT_FINISH_PERCENTS) {
  if (quantity > info.sellable) throw new Error(`Só ${info.sellable} cópia(s) desta carta podem ser vendidas.`);
  const origins = { ...info.origins };
  // Versões da mais simples para a mais rara
  const versions = [...info.versions]
    .sort((a, b) => rank(a) - rank(b))
    .map((v) => ({ ...v }));
  const lines: { origin: SaleOrigin; currency: SaleCurrency; amount: number; finish: Finish; border: Border }[] = [];
  for (let i = 0; i < quantity; i++) {
    const origin = ORIGIN_ORDER.find((o) => origins[o] > 0);
    const version = versions.find((v) => v.sellable > 0);
    if (!origin || !version) throw new Error("Não há cópias livres para vender.");
    origins[origin]--;
    version.sellable--;
    const variant = { finish: version.finish, border: version.border };
    lines.push({ origin, ...variant, ...copySaleValue(info.listing, origin, percent, variant, finishPercents) });
  }
  return {
    lines,
    gold: lines.filter((l) => l.currency === "gold").reduce((s, l) => s + l.amount, 0),
    cash: lines.filter((l) => l.currency === "cash").reduce((s, l) => s + l.amount, 0),
  };
}

const rank = (v: Variant) => FINISHES[v.finish].rank * 10 + BORDERS[v.border].rank;
