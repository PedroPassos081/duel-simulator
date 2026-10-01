import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { getShopPricing, setFinishPercents, setItemShop, setTierPrices } from "@/lib/site-settings";
import { PRICE_TIERS } from "@/lib/card-prices";

// Preços configuráveis da loja (só Admin)
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const pricing = await getShopPricing();
  const tierLabels = Object.fromEntries(Object.entries(PRICE_TIERS).map(([k, t]) => [k, t.label]));
  return NextResponse.json({ ...pricing, tierLabels });
}

const price = z.number().int().min(0).max(10_000_000);
const pricingSchema = z.object({
  finishPercents: z.object({ rara: z.number().int(), ultra: z.number().int(), secreta: z.number().int() }).optional(),
  tiers: z.record(z.object({ gold: price, cash: price })).optional(),
  items: z
    .object({
      prices: z.record(z.object({ cash: price, moneyCents: price })),
      moneyDiscountPercent: z.number().int().min(0).max(90),
    })
    .optional(),
});

export async function PUT(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });

  const parsed = pricingSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Valores inválidos." }, { status: 400 });

  try {
    const { finishPercents, tiers, items } = parsed.data;
    if (finishPercents) await setFinishPercents(finishPercents, admin.id);
    if (tiers) await setTierPrices({ ...(await getShopPricing()).tiers, ...tiers }, admin.id);
    if (items) await setItemShop(items as never, admin.id);
    return NextResponse.json(await getShopPricing());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
}
