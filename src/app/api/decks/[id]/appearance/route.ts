import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeckAppearanceError, validateDeckAppearance } from "@/lib/deck-appearance";

const appearanceSchema = z.object({
  sleeveId: z.string().min(1).nullable().optional(),
  playmatId: z.string().min(1).nullable().optional(),
});

// Troca a sleeve e/ou o playmat de um deck salvo (null = padrão da conta)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const parsed = appearanceSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const deck = await prisma.deck.findFirst({ where: { id: params.id, userId }, select: { id: true } });
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  try {
    const data = await validateDeckAppearance(userId, parsed.data);
    const updated = await prisma.deck.update({ where: { id: deck.id }, data, select: { sleeveId: true, playmatId: true } });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof DeckAppearanceError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
