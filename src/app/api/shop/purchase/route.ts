import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bulkPurchaseSchema, purchaseSchema } from "@/lib/validation";
import { purchaseCard, purchaseCards, EconomyError } from "@/lib/economy";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();

  // Compra em massa: { currency, items: [...] }
  if (Array.isArray(body?.items)) {
    const bulk = bulkPurchaseSchema.safeParse(body);
    if (!bulk.success) return NextResponse.json({ error: "Compra inválida." }, { status: 400 });
    try {
      return NextResponse.json(await purchaseCards(userId, bulk.data.items, bulk.data.currency), { status: 201 });
    } catch (err) {
      if (err instanceof EconomyError) return NextResponse.json({ error: err.message }, { status: 422 });
      console.error(err);
      return NextResponse.json({ error: "Erro ao processar compra." }, { status: 500 });
    }
  }

  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { cardId, currency, finish, border } = parsed.data;
    const purchase = await purchaseCard(userId, cardId, currency, finish, border);
    return NextResponse.json(purchase, { status: 201 });
  } catch (err) {
    if (err instanceof EconomyError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao processar compra." }, { status: 500 });
  }
}
