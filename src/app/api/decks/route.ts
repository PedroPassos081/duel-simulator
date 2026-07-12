import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deckSaveSchema } from "@/lib/validation";
import { validateDeck } from "@/lib/validate-deck";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const decks = await prisma.deck.findMany({
    where: { userId: (session.user as { id: string }).id },
    include: { cards: true },
    orderBy: { updatedAt: "desc" },
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
  const { name, cards } = parsed.data;

  const banlist = await prisma.banlistEntry.findMany({ where: { format: "edison" } });
  const ownerships = await prisma.userCardOwnership.findMany({ where: { userId } });

  const issues = validateDeck(
    cards,
    banlist.map((b) => ({ cardId: b.cardId, status: b.status as any })),
    ownerships.map((o) => ({ cardId: o.cardId, quantity: o.quantity }))
  );
  const blockingErrors = issues.filter((i) => i.level === "error");
  if (blockingErrors.length > 0) {
    return NextResponse.json({ error: "Deck inválido.", issues }, { status: 422 });
  }

  const deck = await prisma.deck.create({
    data: {
      name,
      userId,
      cards: {
        create: cards.map((c) => ({
          cardId: c.cardId,
          section: c.section,
          quantity: c.quantity,
        })),
      },
    },
    include: { cards: true },
  });

  return NextResponse.json(deck, { status: 201 });
}
