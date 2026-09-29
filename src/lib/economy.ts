import { prisma } from "@/lib/prisma";
import { CREDIT_LABEL, canBuyNextWithGold, goldCopyLimit } from "@/lib/shop-rules";
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
export async function purchaseCard(userId: string, cardId: number, currency: Currency) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.shopListing.findUnique({ where: { cardId } });
    if (!listing || !listing.active) {
      throw new EconomyError("Carta não disponível na loja.");
    }

    const currencyLabel = currency === "gold" ? "gold" : CREDIT_LABEL.toLowerCase();
    const price = currency === "gold" ? listing.priceGold : listing.priceCash;
    if (price == null) {
      throw new EconomyError(`Esta carta não pode ser comprada com ${currencyLabel}.`);
    }

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
