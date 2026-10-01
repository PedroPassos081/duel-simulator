import { prisma } from "@/lib/prisma";
import { EconomyError } from "@/lib/economy";
import { grantItem } from "@/lib/collection";
import { ITEMS } from "@/lib/card-finish";
import { getShopPricing } from "@/lib/site-settings";
import { SHOP_ITEM_KEYS, discountedMoney, type ShopItemKey } from "@/lib/shop-pricing";
import { CREDIT_LABEL } from "@/lib/shop-rules";

export const MAX_ITEMS_PER_PURCHASE = 50;

export function isShopItemKey(value: string): value is ShopItemKey {
  return (SHOP_ITEM_KEYS as readonly string[]).includes(value);
}

/** Itens à venda (Pó do Milênio) com os preços atuais, e quantos o jogador tem. */
export async function listShopItems(userId?: string | null) {
  const [{ items }, owned] = await Promise.all([
    getShopPricing(),
    userId ? prisma.userItem.findMany({ where: { userId } }) : Promise.resolve([]),
  ]);
  return {
    moneyDiscountPercent: items.moneyDiscountPercent,
    items: SHOP_ITEM_KEYS.map((key) => {
      const price = items.prices[key];
      return {
        key,
        name: ITEMS[key].name,
        description: ITEMS[key].description,
        priceCash: price.cash,
        moneyCents: price.moneyCents,
        moneyCentsDiscounted: discountedMoney(price.moneyCents, items.moneyDiscountPercent),
        owned: owned.find((o) => o.itemKey === key)?.quantity ?? 0,
      };
    }),
  };
}

/** Compra de Pó do Milênio. Dinheiro real ainda não está integrado. */
export async function buyShopItem(userId: string, itemKey: ShopItemKey, quantity: number, currency: "cash" | "money") {
  if (currency === "money") {
    throw new EconomyError("Pagamento em dinheiro chega em breve. Por enquanto, use crédito.");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEMS_PER_PURCHASE) {
    throw new EconomyError(`Escolha de 1 a ${MAX_ITEMS_PER_PURCHASE} unidades.`);
  }

  return prisma.$transaction(
    async (tx) => {
      const { items } = await getShopPricing(tx);
      const price = items.prices[itemKey].cash * quantity;

      await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
      const { count } = await tx.wallet.updateMany({
        where: { userId, cash: { gte: price } },
        data: { cash: { decrement: price } },
      });
      if (count === 0) throw new EconomyError(`Saldo de ${CREDIT_LABEL.toLowerCase()} insuficiente.`);
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

      const ref = { type: "ItemPurchase", id: `${userId}:${itemKey}:${Date.now()}` };
      await tx.currencyTransaction.create({
        data: { userId, currency: "cash", amount: -price, balanceAfter: wallet.cash, reason: "item_purchase", refType: ref.type, refId: ref.id },
      });
      await grantItem(userId, itemKey, quantity, "purchase", ref, tx);

      return { message: `Comprado: ${quantity}x ${ITEMS[itemKey].name} por ${price} ${CREDIT_LABEL.toLowerCase()}.` };
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
}
