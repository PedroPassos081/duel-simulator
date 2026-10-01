import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { BORDERS, FINISHES, ITEMS, type ItemKey } from "@/lib/card-finish";
import { CollectionError, evolveCard } from "@/lib/collection";

const evolveSchema = z.object({
  cardId: z.number().int().positive(),
  from: z.object({
    finish: z.enum(Object.keys(FINISHES) as [keyof typeof FINISHES, ...(keyof typeof FINISHES)[]]),
    border: z.enum(Object.keys(BORDERS) as [keyof typeof BORDERS, ...(keyof typeof BORDERS)[]]),
  }),
  item: z.enum(Object.keys(ITEMS) as [ItemKey, ...ItemKey[]]),
});

// Usa um item (Pó do Milênio ou moldura) em uma cópia da carta
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const parsed = evolveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const { cardId, from, item } = parsed.data;
    const result = await evolveCard((session.user as { id: string }).id, cardId, from, item);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CollectionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao evoluir a carta." }, { status: 500 });
  }
}
