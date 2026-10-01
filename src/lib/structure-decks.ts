import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EconomyError } from "@/lib/economy";
import { ITEMS, isItemKey, priceWithFinish, type Finish, type ItemKey } from "@/lib/card-finish";
import { grantItem } from "@/lib/collection";
import { listingFor } from "@/lib/card-prices";
import { getShopPricing } from "@/lib/site-settings";
import { SHOP_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-pricing";

/** Lê StructureDeck.premiumItems, ignorando itens que não existem no catálogo. */
function parsePremiumItems(value: unknown): { item: ItemKey; quantity: number }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) =>
    v && typeof v.item === "string" && isItemKey(v.item) && Number.isInteger(v.quantity) && v.quantity > 0
      ? [{ item: v.item as ItemKey, quantity: v.quantity as number }]
      : [],
  );
}

export type Edition = "base" | "premium";
/** O que o jogador pode comprar: uma edição, ou "upgrade" (Base → Premium pagando só a diferença). */
export type StructureOrder = Edition | "upgrade";
// "coins" = gold + crédito juntos (o Structure Deck não é vendido em uma moeda só)
export type StructureCurrency = "coins" | "money";

const MAX_SAVED_DECKS = 20;
// Vários upserts de cartas em um banco distante: o limite padrão de 5 s é pouco
const TX_OPTIONS = { maxWait: 10_000, timeout: 120_000 };

type Db = Prisma.TransactionClient | typeof prisma;

interface PricedDeck {
  discountPercent: number;
  moneyPriceCents: number | null;
  premiumMoneyPriceCents: number | null;
  moneyDiscountPercent: number;
  premiumItems: Prisma.JsonValue;
  cards: { cardId: number; quantity: number; finish: string | null }[];
  cosmetics: { type: string; priceCash: number | null }[];
}

// Cosmético de Structure Deck sem preço próprio vale o mesmo que um do mesmo tipo
// na vitrine da loja (ex.: sleeves e playmats do passe, 150 crédito). Sem nenhum
// na vitrine, usa este valor.
const COSMETIC_FALLBACK_CASH = 150;

export interface EditionPrice {
  /** Quanto custariam as mesmas cartas (e itens) comprados um a um na loja. */
  loose: { gold: number; cash: number };
  /** Quanto o jogador paga no Structure Deck: gold + crédito juntos, com desconto. */
  price: { gold: number; cash: number };
  discountPercent: number;
  /** Dinheiro (centavos): cheio e com desconto. */
  moneyFull: number | null;
  money: number | null;
  moneyDiscountPercent: number;
}

const roundGold = (n: number) => Math.round(n / 50) * 50;
/** Preço em dinheiro terminando em ,90 (ex.: R$ 29,90). */
const roundMoney = (cents: number) => Math.max(90, Math.round((cents - 90) / 100) * 100 + 90);

/**
 * Preço das duas edições de cada deck. O valor "avulso" segue a loja de cartas:
 * as primeiras cópias de cada carta saem em gold (até o limite em gold da carta)
 * e as outras em crédito, já com a raridade. A Premium soma os itens que traz
 * (Pó do Milênio pelo preço da loja) e os cosméticos exclusivos (pelo preço dos
 * cosméticos do mesmo tipo na loja). O Structure Deck cobra esse valor com desconto.
 */
export async function structurePrices(db: Db, decks: PricedDeck[]) {
  const ids = [...new Set(decks.flatMap((d) => d.cards.map((c) => c.cardId)))];
  const [pricing, listings, cards, shopCosmetics] = await Promise.all([
    getShopPricing(db),
    db.shopListing.findMany({
      where: { cardId: { in: ids } },
      select: {
        cardId: true,
        priceGold: true,
        priceCash: true,
        maxGold: true,
        cashOnly: true,
      },
    }),
    db.card.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, type: true, level: true },
    }),
    db.cosmetic.findMany({
      where: { inShop: true, active: true, priceCash: { not: null } },
      select: { type: true, priceCash: true },
    }),
  ]);
  const cosmeticCash = (c: { type: string; priceCash: number | null }) => {
    if (c.priceCash != null) return c.priceCash;
    const same = shopCosmetics.filter((s) => s.type === c.type).map((s) => s.priceCash!);
    return same.length ? Math.max(...same) : COSMETIC_FALLBACK_CASH;
  };
  const shopPrice = (cardId: number) => {
    const listing = listings.find((l) => l.cardId === cardId);
    const card = cards.find((c) => c.id === cardId);
    const fallback = card ? listingFor(card, pricing.tiers) : { priceGold: 0, priceCash: 0, maxGold: 2 };
    return {
      gold: listing && !listing.cashOnly ? listing.priceGold : listing ? null : fallback.priceGold,
      cash: listing ? listing.priceCash : fallback.priceCash,
      maxGold: listing ? (listing.cashOnly ? 0 : listing.maxGold) : fallback.maxGold,
    };
  };

  return decks.map((deck) => {
    const loose = { gold: 0, cash: 0 };
    const goldCopies = new Map<number, number>();
    for (const c of deck.cards) {
      const p = shopPrice(c.cardId);
      const finish = (c.finish ?? "normal") as Finish;
      for (let i = 0; i < c.quantity; i++) {
        const used = goldCopies.get(c.cardId) ?? 0;
        if (p.gold != null && (used < p.maxGold || p.cash == null)) {
          loose.gold += priceWithFinish(p.gold, finish, pricing.finishPercents);
          goldCopies.set(c.cardId, used + 1);
        } else {
          loose.cash += priceWithFinish(p.cash ?? 0, finish, pricing.finishPercents);
        }
      }
    }
    const itemsCash = parsePremiumItems(deck.premiumItems).reduce(
      (sum, i) =>
        sum + ((SHOP_ITEM_KEYS as readonly string[]).includes(i.item) ? pricing.items.prices[i.item as ShopItemKey].cash * i.quantity : 0),
      0,
    );
    const premiumExtraCash = itemsCash + deck.cosmetics.reduce((sum, c) => sum + cosmeticCash(c), 0);
    const factor = 1 - deck.discountPercent / 100;
    const edition = (premium: boolean): EditionPrice => {
      const l = {
        gold: loose.gold,
        cash: loose.cash + (premium ? premiumExtraCash : 0),
      };
      const full = premium ? deck.premiumMoneyPriceCents : deck.moneyPriceCents;
      return {
        loose: l,
        price: {
          gold: roundGold(l.gold * factor),
          cash: Math.round(l.cash * factor),
        },
        discountPercent: deck.discountPercent,
        moneyFull: full,
        moneyDiscountPercent: deck.moneyDiscountPercent,
        money: full == null ? null : deck.moneyDiscountPercent > 0 ? roundMoney(full * (1 - deck.moneyDiscountPercent / 100)) : full,
      };
    };
    const base = edition(false);
    const premium = edition(true);
    // Quem já tem a Base paga só a diferença para a Premium
    const upgrade = {
      price: {
        gold: Math.max(0, premium.price.gold - base.price.gold),
        cash: Math.max(0, premium.price.cash - base.price.cash),
      },
      money: premium.money != null && base.money != null ? Math.max(0, premium.money - base.money) : null,
    };
    return { base, premium, upgrade };
  });
}

/** Qual edição o jogador tem (o upgrade conta como Premium). */
function ownedEdition(purchases: { edition: string }[]): "none" | Edition {
  if (purchases.some((p) => p.edition === "premium" || p.edition === "upgrade")) return "premium";
  return purchases.length > 0 ? "base" : "none";
}

/** Structure Decks à venda, com cartas, cosméticos da premium e quantas vezes o jogador já comprou. */
export async function listStructureDecks(userId?: string | null) {
  const [decks, purchases] = await Promise.all([
    prisma.structureDeck.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      include: {
        cards: {
          include: {
            card: {
              select: { id: true, name: true, type: true, imageUrl: true },
            },
          },
          orderBy: [{ section: "asc" }, { card: { name: "asc" } }],
        },
        cosmetics: {
          where: { active: true },
          select: {
            id: true,
            type: true,
            name: true,
            imageUrl: true,
            effect: true,
            priceCash: true,
          },
        },
      },
    }),
    userId
      ? prisma.structureDeckPurchase.findMany({
          where: { userId },
          select: { structureDeckId: true, edition: true },
        })
      : Promise.resolve([]),
  ]);

  const coverIds = decks.map((d) => d.coverCardId).filter((id): id is number => id != null);
  const covers = await prisma.card.findMany({
    where: { id: { in: coverIds } },
    select: { id: true, imageUrl: true },
  });

  const allPrices = await structurePrices(prisma, decks);

  return decks.map((deck, index) => {
    const prices = allPrices[index];
    const owned = ownedEdition(purchases.filter((p) => p.structureDeckId === deck.id));
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      coverImageUrl: covers.find((c) => c.id === deck.coverCardId)?.imageUrl ?? deck.cards[0]?.card.imageUrl ?? null,
      moneyDiscountPercent: deck.moneyDiscountPercent,
      cardCount: deck.cards.reduce((sum, c) => sum + c.quantity, 0),
      cards: deck.cards.map((c) => ({
        ...c.card,
        section: c.section,
        quantity: c.quantity,
        finish: c.finish,
      })),
      cosmetics: deck.cosmetics.map(({ priceCash: _price, ...c }) => c),
      owned, // "none" | "base" | "premium": cada deck é comprado uma vez só
      upgrade: prices.upgrade,
      premiumItems: parsePremiumItems(deck.premiumItems).map((i) => ({
        ...i,
        name: ITEMS[i.item].name,
      })),
      editions: {
        base: prices.base,
        premium: prices.premium,
      },
    };
  });
}

/**
 * Compra um Structure Deck. Tudo em uma transação:
 * - debita gold e crédito juntos (o valor avulso com o desconto do deck)
 * - adiciona as cartas à coleção (pode passar de 3 cópias; o deck é que usa no máximo 3)
 * - salva o deck pronto no Deck Builder (se houver espaço)
 * - na premium, entrega os cosméticos exclusivos (só na primeira vez: cosmético não repete)
 * Cada deck é comprado UMA vez. Quem tem a Base pode subir para a Premium pagando
 * só a diferença ("upgrade"): recebe os extras da Premium, sem repetir as cartas.
 */
export async function purchaseStructureDeck(userId: string, structureDeckId: string, order: StructureOrder, currency: StructureCurrency) {
  if (currency === "money") {
    throw new EconomyError("Pagamento em dinheiro chega em breve. Por enquanto, use gold + crédito.");
  }

  return prisma.$transaction(async (tx) => {
    const deck = await tx.structureDeck.findUnique({
      where: { id: structureDeckId },
      include: { cards: true, cosmetics: { where: { active: true } } },
    });
    if (!deck || !deck.active) throw new EconomyError("Este Structure Deck não está à venda.");

    // Uma compra por vez para este jogador e deck (dois cliques não compram duas vezes)
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`structure:${userId}:${structureDeckId}`}))) AS l`;
    const owned = ownedEdition(
      await tx.structureDeckPurchase.findMany({
        where: { userId, structureDeckId },
        select: { edition: true },
      }),
    );
    if (owned === "premium") throw new EconomyError("Você já tem este Structure Deck na versão Premium.");
    if (owned === "base" && order !== "upgrade") {
      throw new EconomyError("Você já tem este Structure Deck. Dá para subir para a Premium pagando só a diferença.");
    }
    if (owned === "none" && order === "upgrade") throw new EconomyError("Compre a versão Base primeiro, ou a Premium direto.");

    const [prices] = await structurePrices(tx, [deck]);
    const { gold, cash } = order === "upgrade" ? prices.upgrade.price : prices[order].price;

    // Débito atômico das duas moedas: só passa se houver saldo de gold E de crédito
    const before = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    const { count } = await tx.wallet.updateMany({
      where: { userId, gold: { gte: gold }, cash: { gte: cash } },
      data: { gold: { decrement: gold }, cash: { decrement: cash } },
    });
    if (count === 0) {
      const missing = [before.gold < gold ? "gold" : null, before.cash < cash ? "crédito" : null].filter(Boolean).join(" e ");
      throw new EconomyError(
        `Saldo insuficiente${missing ? ` de ${missing}` : ""}: este deck custa ${gold.toLocaleString("pt-BR")} gold + ${cash} crédito.`,
      );
    }
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

    const purchase = await tx.structureDeckPurchase.create({
      data: {
        userId,
        structureDeckId,
        edition: order,
        currency: "gold+cash",
        amountPaid: gold,
        amountCash: cash,
      },
    });
    const ref = { refType: "StructureDeckPurchase", refId: purchase.id };
    if (gold > 0) {
      await tx.currencyTransaction.create({
        data: {
          userId,
          currency: "gold",
          amount: -gold,
          balanceAfter: wallet.gold,
          reason: "structure_purchase",
          ...ref,
        },
      });
    }
    if (cash > 0) {
      await tx.currencyTransaction.create({
        data: {
          userId,
          currency: "cash",
          amount: -cash,
          balanceAfter: wallet.cash,
          reason: "structure_purchase_credit",
          ...ref,
        },
      });
    }

    const ref2 = { type: "StructureDeckPurchase", id: purchase.id };
    if (order === "upgrade") {
      const { newCosmetics, premiumItems, equipped } = await deliverPremiumExtras(tx, userId, deck, ref2, deck.name);
      const parts = [`${deck.name} agora é Premium!`];
      if (newCosmetics > 0) parts.push(`${newCosmetics} cosmético(s) exclusivo(s) em Minha conta → Personalizar.`);
      if (equipped) parts.push(`A sleeve e o playmat exclusivos foram equipados no deck "${deck.name}".`);
      if (premiumItems.length > 0) {
        parts.push(`Itens recebidos: ${premiumItems.map((i) => `${i.quantity}x ${ITEMS[i.item].name}`).join(", ")} (use na sua Maleta).`);
      }
      return { message: parts.join(" ") };
    }
    const edition: Edition = order;
    const { deckName, newCosmetics, premiumItems } = await deliverStructureDeck(tx, userId, deck, edition, ref2);

    const parts = [`${deck.name} (${edition === "premium" ? "Premium" : "Base"}) comprado!`, "As cartas foram para a sua Maleta."];
    parts.push(
      deckName
        ? `O deck "${deckName}" está pronto no Deck Builder.`
        : `Você já tem ${MAX_SAVED_DECKS} decks salvos, então o deck pronto não foi criado.`,
    );
    if (newCosmetics > 0) parts.push(`${newCosmetics} cosmético(s) exclusivo(s) em Minha conta → Personalizar.`);
    if (edition === "premium" && deckName) parts.push("A sleeve e o playmat exclusivos já estão equipados nesse deck.");
    if (premiumItems.length > 0) {
      parts.push(`Itens recebidos: ${premiumItems.map((i) => `${i.quantity}x ${ITEMS[i.item].name}`).join(", ")} (use na sua Maleta).`);
    }
    return { message: parts.join(" ") };
  }, TX_OPTIONS);
}

type Tx = Prisma.TransactionClient;
type DeckWithContents = Prisma.StructureDeckGetPayload<{
  include: { cards: true; cosmetics: true };
}>;

/**
 * Entrega o conteúdo de um Structure Deck: cartas na coleção, deck pronto no
 * Deck Builder (na Premium já com a sleeve e o playmat exclusivos), cosméticos
 * exclusivos e itens da Premium. Usada pela compra e pelos prêmios.
 */
async function deliverStructureDeck(tx: Tx, userId: string, deck: DeckWithContents, edition: Edition, ref: { type: string; id: string }) {
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
  // Cópias que vêm com raridade (ex.: Flame Wingman Secreta): todas as cópias daquela carta
  for (const c of deck.cards) {
    if (!c.finish || c.finish === "normal") continue;
    await tx.userCardVariant.upsert({
      where: {
        userId_cardId_finish_border: {
          userId,
          cardId: c.cardId,
          finish: c.finish,
          border: "none",
        },
      },
      update: { quantity: { increment: c.quantity } },
      create: {
        userId,
        cardId: c.cardId,
        finish: c.finish,
        border: "none",
        quantity: c.quantity,
      },
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
        // Premium: o deck já vem com a sleeve e o playmat exclusivos (entregues logo abaixo)
        ...(edition === "premium" && {
          sleeveId: deck.cosmetics.find((c) => c.type === "sleeve")?.id ?? null,
          playmatId: deck.cosmetics.find((c) => c.type === "playmat")?.id ?? null,
        }),
        cards: {
          create: deck.cards.map((c) => ({
            cardId: c.cardId,
            section: c.section,
            quantity: c.quantity,
          })),
        },
      },
    });
  }

  if (edition !== "premium") return { deckName, newCosmetics: 0, premiumItems: [] };
  const { newCosmetics, premiumItems } = await deliverPremiumExtras(tx, userId, deck, ref, null);
  return { deckName, newCosmetics, premiumItems };
}

/**
 * Extras da Premium: cosméticos exclusivos (não repetem) e itens (Pó do Milênio,
 * molduras). No upgrade, também equipa a sleeve e o playmat no deck pronto que a
 * Base criou (o deck com o nome do Structure Deck), se ele ainda estiver sem.
 */
async function deliverPremiumExtras(
  tx: Tx,
  userId: string,
  deck: DeckWithContents,
  ref: { type: string; id: string },
  equipDeckName: string | null,
) {
  let newCosmetics = 0;
  for (const cosmetic of deck.cosmetics) {
    const owned = await tx.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId: cosmetic.id } },
    });
    if (!owned) {
      await tx.userCosmetic.create({
        data: { userId, cosmeticId: cosmetic.id, source: "purchase" },
      });
      newCosmetics++;
    }
  }

  const premiumItems = parsePremiumItems(deck.premiumItems);
  for (const { item, quantity } of premiumItems) {
    await grantItem(userId, item, quantity, "structure_premium", ref, tx);
  }

  let equipped = false;
  if (equipDeckName) {
    const sleeveId = deck.cosmetics.find((c) => c.type === "sleeve")?.id ?? null;
    const playmatId = deck.cosmetics.find((c) => c.type === "playmat")?.id ?? null;
    const saved = await tx.deck.findFirst({
      where: { userId, name: equipDeckName },
    });
    if (saved && (sleeveId || playmatId)) {
      await tx.deck.update({
        where: { id: saved.id },
        data: {
          sleeveId: saved.sleeveId ?? sleeveId,
          playmatId: saved.playmatId ?? playmatId,
        },
      });
      equipped = true;
    }
  }
  return { newCosmetics, premiumItems, equipped };
}

/** Dá um Structure Deck de graça (prêmio de torneio ou envio do Admin). */
export async function grantStructureDeck(userId: string, structureDeckId: string, edition: Edition, ref: { type: string; id: string }) {
  return prisma.$transaction(async (tx) => {
    const deck = await tx.structureDeck.findUnique({
      where: { id: structureDeckId },
      include: { cards: true, cosmetics: { where: { active: true } } },
    });
    if (!deck) throw new EconomyError("Structure Deck não encontrado.");
    return deliverStructureDeck(tx, userId, deck, edition, ref);
  }, TX_OPTIONS);
}

/**
 * Cadastra um Structure Deck (para a equipe usar em scripts / seed).
 *
 * Uso típico:
 *   await createStructureDeck({
 *     name: "Fúria do Dragão", coverCardId: 89631139, discountPercent: 30,
 *     moneyPriceCents: 1990, premiumMoneyPriceCents: 3490, moneyDiscountPercent: 25,
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
  discountPercent?: number; // desconto sobre o valor das cartas avulsas (gold + crédito)
  cards: {
    cardId: number;
    section: "main" | "extra" | "side";
    quantity: number;
  }[];
}) {
  const { cards, ...deck } = data;
  return prisma.structureDeck.create({
    data: { ...deck, cards: { create: cards } },
  });
}
