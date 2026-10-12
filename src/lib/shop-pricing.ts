// Preços da loja que o Admin pode mudar no painel (código puro: tela e servidor).
// Os valores ficam em SiteSetting (ver src/lib/site-settings.ts); aqui estão os tipos e os padrões.
import { DEFAULT_FINISH_PERCENTS, ITEMS, type FinishPercents, type ItemKey } from "@/lib/card-finish";
import { DEFAULT_TIER_PRICES, type TierPrices } from "@/lib/card-prices";

// Itens vendidos na aba Cosméticos (o Pó do Milênio)
export const SHOP_ITEM_KEYS = ["po_milenio_raro", "po_milenio_ultra", "po_milenio_secret"] as const satisfies readonly ItemKey[];
export type ShopItemKey = (typeof SHOP_ITEM_KEYS)[number];

export interface ItemShopPricing {
  /** Preço de cada item em crédito e em dinheiro (centavos de R$, preço cheio). */
  prices: Record<ShopItemKey, { cash: number; moneyCents: number }>;
  /** Desconto do pagamento em dinheiro, em %. */
  moneyDiscountPercent: number;
}

export const DEFAULT_ITEM_SHOP: ItemShopPricing = {
  prices: {
    po_milenio_raro: { cash: 20, moneyCents: 490 },
    po_milenio_ultra: { cash: 40, moneyCents: 990 },
    po_milenio_secret: { cash: 80, moneyCents: 1990 },
  },
  moneyDiscountPercent: 20,
};

export interface ShopPricing {
  finishPercents: FinishPercents;
  tiers: TierPrices;
  items: ItemShopPricing;
}

export const DEFAULT_SHOP_PRICING: ShopPricing = {
  finishPercents: DEFAULT_FINISH_PERCENTS,
  tiers: DEFAULT_TIER_PRICES,
  items: DEFAULT_ITEM_SHOP,
};

/** Preço em dinheiro já com o desconto (centavos). */
export function discountedMoney(cents: number, discountPercent: number) {
  return Math.round(cents * (1 - discountPercent / 100));
}

export const itemName = (key: ShopItemKey) => ITEMS[key].name;
