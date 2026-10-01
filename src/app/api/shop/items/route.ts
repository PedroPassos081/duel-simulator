import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { EconomyError } from "@/lib/economy";
import { MAX_ITEMS_PER_PURCHASE, buyShopItem, isShopItemKey, listShopItems } from "@/lib/item-shop";

async function currentUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

// Pó do Milênio à venda (preços definidos pelo Admin)
export async function GET() {
  return NextResponse.json(await listShopItems(await currentUserId()));
}

const buySchema = z.object({
  itemKey: z.string().refine(isShopItemKey, "Item inválido."),
  quantity: z.number().int().min(1).max(MAX_ITEMS_PER_PURCHASE),
  currency: z.enum(["cash", "money"]),
});

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = buySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  try {
    const { itemKey, quantity, currency } = parsed.data;
    return NextResponse.json(await buyShopItem(userId, itemKey as never, quantity, currency));
  } catch (err) {
    if (err instanceof EconomyError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Erro ao comprar." }, { status: 500 });
  }
}
