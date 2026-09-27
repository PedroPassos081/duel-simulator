import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { EconomyError } from "@/lib/economy";
import { listStructureDecks, purchaseStructureDeck } from "@/lib/structure-decks";

const purchaseSchema = z.object({
  structureDeckId: z.string().min(1),
  edition: z.enum(["base", "premium"]),
  currency: z.enum(["cash", "gold", "money"]),
});

async function getUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

export async function GET() {
  return NextResponse.json(await listStructureDecks(await getUserId()));
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = purchaseSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    const { structureDeckId, edition, currency } = parsed.data;
    return NextResponse.json(await purchaseStructureDeck(userId, structureDeckId, edition, currency));
  } catch (err) {
    if (err instanceof EconomyError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Erro ao processar a compra." }, { status: 500 });
  }
}
