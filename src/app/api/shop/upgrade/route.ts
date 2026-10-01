import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { EconomyError, upgradeCardFinish } from "@/lib/economy";

const upgradeSchema = z.object({
  cardId: z.number().int().positive(),
  from: z.object({ finish: z.enum(["normal", "rara", "ultra", "secreta"]), border: z.enum(["none", "prata", "ouro"]) }),
  to: z.enum(["rara", "ultra", "secreta"]),
  currency: z.enum(["gold", "cash"]),
});

// Sobe a raridade de uma cópia pagando a diferença
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = upgradeSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    const { cardId, from, to, currency } = parsed.data;
    return NextResponse.json(await upgradeCardFinish((session.user as { id: string }).id, cardId, from, to, currency));
  } catch (err) {
    if (err instanceof EconomyError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Erro ao evoluir a carta." }, { status: 500 });
  }
}
