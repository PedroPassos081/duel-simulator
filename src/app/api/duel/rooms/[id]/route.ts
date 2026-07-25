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
    players: room.players.map((player) => ({
      id: player.userId,
      nickname: player.user.username ?? player.user.name ?? "Duelista",
      image: player.user.image,
      result: player.result,
    })),
  });
}
