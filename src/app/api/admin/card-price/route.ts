import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { PricingError, getCardPrice, resetCardPrice, setCardPrice } from "@/lib/admin-pricing";

function handle(err: unknown) {
  if (err instanceof PricingError) return NextResponse.json({ error: err.message }, { status: 422 });
  throw err;
}

const cardIdOf = (req: Request) => Number(new URL(req.url).searchParams.get("cardId"));

// Preço de uma carta
export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  try {
    return NextResponse.json(await getCardPrice(cardIdOf(req)));
  } catch (err) {
    return handle(err);
  }
}

const priceSchema = z.object({
  cardId: z.number().int().positive(),
  priceGold: z.number().int().min(0).nullable(),
  priceCash: z.number().int().min(0).nullable(),
});

// Preço manual (a carta sai do "aplicar preços da categoria")
export async function PUT(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = priceSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Valores inválidos." }, { status: 400 });
  try {
    return NextResponse.json(await setCardPrice(parsed.data.cardId, parsed.data.priceGold, parsed.data.priceCash));
  } catch (err) {
    return handle(err);
  }
}

// Volta ao preço da categoria
export async function DELETE(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  try {
    return NextResponse.json(await resetCardPrice(cardIdOf(req)));
  } catch (err) {
    return handle(err);
  }
}
