import { prisma } from "@/lib/prisma";
import { grantCurrency, grantPrize } from "@/lib/economy";
import { grantCosmetic } from "@/lib/cosmetics";
import { grantItem } from "@/lib/collection";
import { grantStructureDeck } from "@/lib/structure-decks";
import { COSMETIC_TYPES, NAME_EFFECTS } from "@/lib/cosmetic-types";
import { ITEMS, NORMAL_VARIANT, variantKey, variantLabel, type ItemKey, type Variant } from "@/lib/card-finish";

export class AdminGrantError extends Error {}

export const GRANT_REASONS = {
  prize: { label: "Prêmio", hint: "Gold/crédito de prêmio rende +10% ao clã do jogador" },
  event: { label: "Evento", hint: "Recompensa de evento" },
  compensation: { label: "Compensação", hint: "Manutenção, erro, reembolso" },
  gift: { label: "Presente", hint: "Presente da equipe" },
} as const;

export type GrantReason = keyof typeof GRANT_REASONS;

export type GrantPayload =
  | { kind: "currency"; currency: "gold" | "cash"; amount: number }
  | { kind: "card"; cardId: number; quantity: number; variant: Variant }
  | { kind: "cosmetic"; cosmeticId: string }
  | { kind: "item"; itemKey: ItemKey; quantity: number }
  | { kind: "structure"; structureDeckId: string; edition: "base" | "premium" }
  | { kind: "vip"; days: number };

/** Para quem vai o envio: @jogadores, todos os jogadores ou os membros de um clã. */
export type GrantTarget = { mode: "users"; input: string } | { mode: "all" } | { mode: "clan"; clanId: string };

/** Encontra os jogadores pelos @usuários (separados por vírgula, espaço ou linha). */
export async function resolveRecipients(input: string) {
  const usernames = [...new Set(input.split(/[\s,;]+/).map((u) => u.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];
  if (usernames.length === 0) throw new AdminGrantError("Informe pelo menos um @usuário.");
  if (usernames.length > 100) throw new AdminGrantError("Máximo de 100 jogadores por envio.");

  const users = await prisma.user.findMany({ where: { username: { in: usernames } }, select: { id: true, username: true } });
  const missing = usernames.filter((u) => !users.some((x) => x.username === u));
  if (missing.length > 0) throw new AdminGrantError(`Jogador(es) não encontrado(s): ${missing.map((u) => `@${u}`).join(", ")}`);
  return users;
}

async function describe(payload: GrantPayload) {
  switch (payload.kind) {
    case "currency":
      return `${payload.amount} ${payload.currency === "gold" ? "gold" : "crédito"}`;
    case "card": {
      const card = await prisma.card.findUnique({ where: { id: payload.cardId }, select: { name: true } });
      if (!card) throw new AdminGrantError("Carta não encontrada.");
      return `${payload.quantity}x ${card.name} (${variantLabel(payload.variant)})`;
    }
    case "cosmetic": {
      const cosmetic = await prisma.cosmetic.findUnique({ where: { id: payload.cosmeticId }, select: { name: true, type: true } });
      if (!cosmetic) throw new AdminGrantError("Cosmético não encontrado.");
      const type = COSMETIC_TYPES.find((t) => t.type === cosmetic.type)?.label ?? cosmetic.type;
      return `${type}: ${cosmetic.name}`;
    }
    case "item":
      return `${payload.quantity}x ${ITEMS[payload.itemKey].name}`;
    case "vip":
      return `VIP por ${payload.days} dia${payload.days === 1 ? "" : "s"}`;
    case "structure": {
      const deck = await prisma.structureDeck.findUnique({ where: { id: payload.structureDeckId }, select: { name: true } });
      if (!deck) throw new AdminGrantError("Structure Deck não encontrado.");
      return `Structure Deck ${deck.name} (${payload.edition === "premium" ? "Premium" : "Base"})`;
    }
  }
}

/** Descrição curta de um prêmio (usada no histórico e nos torneios). */
export const describeReward = describe;

async function deliver(userId: string, payload: GrantPayload, reason: GrantReason, grantId: string) {
  const ref = { type: "AdminGrant", id: grantId };
  switch (payload.kind) {
    case "currency":
      // Prêmio segue a regra do clã (+10% no cofre); o resto entra só na carteira
      if (reason === "prize") return grantPrize(userId, payload.currency, payload.amount, ref.type, ref.id);
      return grantCurrency(userId, payload.currency, payload.amount, `admin_${reason}`, ref.type, ref.id);

    case "card":
      return prisma.$transaction(async (tx) => {
        await tx.userCardOwnership.upsert({
          where: { userId_cardId: { userId, cardId: payload.cardId } },
          update: { quantity: { increment: payload.quantity } },
          create: { userId, cardId: payload.cardId, quantity: payload.quantity },
        });
        // Cópias evoluídas ficam registradas na versão escolhida
        if (variantKey(payload.variant) !== variantKey(NORMAL_VARIANT)) {
          const { finish, border } = payload.variant;
          await tx.userCardVariant.upsert({
            where: { userId_cardId_finish_border: { userId, cardId: payload.cardId, finish, border } },
            update: { quantity: { increment: payload.quantity } },
            create: { userId, cardId: payload.cardId, finish, border, quantity: payload.quantity },
          });
        }
      });

    case "cosmetic":
      return grantCosmetic(userId, payload.cosmeticId, reason === "prize" || reason === "event" ? "reward" : "grant");

    case "item":
      return grantItem(userId, payload.itemKey, payload.quantity, reason === "prize" || reason === "event" ? reason : "admin", ref);

    case "structure":
      return grantStructureDeck(userId, payload.structureDeckId, payload.edition, ref);

    case "vip": {
      // Soma os dias ao VIP que o jogador já tem (ou começa agora)
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { vipUntil: true } });
      const from = user.vipUntil && user.vipUntil > new Date() ? user.vipUntil : new Date();
      return prisma.user.update({ where: { id: userId }, data: { vipUntil: new Date(from.getTime() + payload.days * 86_400_000) } });
    }
  }
}

/**
 * Entrega um prêmio a um jogador e registra no histórico do Admin
 * (usado pelos envios e pela premiação dos torneios).
 */
export async function deliverReward(adminId: string, userId: string, payload: GrantPayload, reason: GrantReason, note?: string) {
  const summary = await describe(payload);
  const grant = await prisma.adminGrant.create({
    data: { adminId, targetUserId: userId, kind: payload.kind, summary, reason, note: note || null },
  });
  await deliver(userId, payload, reason, grant.id);
  return summary;
}

/** Jogadores de um destino: @usuários, todos ou os membros de um clã. */
export async function resolveTarget(target: GrantTarget) {
  if (target.mode === "users") return resolveRecipients(target.input);
  if (target.mode === "clan") {
    const clan = await prisma.clan.findUnique({
      where: { id: target.clanId },
      select: { name: true, members: { select: { user: { select: { id: true, username: true } } } } },
    });
    if (!clan) throw new AdminGrantError("Clã não encontrado.");
    if (clan.members.length === 0) throw new AdminGrantError("Esse clã não tem membros.");
    return clan.members.map((m) => m.user);
  }
  // Todos: contas verificadas (quem já pode jogar)
  const users = await prisma.user.findMany({ where: { emailVerified: { not: null } }, select: { id: true, username: true } });
  if (users.length === 0) throw new AdminGrantError("Nenhum jogador encontrado.");
  return users;
}

/** Envia algo para um ou mais jogadores e registra no histórico. */
export async function sendToPlayers(adminId: string, target: GrantTarget | string, payload: GrantPayload, reason: GrantReason, note?: string) {
  const users = await resolveTarget(typeof target === "string" ? { mode: "users", input: target } : target);
  const summary = await describe(payload);

  for (const user of users) {
    const grant = await prisma.adminGrant.create({
      data: { adminId, targetUserId: user.id, kind: payload.kind, summary, reason, note: note || null },
    });
    await deliver(user.id, payload, reason, grant.id);
  }

  const who =
    typeof target !== "string" && target.mode === "all"
      ? `todos os ${users.length} jogadores`
      : users.length === 1
        ? `@${users[0].username}`
        : `${users.length} jogadores`;
  return { message: `Enviado: ${summary} para ${who}.` };
}

/** Cria um item de personalização no catálogo (para depois enviar ou vender). */
export async function createCosmetic(data: {
  type: string;
  name: string;
  description?: string;
  imageUrl?: string;
  effect?: string;
  rarity?: string;
}) {
  if (!COSMETIC_TYPES.some((t) => t.type === data.type)) throw new AdminGrantError("Tipo de cosmético inválido.");
  if (data.type === "name_style") {
    if (!NAME_EFFECTS.some((e) => e.id === data.effect)) throw new AdminGrantError("Escolha o efeito do estilo de nick.");
  } else if (!data.imageUrl) {
    throw new AdminGrantError("Informe o link da imagem do cosmético.");
  }
  return prisma.cosmetic.create({
    data: {
      type: data.type,
      name: data.name,
      description: data.description || null,
      imageUrl: data.type === "name_style" ? null : data.imageUrl,
      effect: data.type === "name_style" ? data.effect : null,
      rarity: data.rarity ?? "common",
    },
  });
}

/** Dados da página de Admin: catálogo de cosméticos e últimos envios. */
export async function getAdminData() {
  const [cosmetics, grants] = await Promise.all([
    prisma.cosmetic.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, type: true, name: true, imageUrl: true, effect: true, rarity: true, structureDeckId: true },
    }),
    prisma.adminGrant.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const userIds = [...new Set(grants.flatMap((g) => [g.adminId, g.targetUserId]))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } });
  const name = (id: string) => (id === "system" ? "Sistema" : users.find((u) => u.id === id)?.username ?? "?");

  return {
    cosmetics,
    grants: grants.map((g) => ({
      id: g.id,
      kind: g.kind,
      summary: g.summary,
      reason: g.reason,
      note: g.note,
      admin: name(g.adminId),
      target: name(g.targetUserId),
      createdAt: g.createdAt.toISOString(),
    })),
  };
}
