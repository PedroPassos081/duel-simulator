import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { AdminGrantError, createCosmetic } from "@/lib/admin-grants";

const cosmeticSchema = z.object({
  type: z.string().min(1),
  name: z.string().trim().min(2, "Dê um nome ao cosmético.").max(60),
  description: z.string().trim().max(200).optional(),
  imageUrl: z.string().trim().regex(/^https:\/\/\S+$/, "A imagem precisa ser um link https://").optional().or(z.literal("")),
  effect: z.string().optional(),
  rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
});

// Cria um cosmético no catálogo
export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });

  const parsed = cosmeticSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  try {
    const cosmetic = await createCosmetic({ ...parsed.data, imageUrl: parsed.data.imageUrl || undefined });
    return NextResponse.json({ message: `Cosmético "${cosmetic.name}" criado.`, id: cosmetic.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AdminGrantError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
