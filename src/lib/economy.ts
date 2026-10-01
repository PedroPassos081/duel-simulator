import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActivePromos, promoPrice } from "@/lib/card-releases";
import { CREDIT_LABEL, canBuyNextWithGold, goldCopyLimit } from "@/lib/shop-rules";
import { FINISHES, priceWithVariant, upgradeCost, variantLabel, type Border, type Finish, type Variant } from "@/lib/card-finish";
import { getShopPricing } from "@/lib/site-settings";
import { addClanBonus } from "@/lib/clans/service";

// Regra da loja: ninguém compra mais de 3 cópias de uma carta; as 2 primeiras
// podem ser em gold e a 3ª só em crédito (ver shop-rules.ts). Cartas marcadas
// como cashOnly só podem ser compradas com crédito.
export const MAX_COPIES_PURCHASABLE = 3;

type Currency = "gold" | "cash";

export class EconomyError extends Error {}

/**
 * Concede (ou debita, se amount for negativo) moeda a um usuário, de forma
 * atômica e idempotente por (refType, refId, reason).
 *
 * Uso típico: grantCurrency(userId, "gold", 100, "match_win", "Match", matchId)
 */
export async function grantCurrency(
  userId: string,
  currency: Currency,
  amount: number,
  reason: string,
  refType?: string,
  refId?: string
) {
  return prisma.$transaction(async (tx) => {
    // idempotência: se já existe uma transação com essa combinação, não repete
    if (refType && refId) {
      const existing = await tx.currencyTransaction.findUnique({
        where: {
          refType_refId_reason_userId: { refType, refId, reason, userId },
        },
      });
      if (existing) return existing;
    }

    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const currentBalance = currency === "gold" ? wallet.gold : wallet.cash;
    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      throw new EconomyError(`Saldo insuficiente de ${currency} para usuário ${userId}`);
    }

    await tx.wallet.update({
      where: { userId },
      data: currency === "gold" ? { gold: newBalance } : { cash: newBalance },
    });

    return tx.currencyTransaction.create({
      data: {
        userId,
        currency,
        amount,
        balanceAfter: newBalance,
        reason,
        refType,
        refId,
      },
    });
  });
}

/**
 * Concede as recompensas de gold ao fim de uma partida.
 * Chamado apenas pelo servidor de duelo (nunca pelo cliente).
 * O clã de cada jogador recebe +10% no cofre, sem tirar do jogador.
 */
export async function grantMatchRewards(
  matchId: string,
  winnerUserId: string,
  loserUserId: string,
  goldForWin: number,
  goldForLoss: number
) {
  const ref = { type: "Match", id: matchId };
  await grantCurrency(winnerUserId, "gold", goldForWin, "match_win", ref.type, ref.id);
  await grantCurrency(loserUserId, "gold", goldForLoss, "match_loss", ref.type, ref.id);
  await addClanBonus(winnerUserId, "gold", goldForWin, "match_bonus", ref);
  await addClanBonus(loserUserId, "gold", goldForLoss, "match_bonus", ref);
}

/**
 * Premiação em gold ou crédito para um jogador (torneios, eventos...).
 * Assim como no Random, o clã dele recebe +10% no cofre.
 */
export async function grantPrize(
  userId: string,
  currency: Currency,
  amount: number,
  refType: string,
  refId: string
) {
  await grantCurrency(userId, currency, amount, "prize", refType, refId);
  await addClanBonus(userId, currency, amount, "prize_bonus", { type: refType, id: refId });
}

/**
 * Compra uma carta na loja, validando: saldo suficiente, limite total de cópias
 * da carta e limite de cópias em gold (ver shop-rules.ts). Tudo dentro de uma única
 * transação de banco para evitar condição de corrida (double purchase).
 */
async function purchaseCardInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  cardId: number,
  currency: Currency,
  finish: Finish = "normal",
  border: Border = "none"
) {
  const listing = await tx.shopListing.findUnique({ where: { cardId }, include: { card: { select: { released: true } } } });
  if (!listing || !listing.active || !listing.card.released) {
    throw new EconomyError("Carta não disponível na loja.");
  }

  const currencyLabel = currency === "gold" ? "gold" : CREDIT_LABEL.toLowerCase();
  // Promoção de lançamento (primeiras horas): desconto no preço base
  const promo = (await getActivePromos()).get(cardId);
  const basePrice = promoPrice(currency === "gold" ? listing.priceGold : listing.priceCash, promo);
  if (basePrice == null) {
    throw new EconomyError(`Esta carta não pode ser comprada com ${currencyLabel}.`);
  }
  // Raridade: % do preço base definida pelo Admin (padrão Rara 150%, Ultra 200%, Secreta 300%);
  // borda soma 2x (prata) ou 3x (dourada) o preço base
  const { finishPercents } = await getShopPricing(tx);
  const price = priceWithVariant(basePrice, { finish, border }, finishPercents);

  const ownership = await tx.userCardOwnership.findUnique({
    where: { userId_cardId: { userId, cardId } },
  });
  const currentQuantity = ownership?.quantity ?? 0;
  const maxTotal = Math.min(listing.maxTotal, MAX_COPIES_PURCHASABLE);
  if (currentQuantity >= maxTotal) {
    throw new EconomyError(`Limite de ${maxTotal} cópia(s) desta carta já atingido.`);
  }

  if (currency === "gold" && !canBuyNextWithGold(listing, currentQuantity)) {
    const goldLimit = goldCopyLimit(listing);
    throw new EconomyError(
      goldLimit === 0
        ? `Esta carta só pode ser comprada com ${CREDIT_LABEL.toLowerCase()}.`
        : `A ${currentQuantity + 1}ª cópia desta carta só pode ser comprada com ${CREDIT_LABEL.toLowerCase()}.`
    );
  }

  const wallet = await tx.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  const currentBalance = currency === "gold" ? wallet.gold : wallet.cash;
  if (currentBalance < price) {
    throw new EconomyError(`Saldo de ${currencyLabel} insuficiente.`);
  }

  const newBalance = currentBalance - price;
  await tx.wallet.update({
    where: { userId },
    data: currency === "gold" ? { gold: newBalance } : { cash: newBalance },
  });

  const purchase = await tx.purchase.create({
    data: { userId, cardId, currencyUsed: currency, amountPaid: price, finish, border },
  });

  await tx.currencyTransaction.create({
    data: {
      userId,
      currency,
      amount: -price,
      balanceAfter: newBalance,
      reason: "shop_purchase",
      refType: "Purchase",
      refId: purchase.id,
    },
  });

  await tx.userCardOwnership.upsert({
    where: { userId_cardId: { userId, cardId } },
    update: { quantity: { increment: 1 } },
    create: { userId, cardId, quantity: 1 },
  });

  // Uma cópia só: para ter as 3 com raridade, compra (ou evolui) cada uma
  if (finish !== "normal" || border !== "none") {
    await tx.userCardVariant.upsert({
      where: { userId_cardId_finish_border: { userId, cardId, finish, border } },
      update: { quantity: { increment: 1 } },
      create: { userId, cardId, finish, border, quantity: 1 },
    });
  }

  return purchase;
}

export async function purchaseCard(
  userId: string,
  cardId: number,
  currency: Currency,
  finish: Finish = "normal",
  border: Border = "none"
) {
  // banco remoto: mais prazo que o padrão de 5 s
  return prisma.$transaction((tx) => purchaseCardInTx(tx, userId, cardId, currency, finish, border), {
    maxWait: 10_000,
    timeout: 20_000,
  });
}

/**
 * Compra em massa: várias cópias numa transação só. Se uma falhar (saldo, limite
 * de cópias...), nada é comprado e o erro diz qual carta travou.
 */
export async function purchaseCards(
  userId: string,
  items: { cardId: number; finish: Finish; border: Border }[],
  currency: Currency
) {
  return prisma.$transaction(
    async (tx) => {
      let total = 0;
      for (const item of items) {
        try {
          const purchase = await purchaseCardInTx(tx, userId, item.cardId, currency, item.finish, item.border);
          total += purchase.amountPaid;
        } catch (err) {
          if (!(err instanceof EconomyError)) throw err;
          const card = await tx.card.findUnique({ where: { id: item.cardId }, select: { name: true } });
          throw new EconomyError(`${card?.name ?? "Carta"}: ${err.message} Nada foi comprado.`);
        }
      }
      return { count: items.length, total };
    },
    { maxWait: 10_000, timeout: 90_000 }
  );
}

/**
 * Sobe a raridade de uma cópia que o jogador já tem, pagando só a diferença de
 * preço entre a raridade nova e a atual. A cópia continua a mesma (e a borda também).
 */
export async function upgradeCardFinish(userId: string, cardId: number, from: Variant, to: Finish, currency: Currency) {
  if (FINISHES[to].rank <= FINISHES[from.finish].rank) {
    throw new EconomyError("Escolha uma raridade acima da que a cópia já tem.");
  }
  return prisma.$transaction(
    async (tx) => {
      const listing = await tx.shopListing.findUnique({ where: { cardId }, include: { card: { select: { name: true } } } });
      if (!listing || !listing.active) throw new EconomyError("Carta não disponível na loja.");
      const currencyLabel = currency === "gold" ? "gold" : CREDIT_LABEL.toLowerCase();
      const basePrice = currency === "gold" ? listing.priceGold : listing.priceCash;
      if (basePrice == null) throw new EconomyError(`Esta carta não pode ser paga com ${currencyLabel}.`);

      const { finishPercents } = await getShopPricing(tx);
      const price = upgradeCost(basePrice, from.finish, to, finishPercents);

      // Tira 1 cópia da versão atual
      const ownership = await tx.userCardOwnership.findUnique({ where: { userId_cardId: { userId, cardId } } });
      if (!ownership || ownership.quantity < 1) throw new EconomyError("Você não tem essa carta.");
      const isNormal = from.finish === "normal" && from.border === "none";
      if (isNormal) {
        const evolved = await tx.userCardVariant.aggregate({ where: { userId, cardId }, _sum: { quantity: true } });
        if (ownership.quantity - (evolved._sum.quantity ?? 0) < 1) throw new EconomyError("Você não tem cópia Normal dessa carta.");
      } else {
        const { count } = await tx.userCardVariant.updateMany({
          where: { userId, cardId, finish: from.finish, border: from.border, quantity: { gte: 1 } },
          data: { quantity: { decrement: 1 } },
        });
        if (count === 0) throw new EconomyError(`Você não tem cópia ${variantLabel(from)} dessa carta.`);
        await tx.userCardVariant.deleteMany({ where: { userId, cardId, quantity: { lte: 0 } } });
      }

      // Cobra a diferença
      await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
      const { count: paid } = await tx.wallet.updateMany({
        where: { userId, [currency]: { gte: price } },
        data: { [currency]: { decrement: price } },
      });
      if (paid === 0) throw new EconomyError(`Saldo de ${currencyLabel} insuficiente.`);
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      await tx.currencyTransaction.create({
        data: { userId, currency, amount: -price, balanceAfter: wallet[currency], reason: "rarity_upgrade", refType: "Card", refId: `${cardId}:${Date.now()}` },
      });

      // Põe a cópia na raridade nova (a borda continua)
      const target = { finish: to, border: from.border };
      await tx.userCardVariant.upsert({
        where: { userId_cardId_finish_border: { userId, cardId, ...target } },
        update: { quantity: { increment: 1 } },
        create: { userId, cardId, ...target, quantity: 1 },
      });

      return {
        price,
        currency,
        message: `${listing.card.name} evoluiu de ${variantLabel(from)} para ${variantLabel(target)} por ${price} ${currencyLabel}.`,
      };
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
}
