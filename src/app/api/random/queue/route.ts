import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { DUEL_ROOMS, type DuelRoomId } from "@/lib/duel-rooms";
import { MatchmakingError, getQueueStatus, joinQueue, leaveQueue } from "@/lib/matchmaking";

const joinSchema = z.object({
  rooms: z
    .array(z.enum(DUEL_ROOMS.map((r) => r.id) as [DuelRoomId, ...DuelRoomId[]]))
    .min(1)
    .transform((rooms) => [...new Set(rooms)]),
});

async function getUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

// Consulta (e mantém viva) a vaga na fila. Chamado a cada poucos segundos.
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  return NextResponse.json(await getQueueStatus(userId));
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = joinSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Sala inválida." }, { status: 400 });
  }

  try {
    return NextResponse.json(await joinQueue(userId, parsed.data.rooms));
  } catch (err) {
    if (err instanceof MatchmakingError) {
      return NextResponse.json({ error: err.message, issuesByRoom: err.issuesByRoom }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao entrar na sala." }, { status: 500 });
  }
}

export async function DELETE() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  await leaveQueue(userId);
  return NextResponse.json({ status: "idle" });
}
