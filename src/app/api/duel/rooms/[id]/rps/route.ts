import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  choice: z.enum(["rock", "paper", "scissors"]),
});

const beats = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
} as const;

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
    return NextResponse.json({ error: "Escolha inválida." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const room = await tx.match.findFirst({
      where: { id: params.id, status: "rps", players: { some: { userId } } },
      include: { players: true },
    });
    if (!room || room.players.length !== 2) return null;

    await tx.matchPlayer.update({
      where: { matchId_userId: { matchId: room.id, userId } },
      data: { rpsChoice: parsed.data.choice },
    });
    const players = await tx.matchPlayer.findMany({
      where: { matchId: room.id },
    });
    if (!players.every((player) => player.rpsChoice)) {
      return { status: "rps" };
    }

    const [first, second] = players;
    if (first.rpsChoice === second.rpsChoice) {
      await tx.matchPlayer.updateMany({
        where: { matchId: room.id },
        data: { rpsChoice: null },
      });
      await tx.match.update({
        where: { id: room.id },
        data: { rpsRound: { increment: 1 } },
      });
      return { status: "tie" };
    }

    const winner =
      beats[first.rpsChoice as keyof typeof beats] === second.rpsChoice
        ? first
        : second;
    await tx.match.update({
      where: { id: room.id },
      data: {
        status: "choosing",
        currentPhase: "choosing_order",
        rpsWinnerId: winner.userId,
      },
    });
    return { status: "choosing", winnerId: winner.userId };
  });

  if (!result) {
    return NextResponse.json(
      { error: "Sala indisponível para esta escolha." },
      { status: 409 }
    );
  }
  return NextResponse.json(result);
}
