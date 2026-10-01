import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { BanlistError, createBanlist, listBanlists } from "@/lib/banlists";

// Aba Banlists do Admin: todas as banlists (salas e torneios)
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  return NextResponse.json(await listBanlists());
}

const createSchema = z.object({
  name: z.string().trim().min(3).max(60),
  description: z.string().trim().max(300).nullable().optional(),
  copyFrom: z.string().nullable().optional(),
});

// POST: nova banlist (ex.: de um torneio), vazia ou copiando outra
export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dê um nome à banlist (mínimo 3 letras)." }, { status: 400 });
  try {
    return NextResponse.json({ id: await createBanlist(parsed.data) }, { status: 201 });
  } catch (err) {
    if (err instanceof BanlistError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
