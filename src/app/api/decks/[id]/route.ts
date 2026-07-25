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
