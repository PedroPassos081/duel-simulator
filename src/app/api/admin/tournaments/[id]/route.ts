import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-server";
import { TournamentError, cancelTournament, finalizeTournament, getTournament, updateTournament } from "@/lib/tournaments";
import { tournamentSchema } from "../schema";

function handle(err: unknown) {
  if (err instanceof TournamentError) return NextResponse.json({ error: err.message }, { status: 422 });
  throw err;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const t = await getTournament(params.id);
  return t ? NextResponse.json(t) : NextResponse.json({ error: "Torneio não encontrado." }, { status: 404 });
}

// Editar (inclusive a premiação) enquanto não foi finalizado
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = tournamentSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json(await updateTournament(params.id, parsed.data));
  } catch (err) {
    return handle(err);
  }
}

// Finalizar: colocações, troféus, prêmios e resultado no Jornal
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  try {
    return NextResponse.json(await finalizeTournament(admin.id, params.id));
  } catch (err) {
    return handle(err);
  }
}

// Cancelar
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  try {
    await cancelTournament(params.id);
    return NextResponse.json({ message: "Torneio cancelado." });
  } catch (err) {
    return handle(err);
  }
}
