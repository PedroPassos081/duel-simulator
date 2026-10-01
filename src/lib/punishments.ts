import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { clearSuspensionCache } from "@/lib/suspension";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { BORDERS, FINISHES, type Border, type Finish } from "@/lib/card-finish";

export class PunishmentError extends Error {}

export const PUNISHMENT_TYPES = {
  warning: "Advertência",
  suspension: "Suspensão",
  unsuspend: "Suspensão removida",
  remove_gold: "Gold retirado",
  remove_cash: "Crédito retirado",
  remove_cards: "Cartas retiradas",
  wipe_cards: "Cartas zeradas",
} as const;

export type PunishmentAction =
  | { type: "warning" }
  | { type: "suspension"; hours: number | null } // null = permanente
  | { type: "unsuspend" }
  | { type: "remove_gold"; amount: number }
  | { type: "remove_cash"; amount: number }
  | { type: "remove_cards"; cardId: number; quantity: number }
  | { type: "wipe_cards" };

const PERMANENT = new Date("9999-12-31T23:59:59Z");
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

// ---------------------------------------------------------------------------
// Senha de punição (ADMIN_PUNISH_PASSWORD no .env)
// ---------------------------------------------------------------------------

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60_000;
const failures = new Map<string, { count: number; lockedUntil: number }>();

const sha256 = (value: string) => createHash("sha256").update(value).digest();

function checkPunishPassword(adminId: string, password: string) {
  const expected = process.env.ADMIN_PUNISH_PASSWORD;
  if (!expected) {
    throw new PunishmentError("A senha de punição ainda não foi configurada (ADMIN_PUNISH_PASSWORD no .env).");
  }

  const state = failures.get(adminId);
  if (state && state.lockedUntil > Date.now()) {
    const minutes = Math.ceil((state.lockedUntil - Date.now()) / 60_000);
    throw new PunishmentError(`Muitas tentativas erradas. Tente de novo em ${minutes} min.`);
  }

  // Compara os hashes em tempo constante (não revela quantos caracteres batem)
  if (!timingSafeEqual(sha256(password), sha256(expected))) {
    const count = (state?.count ?? 0) + 1;
    failures.set(adminId, { count, lockedUntil: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    throw new PunishmentError(count >= MAX_FAILS ? "Senha incorreta. Punições bloqueadas por 10 min." : "Senha de punição incorreta.");
  }
  failures.delete(adminId);
}

// ---------------------------------------------------------------------------
// Aplicar punição
// ---------------------------------------------------------------------------

function formatDuration(hours: number | null) {
  if (hours === null) return "permanentemente";
  if (hours < 24) return `por ${hours} hora(s)`;
  return `por ${Math.round(hours / 24)} dia(s)`;
}

async function findTarget(username: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase().replace(/^@/, "") },
    select: { id: true, username: true, role: true, suspendedUntil: true },
  });
  if (!user) throw new PunishmentError("Jogador não encontrado.");
  if (user.role === "admin") throw new PunishmentError("Não é possível punir uma conta Admin.");
  return user;
}

export async function punishPlayer(adminId: string, username: string, action: PunishmentAction, reason: string, password: string) {
  checkPunishPassword(adminId, password);
  const target = await findTarget(username);
  const userId = target.id;

  const summary = await prisma.$transaction(async (tx) => {
    switch (action.type) {
      case "warning":
        return "Advertência";

      case "suspension": {
        const until = action.hours === null ? PERMANENT : new Date(Date.now() + action.hours * 3_600_000);
        await tx.user.update({ where: { id: userId }, data: { suspendedUntil: until, suspensionReason: reason } });
        return `Suspensa ${formatDuration(action.hours)}`;
      }

      case "unsuspend":
        if (!target.suspendedUntil || target.suspendedUntil <= new Date()) throw new PunishmentError("Esta conta não está suspensa.");
        await tx.user.update({ where: { id: userId }, data: { suspendedUntil: null, suspensionReason: null } });
        return "Suspensão removida";

      case "remove_gold":
      case "remove_cash": {
        const currency = action.type === "remove_gold" ? "gold" : "cash";
        const wallet = await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
        // Retira até o saldo que ele tem (nunca fica negativo)
        const removed = Math.min(action.amount, wallet[currency]);
        if (removed <= 0) throw new PunishmentError(`O jogador não tem ${currency === "gold" ? "gold" : "crédito"}.`);
        const updated = await tx.wallet.update({ where: { userId }, data: { [currency]: { decrement: removed } } });
        await tx.currencyTransaction.create({
          data: { userId, currency, amount: -removed, balanceAfter: updated[currency], reason: "admin_penalty" },
        });
        return `Retirados ${removed} ${currency === "gold" ? "gold" : "crédito"}`;
      }

      case "remove_cards": {
        const ownership = await tx.userCardOwnership.findUnique({
          where: { userId_cardId: { userId, cardId: action.cardId } },
          include: { card: { select: { name: true } } },
        });
        if (!ownership || ownership.quantity <= 0) throw new PunishmentError("O jogador não tem essa carta.");
        const removed = Math.min(action.quantity, ownership.quantity);
        const newTotal = ownership.quantity - removed;

        if (newTotal === 0) {
          await tx.userCardOwnership.delete({ where: { id: ownership.id } });
          await tx.userCardVariant.deleteMany({ where: { userId, cardId: action.cardId } });
        } else {
          await tx.userCardOwnership.update({ where: { id: ownership.id }, data: { quantity: newTotal } });
          // Tira primeiro as cópias Normais; se não bastar, as evoluídas de menor valor
          const variants = await tx.userCardVariant.findMany({ where: { userId, cardId: action.cardId } });
          let excess = variants.reduce((s, v) => s + v.quantity, 0) - newTotal;
          const byValue = [...variants].sort(
            (a, b) =>
              FINISHES[a.finish as Finish].rank - FINISHES[b.finish as Finish].rank ||
              BORDERS[a.border as Border].rank - BORDERS[b.border as Border].rank
          );
          for (const v of byValue) {
            if (excess <= 0) break;
            const take = Math.min(excess, v.quantity);
            if (take === v.quantity) await tx.userCardVariant.delete({ where: { id: v.id } });
            else await tx.userCardVariant.update({ where: { id: v.id }, data: { quantity: v.quantity - take } });
            excess -= take;
          }
        }
        return `Retiradas ${removed}x ${ownership.card.name}`;
      }

      case "wipe_cards": {
        const { _sum } = await tx.userCardOwnership.aggregate({ where: { userId }, _sum: { quantity: true } });
        await tx.userCardVariant.deleteMany({ where: { userId } });
        await tx.userCardOwnership.deleteMany({ where: { userId } });
        return `Cartas zeradas (${_sum.quantity ?? 0} cartas)`;
      }
    }
  }, TX_OPTIONS);

  await prisma.punishment.create({
    data: {
      userId,
      adminId,
      type: action.type,
      reason,
      summary,
      until: action.type === "suspension" ? (action.hours === null ? PERMANENT : new Date(Date.now() + action.hours * 3_600_000)) : null,
    },
  });
  clearSuspensionCache(userId);

  return { message: `${summary} — @${target.username}.` };
}

// ---------------------------------------------------------------------------
// Consulta do jogador (painel) e advertências (lado do jogador)
// ---------------------------------------------------------------------------

export async function getPlayerStatus(username: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase().replace(/^@/, "") },
    select: {
      id: true,
      role: true,
      email: true,
      createdAt: true,
      suspendedUntil: true,
      suspensionReason: true,
      wallet: { select: { gold: true, cash: true } },
      ...userAvatarSelect,
    },
  });
  if (!user) return null;

  const [cards, punishments] = await Promise.all([
    prisma.userCardOwnership.aggregate({ where: { userId: user.id }, _sum: { quantity: true }, _count: true }),
    prisma.punishment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const admins = await prisma.user.findMany({
    where: { id: { in: [...new Set(punishments.map((p) => p.adminId))] } },
    select: { id: true, username: true },
  });

  return {
    username: user.username,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    avatar: toAvatarProps(user),
    playerName: toPlayerNameProps(user),
    gold: user.wallet?.gold ?? 0,
    cash: user.wallet?.cash ?? 0,
    cardCount: cards._sum.quantity ?? 0,
    distinctCards: cards._count,
    suspendedUntil: user.suspendedUntil && user.suspendedUntil > new Date() ? user.suspendedUntil.toISOString() : null,
    suspensionReason: user.suspensionReason,
    punishments: punishments.map((p) => ({
      id: p.id,
      type: p.type,
      summary: p.summary,
      reason: p.reason,
      admin: admins.find((a) => a.id === p.adminId)?.username ?? "?",
      acknowledged: Boolean(p.acknowledgedAt),
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

/** Advertências que o jogador ainda não viu (aparecem como aviso na tela dele). */
export async function getPendingWarnings(userId: string) {
  return prisma.punishment.findMany({
    where: { userId, type: "warning", acknowledgedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, reason: true, createdAt: true },
  });
}

export async function acknowledgeWarning(userId: string, punishmentId: string) {
  await prisma.punishment.updateMany({
    where: { id: punishmentId, userId, type: "warning", acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  });
}
