import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  await prisma.matchPlayer.updateMany({
    where: { matchId: params.id, userId },
    data: { lastSeenAt: new Date() },
  });

  let room = await prisma.match.findFirst({
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

  if (
    room.status === "rps" &&
    room.rpsDeadline &&
    room.rpsDeadline.getTime() <= Date.now()
  ) {
    const submitted = room.players.filter((player) => player.rpsChoice);

    if (submitted.length === 1) {
      room = await prisma.match.update({
        where: { id: room.id },
        data: {
          status: "choosing",
          currentPhase: "choosing_order",
          rpsWinnerId: submitted[0].userId,
          rpsDeadline: null,
        },
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
    } else if (submitted.length === 0) {
      room = await prisma.$transaction(async (tx) => {
        await tx.matchPlayer.updateMany({
          where: { matchId: room!.id },
          data: { rpsChoice: null },
        });
        return tx.match.update({
          where: { id: room!.id },
          data: {
            rpsRound: { increment: 1 },
            rpsDeadline: new Date(Date.now() + 15_000),
          },
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
      });
    }
  }

  type StoredPlayerState = {
    deck: number[];
    hand: number[];
    extra: number[];
  };
  const storedState = room.engineState as
    | { players?: Record<string, StoredPlayerState> }
    | null;
  const ownState = storedState?.players?.[userId];
  const opponentPlayer = room.players.find((player) => player.userId !== userId);
  const opponentState = opponentPlayer
    ? storedState?.players?.[opponentPlayer.userId]
    : undefined;
  const handCards = ownState
    ? await prisma.card.findMany({ where: { id: { in: ownState.hand } } })
    : [];
  const handById = new Map(handCards.map((card) => [card.id, card]));

  return NextResponse.json({
    id: room.id,
    status: room.status,
    currentTurn: room.currentTurn,
    currentPhase: room.currentPhase,
    meId: userId,
    rpsRound: room.rpsRound,
    rpsDeadline: room.rpsDeadline?.toISOString() ?? null,
    rpsWinnerId: room.rpsWinnerId,
    firstPlayerId: room.firstPlayerId,
    game:
      room.status === "active" && ownState
        ? {
            ownHand: ownState.hand
              .map((cardId) => handById.get(cardId))
              .filter(Boolean),
            ownDeckCount: ownState.deck.length,
            ownExtraCount: ownState.extra.length,
            opponentHandCount: opponentState?.hand.length ?? 0,
            opponentDeckCount: opponentState?.deck.length ?? 0,
            opponentExtraCount: opponentState?.extra.length ?? 0,
          }
        : null,
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
  }, { headers: NO_CACHE_HEADERS });
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
