import { prisma } from "@/lib/prisma";
import { EconomyError } from "@/lib/economy";
import { COSMETIC_TYPES, type CosmeticType } from "@/lib/cosmetic-types";

export type CosmeticSource = "grant" | "raffle" | "reward" | "purchase";

export function isCosmeticType(value: string): value is CosmeticType {
  return COSMETIC_TYPES.some((t) => t.type === value);
}

/**
 * Entrega um item de personalização ao jogador (presente de admin, sorteio, prêmio de
 * evento/torneio etc.). Idempotente: se o jogador já possui o item, não duplica.
 *
 * Uso típico: grantCosmetic(userId, cosmeticId, "reward")
 */
export async function grantCosmetic(userId: string, cosmeticId: string, source: CosmeticSource) {
  return prisma.userCosmetic.upsert({
    where: { userId_cosmeticId: { userId, cosmeticId } },
    update: {},
    create: { userId, cosmeticId, source },
  });
}

/**
 * Vende um item de personalização, debitando gold ou crédito da carteira na
 * mesma transação em que o item é entregue.
 */
export async function purchaseCosmetic(
  userId: string,
  cosmeticId: string,
  currency: "gold" | "cash"
) {
  return prisma.$transaction(async (tx) => {
    const cosmetic = await tx.cosmetic.findUnique({ where: { id: cosmeticId } });
    if (!cosmetic || !cosmetic.active || !cosmetic.inShop) {
      throw new EconomyError("Item não disponível.");
    }
    // Vitrine trancada até a data marcada pelo Admin
    if (cosmetic.shopUnlockAt && cosmetic.shopUnlockAt > new Date()) {
      throw new EconomyError(`Este item libera em ${cosmetic.shopUnlockAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
    }

    const price = currency === "gold" ? cosmetic.priceGold : cosmetic.priceCash;
    if (price == null) {
      throw new EconomyError("Este item não está à venda nesta moeda.");
    }

    const owned = await tx.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId } },
    });
    if (owned) {
      throw new EconomyError("Você já possui este item.");
    }

    const wallet = await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
    const balance = currency === "gold" ? wallet.gold : wallet.cash;
    if (balance < price) {
      throw new EconomyError("Saldo insuficiente.");
    }

    const newBalance = balance - price;
    await tx.wallet.update({
      where: { userId },
      data: currency === "gold" ? { gold: newBalance } : { cash: newBalance },
    });

    const userCosmetic = await tx.userCosmetic.create({
      data: { userId, cosmeticId, source: "purchase" },
    });

    await tx.currencyTransaction.create({
      data: {
        userId,
        currency,
        amount: -price,
        balanceAfter: newBalance,
        reason: "cosmetic_purchase",
        refType: "UserCosmetic",
        refId: userCosmetic.id,
      },
    });

    return userCosmetic;
  });
}

/**
 * Equipa um item que o jogador possui (ou volta ao padrão, com cosmeticId null).
 */
export async function equipCosmetic(userId: string, type: CosmeticType, cosmeticId: string | null) {
  if (cosmeticId === null) {
    await prisma.userEquippedCosmetic.deleteMany({ where: { userId, type } });
    return null;
  }

  const owned = await prisma.userCosmetic.findUnique({
    where: { userId_cosmeticId: { userId, cosmeticId } },
    include: { cosmetic: true },
  });
  if (!owned || owned.cosmetic.type !== type) {
    throw new EconomyError("Você não possui este item.");
  }

  return prisma.userEquippedCosmetic.upsert({
    where: { userId_type: { userId, type } },
    update: { cosmeticId },
    create: { userId, type, cosmeticId },
  });
}
