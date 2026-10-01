import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saleSchema } from "@/lib/validation";
import { EconomyError } from "@/lib/economy";
import { getSellableCollection, sellCards } from "@/lib/card-sales";

async function currentUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

/** Cartas do jogador que podem ser vendidas e a % atual da venda. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json(await getSellableCollection(userId));
}

/** Vende uma ou várias cópias (tudo ou nada). */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = saleSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Venda inválida." }, { status: 400 });

  try {
    return NextResponse.json(await sellCards(userId, parsed.data.items));
  } catch (err) {
    if (err instanceof EconomyError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Erro ao processar a venda." }, { status: 500 });
  }
}
