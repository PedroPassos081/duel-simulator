import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { BanlistError, deleteBanlist, getBanlistEntries, getPendingChanges, setCardStatus } from "@/lib/banlists";
import { BAN_STATUSES } from "@/lib/banlist-shared";

function fail(err: unknown) {
  if (err instanceof BanlistError) return NextResponse.json({ error: err.message }, { status: 422 });
  throw err;
}

// Cartas da banlist e as mudanças ainda não anunciadas
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  try {
    const [entries, pending] = await Promise.all([getBanlistEntries(params.id), getPendingChanges(params.id)]);
    return NextResponse.json({ entries, pending });
  } catch (err) {
    return fail(err);
  }
}

const setSchema = z.object({ cardId: z.number().int().positive(), status: z.enum(BAN_STATUSES) });

// PUT: muda o status de uma carta ("unlimited" tira da lista). Vale na hora.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = setSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Carta ou status inválido." }, { status: 400 });
  try {
    return NextResponse.json(await setCardStatus(admin.id, params.id, parsed.data.cardId, parsed.data.status));
  } catch (err) {
    return fail(err);
  }
}

// DELETE: apaga uma banlist de torneio
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  try {
    await deleteBanlist(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
