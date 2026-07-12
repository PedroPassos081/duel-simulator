import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { purchaseSchema } from "@/lib/validation";
import { purchaseCard, EconomyError } from "@/lib/economy";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const purchase = await purchaseCard(userId, parsed.data.cardId, parsed.data.currency);
    return NextResponse.json(purchase, { status: 201 });
  } catch (err) {
    if (err instanceof EconomyError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao processar compra." }, { status: 500 });
  }
}
