import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const room = await prisma.match.findFirst({
    where: { id: params.id, players: { some: { userId } } },
    include: {
      players: {
        select: {
          userId: true,
          result: true,
          rpsChoice: true,
          user: { select: { name: true, username: true, image: true } },
        },
      },
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    id: room.id,
    status: room.status,
    currentTurn: room.currentTurn,
    currentPhase: room.currentPhase,
    meId: userId,
    rpsRound: room.rpsRound,
    rpsWinnerId: room.rpsWinnerId,
    firstPlayerId: room.firstPlayerId,
    players: room.players.map((player) => ({
      id: player.userId,
      nickname: player.user.username ?? player.user.name ?? "Duelista",
      image: player.user.image,
      result: player.result,
      choiceSubmitted: Boolean(player.rpsChoice),
      rpsChoice:
        room.status === "choosing" || room.status === "active"
          ? player.rpsChoice
          : undefined,
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const room = await tx.match.findFirst({
      where: {
        id: params.id,
        status: "waiting",
        players: { some: { userId } },
      },
      include: { players: true },
    });
    if (!room || room.players.length !== 1) return false;

    await tx.matchPlayer.deleteMany({ where: { matchId: room.id } });
    await tx.match.delete({ where: { id: room.id } });
    return true;
  });

  if (!cancelled) {
    return NextResponse.json(
      { error: "A busca já terminou e não pode mais ser cancelada." },
      { status: 409 }
    );
  }

  return NextResponse.json({ cancelled: true });
}
