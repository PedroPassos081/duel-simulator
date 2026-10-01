import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdmin } from "@/lib/admin-server";
import { TournamentError, createTournament, tournamentPhase } from "@/lib/tournaments";
import { tournamentSchema } from "./schema";

// Torneios (Admin): lista e criação
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startsAt: "desc" },
    take: 30,
    include: { _count: { select: { entries: true, matches: true, series: true } }, stages: true },
  });
  return NextResponse.json(tournaments.map((t) => ({ ...t, phase: tournamentPhase(t) })));
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = tournamentSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json(await createTournament(admin.id, parsed.data), { status: 201 });
  } catch (err) {
    if (err instanceof TournamentError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
