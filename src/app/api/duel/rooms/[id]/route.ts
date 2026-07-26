import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDuelGameState } from "@/lib/duel/game-state";
import { getOcgDuelSessionSnapshot } from "@/lib/duel/ocgcore-session";

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

  const storedState = isDuelGameState(room.engineState)
    ? room.engineState
    : null;
  const ownState = storedState?.players[userId];
  const opponentPlayer = room.players.find((player) => player.userId !== userId);
  const opponentState = opponentPlayer
    ? storedState?.players[opponentPlayer.userId]
    : undefined;
  const visibleCardIds = ownState
    ? [
        ...ownState.hand,
        ...ownState.monsters.map((entry) => entry.cardId),
        ...ownState.spellTraps.map((entry) => entry.cardId),
        ...(opponentState?.monsters
          .filter((entry) => !entry.position.startsWith("face_down"))
          .map((entry) => entry.cardId) ?? []),
        ...(opponentState?.spellTraps
          .filter((entry) => !entry.position.startsWith("face_down"))
          .map((entry) => entry.cardId) ?? []),
      ]
    : [];
  const visibleCards = ownState
    ? await prisma.card.findMany({ where: { id: { in: visibleCardIds } } })
    : [];
  const cardById = new Map(visibleCards.map((card) => [card.id, card]));
  const isYourTurn = storedState?.turnPlayerId === userId;
  const inMainPhase = ["main1", "main2"].includes(room.currentPhase);
  const legalActions: Record<string, string[]> = {};
  if (ownState) {
    for (const cardId of ownState.hand) {
      const card = cardById.get(cardId);
      if (!card) continue;
      const type = card.type.toLowerCase();
      const monster = !type.includes("spell") && !type.includes("trap");
      const actions: string[] = [];
      if (isYourTurn && inMainPhase && !storedState?.chain) {
        if (
          monster &&
          !ownState.normalSummoned &&
          ownState.monsters.length < 5
        ) {
          actions.push("summon", "set_monster");
        }
        if (!monster && ownState.spellTraps.length < 5) {
          actions.push("set_spell_trap");
          if (type.includes("spell")) {
            actions.unshift("activate");
          }
        }
      }
      legalActions[String(cardId)] = actions;
    }
  }

  const fieldView = (
    entries: NonNullable<typeof ownState>["monsters"],
    revealFaceDown: boolean
  ) =>
    entries.map((entry) => {
      const faceDown = entry.position.startsWith("face_down");
      return {
        card: !faceDown || revealFaceDown ? cardById.get(entry.cardId) : undefined,
        faceDown,
        position: entry.position,
        zone: entry.zone,
      };
    });

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
    ocgCore: getOcgDuelSessionSnapshot(room.id),
    game:
      room.status === "active" && ownState
        ? {
            ownHand: ownState.hand
              .map((cardId) => cardById.get(cardId))
              .filter(Boolean),
            ownMonsters: fieldView(ownState.monsters, true),
            ownSpellTraps: fieldView(ownState.spellTraps, true),
            opponentMonsters: opponentState
              ? fieldView(opponentState.monsters, false)
              : [],
            opponentSpellTraps: opponentState
              ? fieldView(opponentState.spellTraps, false)
              : [],
            ownDeckCount: ownState.deck.length,
            ownExtraCount: ownState.extra.length,
            opponentHandCount: opponentState?.hand.length ?? 0,
            opponentDeckCount: opponentState?.deck.length ?? 0,
            opponentExtraCount: opponentState?.extra.length ?? 0,
            isYourTurn,
            currentTurn: storedState.turn,
            currentPhase: room.currentPhase,
            legalActions,
            chain: storedState.chain
              ? {
                  card:
                    cardById.get(
                      storedState.chain.links[
                        storedState.chain.links.length - 1
                      ].cardId
                    ) ?? null,
                  linkCount: storedState.chain.links.length,
                  awaitingYou: storedState.chain.awaitingPlayerId === userId,
                  controllerId:
                    storedState.chain.links[
                      storedState.chain.links.length - 1
                    ].playerId,
                }
              : null,
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
