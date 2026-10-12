import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MatchmakingError, getQueueStatus, joinTournamentQueue, leaveQueue } from "@/lib/matchmaking";

async function currentUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

// Consulta (e mantém viva) a vaga na sala do torneio
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json(await getQueueStatus(userId, { tournamentId: params.id }));
}

// Entra na sala do torneio (o duelo começa quando outro inscrito estiver aguardando)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    return NextResponse.json(await joinTournamentQueue(userId, params.id));
  } catch (err) {
    if (err instanceof MatchmakingError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}

// Sai da sala
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  await leaveQueue(userId);
  return NextResponse.json({ status: "idle" });
}
