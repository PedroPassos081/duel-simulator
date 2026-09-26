import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EconomyError } from "@/lib/economy";
import { equipCosmetic, isCosmeticType } from "@/lib/cosmetics";
import { equipCosmeticSchema } from "@/lib/validation";

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const parsed = equipCosmeticSchema.safeParse(await req.json());
  if (!parsed.success || !isCosmeticType(parsed.data.type)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    await equipCosmetic(userId, parsed.data.type, parsed.data.cosmeticId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof EconomyError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao equipar item." }, { status: 500 });
  }
}
