import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { deleteSeason, SeasonError, updateSeason } from "@/lib/seasons";

const seasonSchema = z.object({ name: z.string().trim().min(2).max(60), startsAt: z.coerce.date(), endsAt: z.coerce.date() });

function fail(err: unknown) {
  if (err instanceof SeasonError) return NextResponse.json({ error: err.message }, { status: 422 });
  throw err;
}

// PUT: ajusta nome, início e fim de uma season
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = seasonSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Informe nome, início e fim." }, { status: 400 });
  try {
    return NextResponse.json(await updateSeason(params.id, parsed.data));
  } catch (err) {
    return fail(err);
  }
}

// DELETE: apaga uma season que ainda não começou
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  try {
    await deleteSeason(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
