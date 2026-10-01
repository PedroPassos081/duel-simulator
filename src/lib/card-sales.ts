import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EconomyError } from "@/lib/economy";
import { getActivePromos, promoPrice } from "@/lib/card-releases";
import { getCardSalePercent, getShopPricing } from "@/lib/site-settings";
import { MAX_BULK_SALE, quoteCardSale, type SaleOrigin, type SellableInfo } from "@/lib/card-sale-rules";
import { bestVariant, type Border, type Finish } from "@/lib/card-finish";

type Db = Prisma.TransactionClient | typeof prisma;

// Venda em lote: vários updates num banco remoto, mais prazo que o padrão de 5 s
const TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

const bump = <K,>(map: Map<K, number>, key: K, by: number) => map.set(key, (map.get(key) ?? 0) + by);

/**
 * Para cada carta do jogador: quantas cópias podem ser vendidas e de que origem.
 * Não entram: cópias de Structure Deck e cópias usadas em algum deck salvo (o deck que mais usa).
 */
async function computeSellable(db: Db, userId: string, cardIds?: number[]) {
  const inIds = cardIds ? { cardId: { in: cardIds } } : {};
  const ownerships = await db.userCardOwnership.findMany({
    where: { userId, quantity: { gt: 0 }, ...inIds },
    include: { card: { include: { shopListing: true } } },
    orderBy: { card: { name: "asc" } },
  });
  const ids = { cardId: { in: ownerships.map((o) => o.cardId) } };

  // Na promoção de lançamento a venda usa o preço com desconto (senão daria lucro comprar e vender)
  const promos = await getActivePromos();
  const [variants, purchases, sales, structurePurchases, deckCards] = await Promise.all([
    db.userCardVariant.findMany({ where: { userId, quantity: { gt: 0 }, ...ids } }),
    db.purchase.groupBy({ by: ["cardId", "currencyUsed"], where: { userId, ...ids }, _count: { _all: true } }),
    db.cardSale.groupBy({ by: ["cardId", "origin"], where: { userId, ...ids }, _count: { _all: true } }),
    db.structureDeckPurchase.groupBy({ by: ["structureDeckId"], where: { userId, edition: { not: "upgrade" } }, _count: { _all: true } }),
    db.deckCard.findMany({ where: { deck: { userId }, ...ids }, select: { deckId: true, cardId: true, quantity: true } }),
  ]);

  // Cópias que vieram de Structure Deck
  const structureCards = structurePurchases.length
    ? await db.structureDeckCard.findMany({
        where: { structureDeckId: { in: structurePurchases.map((p) => p.structureDeckId) }, ...ids },
      })
    : [];
  const fromStructure = new Map<number, number>();
  for (const c of structureCards) {
    const times = structurePurchases.find((p) => p.structureDeckId === c.structureDeckId)?._count._all ?? 0;
    bump(fromStructure, c.cardId, c.quantity * times);
  }

  // Maior uso da carta num mesmo deck (Main + Extra + Side somam)
  const perDeck = new Map<string, number>();
  for (const d of deckCards) bump(perDeck, `${d.deckId}:${d.cardId}`, d.quantity);
  const deckUse = new Map<number, number>();
  for (const [key, qty] of perDeck) {
    const cardId = Number(key.split(":")[1]);
    deckUse.set(cardId, Math.max(deckUse.get(cardId) ?? 0, qty));
  }

  const countOf = <T extends { cardId: number; _count: { _all: number } }>(rows: T[], cardId: number, match: (r: T) => boolean) =>
    rows.filter((r) => r.cardId === cardId && match(r)).reduce((s, r) => s + r._count._all, 0);

  return ownerships.flatMap((o) => {
    const listing = o.card.shopListing;
    if (!listing || !listing.active) return []; // fora da loja: sem preço para vender

    const owned = o.quantity;
    const structure = Math.min(fromStructure.get(o.cardId) ?? 0, owned);
    const others = owned - structure; // cópias que não vieram de Structure Deck

    // Origem das cópias: compras ainda não vendidas; o que sobra foi ganho
    const left = (currency: string) =>
      Math.max(
        0,
        countOf(purchases, o.cardId, (r) => r.currencyUsed === currency) - countOf(sales, o.cardId, (r) => r.origin === currency)
      );
    const cash = Math.min(left("cash"), others);
    const gold = Math.min(left("gold"), others - cash);
    const origins: Record<SaleOrigin, number> = { cash, gold, free: others - cash - gold };

    const used = deckUse.get(o.cardId) ?? 0;
    const sellable = Math.max(0, owned - Math.max(structure, used));

    // Versões: as evoluídas estão em UserCardVariant; o resto é Normal sem borda
    const mine = variants.filter((v) => v.cardId === o.cardId);
    const versions = [
      { finish: "normal" as Finish, border: "none" as Border, count: owned - mine.reduce((sum, v) => sum + v.quantity, 0) },
      ...mine.map((v) => ({ finish: v.finish as Finish, border: v.border as Border, count: v.quantity })),
    ]
      .filter((v) => v.count > 0)
      .map(({ count, ...v }) => ({ ...v, sellable: Math.min(count, sellable) }));

    const info: SellableInfo = {
      listing: { priceGold: promoPrice(listing.priceGold, promos.get(o.cardId)), priceCash: promoPrice(listing.priceCash, promos.get(o.cardId)) },
      versions,
      origins,
      sellable,
    };
    const { shopListing, ...card } = o.card;
    void shopListing; // o preço já está em info.listing
    const card2 = { ...card, ownedQuantity: owned, bestVariant: bestVariant(versions) };
    return [{ cardId: o.cardId, card: card2, owned, fromStructure: structure, deckUse: used, info }];
  });
}

/** Coleção do jogador com o que pode ser vendido, e a % atual da venda. */
export async function getSellableCollection(userId: string) {
  const [rows, percent, pricing] = await Promise.all([computeSellable(prisma, userId), getCardSalePercent(), getShopPricing()]);
  return { percent, finishPercents: pricing.finishPercents, cards: rows };
}

/** Vende várias cópias de uma vez. Tudo ou nada. */
export async function sellCards(userId: string, items: { cardId: number; quantity: number }[]) {
  const total = items.reduce((s, i) => s + i.quantity, 0);
  if (total === 0) throw new EconomyError("Escolha ao menos uma carta para vender.");
  if (total > MAX_BULK_SALE) throw new EconomyError(`No máximo ${MAX_BULK_SALE} cópias por venda.`);

  return prisma.$transaction(async (tx) => {
    const percent = await getCardSalePercent(tx);
    const { finishPercents } = await getShopPricing(tx);
    const quantities = new Map<number, number>();
    for (const i of items) bump(quantities, i.cardId, i.quantity);
    const rows = await computeSellable(tx, userId, [...quantities.keys()]);

    let gold = 0;
    let cash = 0;
    const saleRows: Prisma.CardSaleCreateManyInput[] = [];

    for (const [cardId, quantity] of quantities) {
      const row = rows.find((r) => r.cardId === cardId);
      if (!row) throw new EconomyError("Uma das cartas não pode ser vendida (fora da loja ou você não a possui).");

      let quote;
      try {
        quote = quoteCardSale(row.info, quantity, percent, finishPercents);
      } catch (err) {
        throw new EconomyError(`${row.card.name}: ${(err as Error).message}`);
      }

      // Cópias evoluídas vendidas saem de UserCardVariant (as Normais só do total)
      const perVersion = new Map<string, number>();
      for (const l of quote.lines) bump(perVersion, `${l.finish}:${l.border}`, 1);
      for (const [key, qty] of perVersion) {
        const [finish, border] = key.split(":");
        if (finish === "normal" && border === "none") continue;
        await tx.userCardVariant.update({
          where: { userId_cardId_finish_border: { userId, cardId, finish, border } },
          data: { quantity: { decrement: qty } },
        });
      }
      await tx.userCardVariant.deleteMany({ where: { userId, cardId, quantity: { lte: 0 } } });

      const ownership = await tx.userCardOwnership.update({
        where: { userId_cardId: { userId, cardId } },
        data: { quantity: { decrement: quantity } },
      });
      if (ownership.quantity <= 0) await tx.userCardOwnership.delete({ where: { userId_cardId: { userId, cardId } } });

      for (const l of quote.lines) saleRows.push({ userId, cardId, origin: l.origin, currency: l.currency, amount: l.amount });
      gold += quote.gold;
      cash += quote.cash;
    }

    await tx.cardSale.createMany({ data: saleRows });

    // Carteira + extrato (uma linha por moeda)
    await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { gold: { increment: gold }, cash: { increment: cash } },
    });
    for (const [currency, amount] of [["gold", gold], ["cash", cash]] as const) {
      if (amount === 0) continue;
      await tx.currencyTransaction.create({
        data: { userId, currency, amount, balanceAfter: wallet[currency], reason: "card_sale", refType: "CardSale" },
      });
    }

    return { copies: saleRows.length, gold, cash, percent };
  }, TX_OPTIONS);
}
