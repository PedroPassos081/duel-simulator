import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DuelPlayerState } from "@/lib/duel/game-state";

const schema = z.object({ goFirst: z.boolean() });

function shuffle(cards: number[]) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ordem inválida." }, { status: 400 });
  }

  const room = await prisma.match.findFirst({
    where: { id: params.id, status: "choosing", rpsWinnerId: userId },
    include: { players: true },
  });
  if (!room || room.players.length !== 2) {
    return NextResponse.json(
      { error: "Somente o vencedor pode escolher a ordem." },
      { status: 403 }
    );
  }
  const opponent = room.players.find((player) => player.userId !== userId)!;
  const firstPlayerId = parsed.data.goFirst ? userId : opponent.userId;
  const decks = await prisma.deck.findMany({
    where: { id: { in: room.players.map((player) => player.deckId) } },
    include: { cards: true },
  });
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const enginePlayers: Record<
    string,
    DuelPlayerState
  > = {};

  for (const player of room.players) {
    const deck = deckById.get(player.deckId);
    if (!deck) {
      return NextResponse.json(
        { error: "O deck de um dos jogadores não foi encontrado." },
        { status: 409 }
      );
    }
    const expand = (section: string) =>
      deck.cards
        .filter((entry) => entry.section === section)
        .flatMap((entry) =>
          Array.from({ length: entry.quantity }, () => entry.cardId)
        );
    const main = shuffle(expand("main"));
    enginePlayers[player.userId] = {
      hand: main.splice(0, 5),
      deck: main,
      extra: shuffle(expand("extra")),
      monsters: [],
      spellTraps: [],
      graveyard: [],
      normalSummoned: false,
    };
  }

  await prisma.match.update({
    where: { id: room.id },
    data: {
      status: "active",
      startedAt: new Date(),
      currentTurn: 1,
      currentPhase: "draw",
      firstPlayerId,
      engineState: {
        players: enginePlayers,
        turnPlayerId: firstPlayerId,
        turn: 1,
      },
    },
  });

  return NextResponse.json({ status: "active", firstPlayerId });
}
