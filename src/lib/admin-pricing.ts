import { prisma } from "@/lib/prisma";
import { listingFor, priceTierFor, PRICE_TIERS, type PriceTier } from "@/lib/card-prices";
import { getShopPricing } from "@/lib/site-settings";

export class PricingError extends Error {}

/**
 * Aplica o preço das categorias (definido no painel do Admin) a todas as cartas
 * da loja. Cartas com preço manual (customPrice) ficam como estão.
 * As raridades acompanham sozinhas: são % do preço base.
 */
export async function applyTierPrices() {
  const { tiers } = await getShopPricing();
  const listings = await prisma.shopListing.findMany({
    where: { customPrice: false },
    include: { card: { select: { name: true, type: true, level: true } } },
  });

  // Agrupa as cartas que ficam com o mesmo preço/limite: uma atualização por grupo
  const groups = new Map<string, { data: ReturnType<typeof listingFor>; ids: string[] }>();
  const byTier: Partial<Record<PriceTier, number>> = {};
  for (const l of listings) {
    const tier = priceTierFor(l.card);
    byTier[tier] = (byTier[tier] ?? 0) + 1;
    const data = listingFor(l.card, tiers);
    const same =
      l.priceGold === data.priceGold && l.priceCash === data.priceCash && l.maxTotal === data.maxTotal && l.maxGold === data.maxGold && l.maxCash === data.maxCash;
    if (same) continue;
    const key = JSON.stringify(data);
    if (!groups.has(key)) groups.set(key, { data, ids: [] });
    groups.get(key)!.ids.push(l.id);
  }

  let changed = 0;
  for (const { data, ids } of groups.values()) {
    const { count } = await prisma.shopListing.updateMany({ where: { id: { in: ids } }, data });
    changed += count;
  }
  const custom = await prisma.shopListing.count({ where: { customPrice: true } });
  return { changed, total: listings.length, custom, byTier };
}

/** Preço atual de uma carta na loja e o preço que a categoria dela daria. */
export async function getCardPrice(cardId: number) {
  const listing = await prisma.shopListing.findUnique({
    where: { cardId },
    include: { card: { select: { id: true, name: true, type: true, level: true, imageUrl: true } } },
  });
  if (!listing) throw new PricingError("Essa carta não está na loja.");
  const { tiers } = await getShopPricing();
  const tier = priceTierFor(listing.card);
  return {
    card: listing.card,
    priceGold: listing.priceGold,
    priceCash: listing.priceCash,
    customPrice: listing.customPrice,
    tier,
    tierLabel: PRICE_TIERS[tier].label,
    tierPrice: tiers[tier],
  };
}

/** Preço manual de uma carta (fica fora do "aplicar preços da categoria"). */
export async function setCardPrice(cardId: number, priceGold: number | null, priceCash: number | null) {
  for (const p of [priceGold, priceCash]) {
    if (p != null && (!Number.isInteger(p) || p < 0 || p > 10_000_000)) throw new PricingError("Preços precisam ser números inteiros (0 ou mais).");
  }
  if (priceGold == null && priceCash == null) throw new PricingError("A carta precisa ter preço em gold ou em crédito.");
  await prisma.shopListing.update({ where: { cardId }, data: { priceGold, priceCash, customPrice: true } });
  return getCardPrice(cardId);
}

/** Volta a carta para o preço da categoria dela. */
export async function resetCardPrice(cardId: number) {
  const listing = await prisma.shopListing.findUnique({ where: { cardId }, include: { card: { select: { name: true, type: true, level: true } } } });
  if (!listing) throw new PricingError("Essa carta não está na loja.");
  const { tiers } = await getShopPricing();
  const { priceGold, priceCash } = listingFor(listing.card, tiers);
  await prisma.shopListing.update({ where: { cardId }, data: { priceGold, priceCash, customPrice: false } });
  return getCardPrice(cardId);
}
