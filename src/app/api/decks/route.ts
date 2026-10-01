import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BAN_STATUS_INFO, ROOM_BANLISTS, mostPermissiveCopies, type BanStatus } from "@/lib/banlist-shared";
import { deckSaveSchema } from "@/lib/validation";
import { validateDeck } from "@/lib/validate-deck";
import { DeckAppearanceError, validateDeckAppearance } from "@/lib/deck-appearance";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const decks = await prisma.deck.findMany({
    where: { userId: (session.user as { id: string }).id },
    include: { cards: { include: { card: true } } },
    orderBy: [{ isEquipped: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(decks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const parsed = deckSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id, name, cards, sleeveId, playmatId } = parsed.data;

  // Sleeve/playmat do deck: só itens que o jogador possui
  let appearance;
  try {
    appearance = await validateDeckAppearance(userId, { sleeveId, playmatId });
  } catch (err) {
    if (err instanceof DeckAppearanceError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }

  const duplicateName = await prisma.deck.findFirst({
    where: { userId, name, ...(id ? { id: { not: id } } : {}) },
  });
  if (duplicateName) {
    return NextResponse.json(
      { error: "Você já possui um deck com esse nome." },
      { status: 409 }
    );
  }

  if (!id && (await prisma.deck.count({ where: { userId } })) >= 20) {
    return NextResponse.json(
      { error: "Você atingiu o limite de 20 decks salvos." },
      { status: 422 }
    );
  }

  // Salvar aceita o deck se ele vale em alguma sala (a fila confere a sala escolhida)
  const roomEntries = await prisma.banlistEntry.findMany({
    where: { format: { in: ROOM_BANLISTS.map((r) => r.id) }, cardId: { in: cards.map((c) => c.cardId) } },
    select: { cardId: true, format: true, status: true },
  });
  const banlist = [...new Set(roomEntries.map((e) => e.cardId))].map((cardId) => {
    const copies = mostPermissiveCopies(roomEntries.filter((e) => e.cardId === cardId));
    const status = (Object.keys(BAN_STATUS_INFO) as BanStatus[]).find((s) => BAN_STATUS_INFO[s].copies === copies) ?? "unlimited";
    return { cardId, status };
  });
  const ownerships = await prisma.userCardOwnership.findMany({ where: { userId } });

  const issues = validateDeck(
    cards,
    banlist,
    ownerships.map((o) => ({ cardId: o.cardId, quantity: o.quantity })),
    { formatLabel: "banlist das salas" }
  );
  const blockingErrors = issues.filter((i) => i.level === "error");
  if (blockingErrors.length > 0) {
    return NextResponse.json({ error: "Deck inválido.", issues }, { status: 422 });
  }

  const cardData = cards.map((c) => ({
    cardId: c.cardId,
    section: c.section,
    quantity: c.quantity,
  }));

  const deck = await prisma.$transaction(async (tx) => {
    await tx.deck.updateMany({
      where: { userId, isEquipped: true },
      data: { isEquipped: false },
    });

    if (id) {
      const ownedDeck = await tx.deck.findFirst({ where: { id, userId } });
      if (!ownedDeck) throw new Error("DECK_NOT_FOUND");
      await tx.deckCard.deleteMany({ where: { deckId: id } });
      return tx.deck.update({
        where: { id },
        data: { name, isEquipped: true, ...appearance, cards: { create: cardData } },
        include: { cards: { include: { card: true } } },
      });
    }

    return tx.deck.create({
      data: {
        name,
        userId,
        isEquipped: true,
        ...appearance,
        cards: { create: cardData },
      },
      include: { cards: { include: { card: true } } },
    });
  });

  return NextResponse.json(deck, { status: 201 });
}
