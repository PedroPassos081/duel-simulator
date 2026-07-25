import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const deck = await prisma.deck.findUnique({
    where: { id: params.id },
    include: { cards: { include: { card: true } } },
  });

  if (!deck || deck.userId !== (session.user as { id: string }).id) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  return NextResponse.json(deck);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const deck = await prisma.deck.findUnique({ where: { id: params.id } });
  if (!deck || deck.userId !== userId) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  await prisma.deck.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const deck = await prisma.deck.findFirst({ where: { id: params.id, userId } });
  if (!deck) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  const equipped = await prisma.$transaction(async (tx) => {
    await tx.deck.updateMany({ where: { userId }, data: { isEquipped: false } });
    return tx.deck.update({
      where: { id: deck.id },
      data: { isEquipped: true },
      include: { cards: { include: { card: true } } },
    });
  });

  return NextResponse.json(equipped);
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  if ((await prisma.deck.count({ where: { userId } })) >= 20) {
    return NextResponse.json(
      { error: "Você atingiu o limite de 20 decks salvos." },
      { status: 422 }
    );
  }

  const source = await prisma.deck.findFirst({
    where: { id: params.id, userId },
    include: { cards: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  const existingNames = new Set(
    (await prisma.deck.findMany({ where: { userId }, select: { name: true } }))
      .map((deck) => deck.name.toLowerCase())
  );
  let copyName = `${source.name} - Cópia`;
  let copyNumber = 2;
  while (existingNames.has(copyName.toLowerCase())) {
    copyName = `${source.name} - Cópia (${copyNumber++})`;
  }

  const duplicate = await prisma.deck.create({
    data: {
      name: copyName,
      userId,
      format: source.format,
      isEquipped: false,
      cards: {
        create: source.cards.map((card) => ({
          cardId: card.cardId,
          section: card.section,
          quantity: card.quantity,
        })),
      },
    },
    include: { cards: { include: { card: true } } },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
