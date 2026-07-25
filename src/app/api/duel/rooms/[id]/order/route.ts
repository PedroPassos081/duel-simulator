import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ goFirst: z.boolean() });

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

  await prisma.match.update({
    where: { id: room.id },
    data: {
      status: "active",
      startedAt: new Date(),
      currentTurn: 1,
      currentPhase: "draw",
      firstPlayerId,
    },
  });

  return NextResponse.json({ status: "active", firstPlayerId });
}
