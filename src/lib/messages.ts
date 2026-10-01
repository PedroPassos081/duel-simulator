import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";

export const MESSAGE_MAX_LENGTH = 1000;
const THREAD_SIZE = 60;
const CLAN_CHAT_SIZE = 60;
// Evita flood: no máximo 5 mensagens a cada 10 segundos por jogador
const FLOOD_WINDOW_MS = 10_000;
const FLOOD_MAX = 5;
// Quem pode apagar mensagens de outros no chat do clã
const CLAN_MODERATORS = ["leader", "vice"];

export class MessageError extends Error {}
const FLOOD_ERROR = "Calma! Muitas mensagens seguidas, espere alguns segundos.";

type UserWithAvatar = Parameters<typeof toAvatarProps>[0] & { id: string };

function toPerson(user: UserWithAvatar) {
  return { userId: user.id, username: user.username, avatar: toAvatarProps(user), playerName: toPlayerNameProps(user) };
}
export type PersonView = ReturnType<typeof toPerson>;

function cleanBody(body: string) {
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) throw new MessageError("Escreva uma mensagem.");
  if (text.length > MESSAGE_MAX_LENGTH) throw new MessageError(`Máximo de ${MESSAGE_MAX_LENGTH} caracteres.`);
  return text;
}

async function checkSender(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedUntil: true } });
  if (!user) throw new MessageError("Conta não encontrada.");
  if (user.suspendedUntil && user.suspendedUntil > new Date()) throw new MessageError("Sua conta está suspensa e não pode enviar mensagens.");
}

/** Encontra um jogador pelo @nick (o "ID" público de cada um). */
export async function findByHandle(handle: string) {
  const username = handle.trim().replace(/^@/, "").toLowerCase();
  if (!username) return null;
  return prisma.user.findUnique({ where: { username }, select: { id: true, ...userAvatarSelect } });
}

// ---------------------------------------------------------------------------
// MENSAGENS PRIVADAS
// ---------------------------------------------------------------------------

export async function sendDirectMessage(senderId: string, toHandle: string, body: string) {
  const text = cleanBody(body);
  await checkSender(senderId);
  const recipient = await findByHandle(toHandle);
  if (!recipient) throw new MessageError("Jogador não encontrado. Confira o @nick.");
  if (recipient.id === senderId) throw new MessageError("Você não pode mandar mensagem para você mesmo.");

  const since = new Date(Date.now() - FLOOD_WINDOW_MS);
  if ((await prisma.directMessage.count({ where: { senderId, createdAt: { gt: since } } })) >= FLOOD_MAX) throw new MessageError(FLOOD_ERROR);

  // Horário do servidor (o mesmo usado no controle de flood)
  const message = await prisma.directMessage.create({ data: { senderId, recipientId: recipient.id, body: text, createdAt: new Date() } });
  return { id: message.id, mine: true, body: message.body, createdAt: message.createdAt.toISOString(), read: false };
}

/** Conversas do jogador: com quem, a última mensagem e quantas não lidas. */
export async function listConversations(userId: string) {
  const recent = await prisma.directMessage.findMany({
    where: { OR: [{ senderId: userId }, { recipientId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { senderId: true, recipientId: true, body: true, createdAt: true },
  });
  const last = new Map<string, (typeof recent)[number]>();
  for (const m of recent) {
    const partner = m.senderId === userId ? m.recipientId : m.senderId;
    if (!last.has(partner)) last.set(partner, m);
  }
  const partnerIds = [...last.keys()];
  const [users, unread] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: partnerIds } }, select: { id: true, ...userAvatarSelect } }),
    prisma.directMessage.groupBy({ by: ["senderId"], where: { recipientId: userId, readAt: null }, _count: { _all: true } }),
  ]);
  const unreadBy = new Map(unread.map((u) => [u.senderId, u._count._all]));

  return partnerIds
    .map((id) => {
      const user = users.find((u) => u.id === id);
      const m = last.get(id)!;
      if (!user) return null;
      return {
        partner: toPerson(user),
        lastMessage: { body: m.body.slice(0, 120), mine: m.senderId === userId, createdAt: m.createdAt.toISOString() },
        unread: unreadBy.get(id) ?? 0,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}

/** Conversa com um jogador (as últimas mensagens). Marca como lidas as que ele mandou. */
export async function getThread(userId: string, partnerHandle: string) {
  const partner = await findByHandle(partnerHandle);
  if (!partner) throw new MessageError("Jogador não encontrado.");
  if (partner.id === userId) throw new MessageError("Essa é a sua conta.");

  const between = {
    OR: [
      { senderId: userId, recipientId: partner.id },
      { senderId: partner.id, recipientId: userId },
    ],
  };
  const messages = await prisma.directMessage.findMany({ where: between, orderBy: { createdAt: "desc" }, take: THREAD_SIZE });
  await prisma.directMessage.updateMany({ where: { senderId: partner.id, recipientId: userId, readAt: null }, data: { readAt: new Date() } });

  return {
    partner: toPerson(partner),
    messages: messages.reverse().map((m) => ({
      id: m.id,
      mine: m.senderId === userId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      read: m.readAt !== null,
    })),
  };
}

export async function countUnreadMessages(userId: string) {
  return prisma.directMessage.count({ where: { recipientId: userId, readAt: null } });
}

// ---------------------------------------------------------------------------
// CHAT DO CLÃ (privado: só membros)
// ---------------------------------------------------------------------------

async function membership(userId: string) {
  const member = await prisma.clanMember.findUnique({ where: { userId }, select: { clanId: true, role: true } });
  if (!member) throw new MessageError("Você não está em um clã.");
  return member;
}

export async function getClanChat(userId: string) {
  const { clanId, role } = await membership(userId);
  const messages = await prisma.clanMessage.findMany({
    where: { clanId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: CLAN_CHAT_SIZE,
    include: { user: { select: { id: true, role: true, ...userAvatarSelect } } },
  });
  const canModerate = CLAN_MODERATORS.includes(role);
  return {
    canModerate,
    messages: messages.reverse().map((m) => ({
      id: m.id,
      author: toPerson(m.user),
      authorRole: m.user.role,
      mine: m.userId === userId,
      canDelete: m.userId === userId || canModerate,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function postClanMessage(userId: string, body: string) {
  const text = cleanBody(body);
  await checkSender(userId);
  const { clanId } = await membership(userId);
  const since = new Date(Date.now() - FLOOD_WINDOW_MS);
  if ((await prisma.clanMessage.count({ where: { userId, createdAt: { gt: since } } })) >= FLOOD_MAX) throw new MessageError(FLOOD_ERROR);
  await prisma.clanMessage.create({ data: { clanId, userId, body: text, createdAt: new Date() } });
}

/** Apaga uma mensagem do chat do clã: a sua, ou qualquer uma se você for líder/vice. */
export async function deleteClanMessage(userId: string, messageId: string) {
  const { clanId, role } = await membership(userId);
  const message = await prisma.clanMessage.findUnique({ where: { id: messageId } });
  if (!message || message.clanId !== clanId || message.deletedAt) throw new MessageError("Mensagem não encontrada.");
  if (message.userId !== userId && !CLAN_MODERATORS.includes(role)) throw new MessageError("Só o líder e o vice apagam mensagens de outros.");
  await prisma.clanMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
}
