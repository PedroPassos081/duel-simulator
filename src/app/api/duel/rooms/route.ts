import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateDeck } from "@/lib/validate-deck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const deck = await prisma.deck.findFirst({
    where: { userId, isEquipped: true },
    include: { cards: true },
  });
  if (!deck) {
    return NextResponse.json(
      { error: "Equipe um deck antes de procurar um duelo." },
      { status: 400 }
    );
  }

  const [banlist, ownerships] = await Promise.all([
    prisma.banlistEntry.findMany({ where: { format: deck.format } }),
    prisma.userCardOwnership.findMany({ where: { userId } }),
  ]);
  const issues = validateDeck(
    deck.cards.map((card) => ({
      cardId: card.cardId,
      section: card.section as "main" | "extra" | "side",
      quantity: card.quantity,
    })),
    banlist.map((entry) => ({
      cardId: entry.cardId,
      status: entry.status as "forbidden" | "limited" | "semi-limited" | "unlimited",
    })),
    ownerships.map((entry) => ({
      cardId: entry.cardId,
      quantity: entry.quantity,
    }))
  );
  const errors = issues.filter((issue) => issue.level === "error");
  if (errors.length) {
    return NextResponse.json(
      { error: "O deck equipado é inválido.", issues: errors },
      { status: 400 }
    );
  }

  const room = await prisma.$transaction(async (tx) => {
    const waiting = await tx.match.findFirst({
      where: {
        status: "waiting",
        format: deck.format,
        players: { none: { userId } },
      },
      orderBy: { createdAt: "asc" },
      include: { players: true },
    });

    if (waiting && waiting.players.length === 1) {
      await tx.matchPlayer.create({
        data: { matchId: waiting.id, userId, deckId: deck.id },
      });
      return tx.match.update({
        where: { id: waiting.id },
        data: {
          status: "rps",
          currentPhase: "rps",
        },
        include: { players: true },
      });
    }

    return tx.match.create({
      data: {
        format: deck.format,
        players: { create: { userId, deckId: deck.id } },
      },
      include: { players: true },
    });
  });

  return NextResponse.json({
    roomId: room.id,
    status: room.status,
    playerCount: room.players.length,
  });
}
