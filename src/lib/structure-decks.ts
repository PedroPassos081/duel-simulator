import { prisma } from "@/lib/prisma";
import { EconomyError } from "@/lib/economy";

export type Edition = "base" | "premium";
export type StructureCurrency = "cash" | "gold" | "money";

const MAX_SAVED_DECKS = 20;
// Vários upserts de cartas em um banco distante: o limite padrão de 5 s é pouco
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

/** Preço de uma edição em uma moeda (null = não vendido assim). Dinheiro já com desconto. */
export function structurePrice(
  deck: {
    priceCash: number | null;
    priceGold: number | null;
    premiumPriceCash: number | null;
    premiumPriceGold: number | null;
    moneyPriceCents: number | null;
    premiumMoneyPriceCents: number | null;
    moneyDiscountPercent: number;
  },
  edition: Edition,
  currency: StructureCurrency
) {
  if (currency === "money") {
    const full = edition === "premium" ? deck.premiumMoneyPriceCents : deck.moneyPriceCents;
    if (full == null) return null;
    return Math.round(full * (1 - deck.moneyDiscountPercent / 100));
  }
  if (edition === "premium") return currency === "cash" ? deck.premiumPriceCash : deck.premiumPriceGold;
  return currency === "cash" ? deck.priceCash : deck.priceGold;
}

/** Structure Decks à venda, com cartas, cosméticos da premium e quantas vezes o jogador já comprou. */
export async function listStructureDecks(userId?: string | null) {
  const [decks, purchases] = await Promise.all([
    prisma.structureDeck.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      include: {
        cards: {
          include: { card: { select: { id: true, name: true, type: true, imageUrl: true } } },
          orderBy: [{ section: "asc" }, { card: { name: "asc" } }],
        },
        cosmetics: { where: { active: true }, select: { id: true, type: true, name: true, imageUrl: true, effect: true } },
      },
    }),
    userId
      ? prisma.structureDeckPurchase.groupBy({ by: ["structureDeckId", "edition"], where: { userId }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);

  const coverIds = decks.map((d) => d.coverCardId).filter((id): id is number => id != null);
  const covers = await prisma.card.findMany({ where: { id: { in: coverIds } }, select: { id: true, imageUrl: true } });

  return decks.map((deck) => {
    const bought = (edition: Edition) =>
      purchases.find((p) => p.structureDeckId === deck.id && p.edition === edition)?._count._all ?? 0;
    const prices = (edition: Edition) => ({
      cash: structurePrice(deck, edition, "cash"),
      gold: structurePrice(deck, edition, "gold"),
      money: structurePrice(deck, edition, "money"),
      moneyFull: edition === "premium" ? deck.premiumMoneyPriceCents : deck.moneyPriceCents,
    });
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      coverImageUrl: covers.find((c) => c.id === deck.coverCardId)?.imageUrl ?? deck.cards[0]?.card.imageUrl ?? null,
      moneyDiscountPercent: deck.moneyDiscountPercent,
      cardCount: deck.cards.reduce((sum, c) => sum + c.quantity, 0),
      cards: deck.cards.map((c) => ({ ...c.card, section: c.section, quantity: c.quantity })),
      cosmetics: deck.cosmetics,
      editions: {
        base: { prices: prices("base"), bought: bought("base") },
        premium: { prices: prices("premium"), bought: bought("premium") },
      },
    };
  });
}

/**
 * Compra um Structure Deck. Tudo em uma transação:
 * - debita a carteira
 * - adiciona as cartas à coleção (pode passar de 3 cópias; o deck é que usa no máximo 3)
 * - salva o deck pronto no Deck Builder (se houver espaço)
 * - na premium, entrega os cosméticos exclusivos (só na primeira vez: cosmético não repete)
 */
export async function purchaseStructureDeck(
  userId: string,
  structureDeckId: string,
  edition: Edition,
  currency: StructureCurrency
) {
  if (currency === "money") {
    throw new EconomyError("Pagamento em dinheiro chega em breve. Por enquanto, use crédito ou gold.");
  }

  return prisma.$transaction(async (tx) => {
    const deck = await tx.structureDeck.findUnique({
      where: { id: structureDeckId },
      include: { cards: true, cosmetics: { where: { active: true } } },
    });
    if (!deck || !deck.active) throw new EconomyError("Este Structure Deck não está à venda.");

    const price = structurePrice(deck, edition, currency);
    if (price == null) throw new EconomyError("Esta versão não está à venda nessa moeda.");

    // Débito atômico: só passa se houver saldo
    await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
    const { count } = await tx.wallet.updateMany({
      where: { userId, [currency]: { gte: price } },
      data: { [currency]: { decrement: price } },
    });
    if (count === 0) throw new EconomyError(`Saldo de ${currency === "gold" ? "gold" : "crédito"} insuficiente.`);
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

    const purchase = await tx.structureDeckPurchase.create({
      data: { userId, structureDeckId, edition, currency, amountPaid: price },
    });
    await tx.currencyTransaction.create({
      data: {
        userId,
        currency,
        amount: -price,
        balanceAfter: wallet[currency],
        reason: "structure_purchase",
        refType: "StructureDeckPurchase",
        refId: purchase.id,
      },
    });

    // Cartas na coleção (a mesma carta pode vir em seções diferentes)
    const totalByCard = new Map<number, number>();
    for (const c of deck.cards) totalByCard.set(c.cardId, (totalByCard.get(c.cardId) ?? 0) + c.quantity);
    for (const [cardId, quantity] of totalByCard) {
      await tx.userCardOwnership.upsert({
        where: { userId_cardId: { userId, cardId } },
        update: { quantity: { increment: quantity } },
        create: { userId, cardId, quantity },
      });
    }

    // Deck pronto no Deck Builder
    let deckName: string | null = null;
    if ((await tx.deck.count({ where: { userId } })) < MAX_SAVED_DECKS) {
      deckName = deck.name;
      for (let n = 2; await tx.deck.findFirst({ where: { userId, name: deckName } }); n++) {
        deckName = `${deck.name} (${n})`;
      }
      await tx.deck.create({
        data: {
          userId,
          name: deckName,
          cards: { create: deck.cards.map((c) => ({ cardId: c.cardId, section: c.section, quantity: c.quantity })) },
        },
      });
    }

    // Cosméticos exclusivos da premium
    let newCosmetics = 0;
    if (edition === "premium") {
      for (const cosmetic of deck.cosmetics) {
        const owned = await tx.userCosmetic.findUnique({
          where: { userId_cosmeticId: { userId, cosmeticId: cosmetic.id } },
        });
        if (!owned) {
          await tx.userCosmetic.create({ data: { userId, cosmeticId: cosmetic.id, source: "purchase" } });
          newCosmetics++;
        }
      }
    }

    const parts = [`${deck.name} (${edition === "premium" ? "Premium" : "Base"}) comprado!`, "As cartas foram para a sua coleção."];
    parts.push(
      deckName
        ? `O deck "${deckName}" está pronto no Deck Builder.`
        : `Você já tem ${MAX_SAVED_DECKS} decks salvos, então o deck pronto não foi criado.`
    );
    if (newCosmetics > 0) parts.push(`${newCosmetics} cosmético(s) exclusivo(s) em Minha conta → Personalizar.`);
    return { message: parts.join(" ") };
  }, TX_OPTIONS);
}

/**
 * Cadastra um Structure Deck (para a equipe usar em scripts / seed).
 *
 * Uso típico:
 *   await createStructureDeck({
 *     name: "Fúria do Dragão", coverCardId: 89631139, priceCash: 300, priceGold: 15000,
 *     premiumPriceCash: 500, premiumPriceGold: 25000,
 *     moneyPriceCents: 1990, premiumMoneyPriceCents: 3490, moneyDiscountPercent: 20,
 *     cards: [{ cardId: 89631139, section: "main", quantity: 3 }, ...],
 *   });
 * Depois, crie os Cosmetic exclusivos com structureDeckId = id do deck.
 */
export async function createStructureDeck(data: {
  name: string;
  description?: string;
  coverCardId?: number;
  priceCash?: number;
  priceGold?: number;
  premiumPriceCash?: number;
  premiumPriceGold?: number;
  moneyPriceCents?: number;
  premiumMoneyPriceCents?: number;
  moneyDiscountPercent?: number;
  cards: { cardId: number; section: "main" | "extra" | "side"; quantity: number }[];
}) {
  const { cards, ...deck } = data;
  return prisma.structureDeck.create({ data: { ...deck, cards: { create: cards } } });
}
