import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ITEMS,
  NORMAL_VARIANT,
  applyItem,
  bestVariant,
  variantKey,
  variantLabel,
  type Border,
  type Finish,
  type ItemKey,
  type Variant,
} from "@/lib/card-finish";

export class CollectionError extends Error {}

type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

export type ItemReason = "prize" | "event" | "structure_premium" | "deposit" | "evolve" | "admin" | "purchase";

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

async function moveItem(tx: Tx, userId: string, itemKey: ItemKey, amount: number, reason: ItemReason, ref?: { type: string; id: string }) {
  if (amount < 0) {
    const { count } = await tx.userItem.updateMany({
      where: { userId, itemKey, quantity: { gte: -amount } },
      data: { quantity: { increment: amount } },
    });
    if (count === 0) throw new CollectionError(`Você não tem ${ITEMS[itemKey].name}.`);
  } else {
    await tx.userItem.upsert({
      where: { userId_itemKey: { userId, itemKey } },
      update: { quantity: { increment: amount } },
      create: { userId, itemKey, quantity: amount },
    });
  }
  await tx.itemTransaction.create({
    data: { userId, itemKey, amount, reason, refType: ref?.type, refId: ref?.id },
  });
}

/**
 * Entrega itens a um jogador: prêmios de torneio/ranking/season, eventos,
 * bônus de depósito, Structure Deck Premium ou presente do Admin.
 *
 * Uso típico: await grantItem(userId, "po_milenio_raro", 2, "prize", { type: "Competition", id })
 */
export async function grantItem(
  userId: string,
  itemKey: ItemKey,
  quantity: number,
  reason: ItemReason,
  ref?: { type: string; id: string },
  tx?: Tx
) {
  if (quantity <= 0) return;
  if (tx) return moveItem(tx, userId, itemKey, quantity, reason, ref);
  return prisma.$transaction((t) => moveItem(t, userId, itemKey, quantity, reason, ref));
}

// Bônus em itens por depósito de créditos (pagamento real ainda não integrado).
// Do maior para o menor valor mínimo; vale só a primeira faixa atingida.
export const DEPOSIT_ITEM_BONUSES: { minCredits: number; items: { item: ItemKey; quantity: number }[] }[] = [
  { minCredits: 1000, items: [{ item: "po_milenio_ultra", quantity: 1 }, { item: "po_milenio_raro", quantity: 2 }] },
  { minCredits: 300, items: [{ item: "po_milenio_raro", quantity: 1 }] },
];

/** Chamar quando um depósito for confirmado (webhook do Pix/cartão, no futuro). */
export async function grantDepositBonus(userId: string, credits: number, depositId: string) {
  const tier = DEPOSIT_ITEM_BONUSES.find((t) => credits >= t.minCredits);
  if (!tier) return;
  await prisma.$transaction(async (tx) => {
    for (const { item, quantity } of tier.items) {
      await moveItem(tx, userId, item, quantity, "deposit", { type: "Deposit", id: depositId });
    }
  });
}

// ---------------------------------------------------------------------------
// Coleção
// ---------------------------------------------------------------------------

/** Cartas do jogador com as versões (Normal, Rara...) de cada uma, e os itens dele. */
export async function getCollection(userId: string) {
  const [ownerships, variants, items] = await Promise.all([
    prisma.userCardOwnership.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { card: { select: { id: true, name: true, type: true, imageUrl: true } } },
      orderBy: { card: { name: "asc" } },
    }),
    prisma.userCardVariant.findMany({ where: { userId, quantity: { gt: 0 } } }),
    prisma.userItem.findMany({ where: { userId } }),
  ]);

  const cards = ownerships.map((o) => {
    const evolved = variants
      .filter((v) => v.cardId === o.cardId)
      .map((v) => ({ finish: v.finish as Finish, border: v.border as Border, quantity: v.quantity }));
    const normalCount = o.quantity - evolved.reduce((s, v) => s + v.quantity, 0);
    const copies = [...(normalCount > 0 ? [{ ...NORMAL_VARIANT, quantity: normalCount }] : []), ...evolved];
    return {
      ...o.card,
      total: o.quantity,
      copies: copies.map((c) => ({ ...c, label: variantLabel(c) })),
      best: bestVariant(copies),
    };
  });

  return {
    cards,
    items: Object.fromEntries(items.map((i) => [i.itemKey, i.quantity])) as Partial<Record<ItemKey, number>>,
  };
}

/** Melhor versão de cada carta (para o Deck Builder mostrar o brilho). */
export async function getBestVariants(userId: string, cardIds: number[]) {
  const variants = await prisma.userCardVariant.findMany({
    where: { userId, cardId: { in: cardIds }, quantity: { gt: 0 } },
  });
  const byCard = new Map<number, Variant>();
  for (const id of cardIds) {
    byCard.set(
      id,
      bestVariant(variants.filter((v) => v.cardId === id).map((v) => ({ finish: v.finish as Finish, border: v.border as Border })))
    );
  }
  return byCard;
}

/**
 * Usa um item em UMA cópia de uma carta. A cópia sai da versão `from` e vai
 * para a nova versão (ex.: Normal → Rara). Tudo numa transação.
 */
export async function evolveCard(userId: string, cardId: number, from: Variant, itemKey: ItemKey) {
  const to = applyItem(from, itemKey);
  if (!to) throw new CollectionError(`${ITEMS[itemKey].name} não pode ser usado nessa versão da carta.`);

  return prisma.$transaction(async (tx) => {
    const ownership = await tx.userCardOwnership.findUnique({ where: { userId_cardId: { userId, cardId } } });
    if (!ownership || ownership.quantity <= 0) throw new CollectionError("Você não tem essa carta.");

    // Tira 1 cópia da versão de origem
    if (variantKey(from) === variantKey(NORMAL_VARIANT)) {
      const evolved = await tx.userCardVariant.aggregate({
        where: { userId, cardId },
        _sum: { quantity: true },
      });
      if (ownership.quantity - (evolved._sum.quantity ?? 0) < 1) {
        throw new CollectionError("Você não tem cópia Normal dessa carta.");
      }
    } else {
      const { count } = await tx.userCardVariant.updateMany({
        where: { userId, cardId, finish: from.finish, border: from.border, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (count === 0) throw new CollectionError(`Você não tem cópia ${variantLabel(from)} dessa carta.`);
      await tx.userCardVariant.deleteMany({ where: { userId, cardId, quantity: { lte: 0 } } });
    }

    await moveItem(tx, userId, itemKey, -1, "evolve", { type: "Card", id: String(cardId) });

    // Coloca a cópia na nova versão
    await tx.userCardVariant.upsert({
      where: { userId_cardId_finish_border: { userId, cardId, finish: to.finish, border: to.border } },
      update: { quantity: { increment: 1 } },
      create: { userId, cardId, finish: to.finish, border: to.border, quantity: 1 },
    });

    return { to, message: `Carta evoluída para ${variantLabel(to)}!` };
  }, TX_OPTIONS);
}
