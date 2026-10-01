import { prisma } from "@/lib/prisma";
import { createPost } from "@/lib/news";
import { cardArt, ART } from "@/lib/card-art";

export class GoldEventError extends Error {}

export interface GoldEventInput {
  name: string;
  bonusGold: number;
  startsAt: Date;
  endsAt: Date;
}

function validate(input: GoldEventInput) {
  if (input.name.trim().length < 3) throw new GoldEventError("Dê um nome ao evento.");
  if (!Number.isInteger(input.bonusGold) || input.bonusGold < 1 || input.bonusGold > 1_000_000) {
    throw new GoldEventError("O bônus precisa ser um número inteiro de gold (1 ou mais).");
  }
  if (!(input.endsAt > input.startsAt)) throw new GoldEventError("O fim precisa ser depois do início.");
}

export async function createGoldEvent(adminId: string, input: GoldEventInput) {
  validate(input);
  return prisma.goldEvent.create({ data: { ...input, name: input.name.trim(), createdById: adminId } });
}

export async function updateGoldEvent(id: string, input: GoldEventInput) {
  validate(input);
  return prisma.goldEvent.update({ where: { id }, data: { ...input, name: input.name.trim() } });
}

export async function deleteGoldEvent(id: string) {
  await prisma.goldEvent.delete({ where: { id } });
}

export async function listGoldEvents() {
  const now = new Date();
  const events = await prisma.goldEvent.findMany({ orderBy: { startsAt: "desc" }, take: 30 });
  return events.map((e) => ({
    ...e,
    phase: now < e.startsAt ? "scheduled" : now < e.endsAt ? "running" : "ended",
  }));
}

const when = (d: Date) =>
  d.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Anúncio pronto (curto e persuasivo) para o Jornal. O Admin pode editar o
 * texto antes de publicar.
 */
export function buildAnnouncement(e: GoldEventInput) {
  const days = Math.max(1, Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 86_400_000));
  const title = `${e.name}: +${e.bonusGold.toLocaleString("pt-BR")} gold em cada duelo!`;
  const summary = `De ${when(e.startsAt)} até ${when(e.endsAt)}, todo duelo no Random paga ${e.bonusGold.toLocaleString("pt-BR")} gold a mais.`;
  const content = [
    `Duelistas, o Pote da Ganância transbordou! Durante o ${e.name}, cada duelo no Random rende +${e.bonusGold.toLocaleString("pt-BR")} gold extras, vencendo ou perdendo.`,
    `Começa: ${when(e.startsAt)}\nTermina: ${when(e.endsAt)}${days > 1 ? ` (${days} dias)` : ""}`,
    "Quanto mais você duela, mais você ganha: aproveite para completar a sua Maleta, subir a raridade das suas cartas e garantir o próximo Structure Deck.",
    "Equipe seu deck, escolha a Sala Slifer ou Obelisco e entre na fila. Nos vemos no campo de batalha!",
  ].join("\n\n");
  return { title, summary, content };
}

/** Publica o anúncio do evento no Jornal (fixado no topo enquanto o evento durar). */
export async function publishAnnouncement(adminId: string, eventId: string, text: { title: string; summary?: string; content: string }) {
  const event = await prisma.goldEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new GoldEventError("Evento não encontrado.");
  if (text.title.trim().length < 3 || text.content.trim().length < 10) throw new GoldEventError("Escreva um título e um texto para o anúncio.");
  const post = await createPost({
    type: "notice",
    title: text.title.trim(),
    summary: text.summary?.trim() || null,
    content: text.content.trim(),
    imageUrl: cardArt(ART.potOfGreed),
    pinned: true,
    authorId: adminId,
  });
  await prisma.goldEvent.update({ where: { id: eventId }, data: { newsPostId: post.id } });
  return post;
}
