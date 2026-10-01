import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { listShopCosmetics } from "@/lib/battle-pass";
import { purchaseCosmetic } from "@/lib/cosmetics";
import { EconomyError } from "@/lib/economy";

async function currentUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

// Vitrine de cosméticos da loja (trancados até a data marcada pelo Admin)
export async function GET() {
  return NextResponse.json(await listShopCosmetics(await currentUserId()));
}

// Compra com crédito
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = z.object({ cosmeticId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Item inválido." }, { status: 400 });
  try {
    await purchaseCosmetic(userId, parsed.data.cosmeticId, "cash");
    return NextResponse.json({ message: "Comprado! Equipe em Minha conta → Personalizar." });
  } catch (err) {
    if (err instanceof EconomyError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
