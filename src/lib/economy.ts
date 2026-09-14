import { prisma } from "@/lib/prisma";

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
 */
export async function grantMatchRewards(
  matchId: string,
  winnerUserId: string,
  loserUserId: string,
  goldForWin: number,
  goldForLoss: number
) {
  await grantCurrency(winnerUserId, "gold", goldForWin, "match_win", "Match", matchId);
  await grantCurrency(loserUserId, "gold", goldForLoss, "match_loss", "Match", matchId);
}

/**
 * Compra uma carta na loja, validando: moeda permitida, saldo suficiente e os
 * limites (maxTotal/maxGold/maxCash) configurados na própria listagem. Tudo
 * dentro de uma única transação de banco para evitar condição de corrida
 * (double purchase).
 */
export async function purchaseCard(userId: string, cardId: number, currency: Currency) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.shopListing.findUnique({ where: { cardId } });
    if (!listing || !listing.active) {
      throw new EconomyError("Carta não disponível na loja.");
    }

    if (listing.cashOnly && currency !== "cash") {
      throw new EconomyError("Esta carta só pode ser comprada com cash.");
    }

    const price = currency === "gold" ? listing.priceGold : listing.priceCash;
    if (price == null) {
      throw new EconomyError(`Esta carta não pode ser comprada com ${currency}.`);
    }

    const ownership = await tx.userCardOwnership.findUnique({
      where: { userId_cardId: { userId, cardId } },
    });
    const currentQuantity = ownership?.quantity ?? 0;
    if (currentQuantity >= listing.maxTotal) {
      throw new EconomyError(
        `Limite de ${listing.maxTotal} cópias desta carta já atingido.`
      );
    }

    const currencyLimit = currency === "gold" ? listing.maxGold : listing.maxCash;
    const currencyPurchases = await tx.purchase.count({
      where: { userId, cardId, currencyUsed: currency },
    });
    if (currencyPurchases >= currencyLimit) {
      throw new EconomyError(
        `Limite de ${currencyLimit} cópias desta carta via ${currency} já atingido.`
      );
    }

    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    const currentBalance = currency === "gold" ? wallet.gold : wallet.cash;
    if (currentBalance < price) {
      throw new EconomyError(`Saldo de ${currency} insuficiente.`);
    }

    const newBalance = currentBalance - price;
    await tx.wallet.update({
      where: { userId },
      data: currency === "gold" ? { gold: newBalance } : { cash: newBalance },
    });

    const purchase = await tx.purchase.create({
      data: { userId, cardId, currencyUsed: currency, amountPaid: price },
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

    return purchase;
  });
}
