import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoomAvailability, processDueReleases } from "@/lib/card-releases";
import { DUEL_ROOMS } from "@/lib/duel-rooms";
import { countWaitingByRoom, getQueueStatus, validateDeckForRooms } from "@/lib/matchmaking";

// Dados da tela Random: salas, banlists, validade do deck equipado e fila.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  await processDueReleases();
  const [{ deck, issuesByRoom }, waiting, queue, banlist, availability] = await Promise.all([
    validateDeckForRooms(userId),
    countWaitingByRoom(userId),
    getQueueStatus(userId),
    prisma.banlistEntry.findMany({
      where: { format: { in: DUEL_ROOMS.map((r) => r.id) }, status: { not: "unlimited" } },
      include: { card: { select: { name: true, imageUrl: true } } }, // imagem: a banlist é mostrada em cartas
      orderBy: { card: { name: "asc" } },
    }),
    getRoomAvailability(),
  ]);

  return NextResponse.json({
    deck: deck ? { id: deck.id, name: deck.name } : null,
    queue,
    rooms: DUEL_ROOMS.map((room) => ({
      ...room,
      waiting: waiting[room.id],
      deckIssues: issuesByRoom?.[room.id] ?? [],
      // Sala fechada: aparece com a data de abertura (ou "em breve")
      open: availability[room.id]?.open ?? true,
      opensAt: availability[room.id]?.opensAt ?? null,
      banlist: banlist
        .filter((b) => b.format === room.id)
        .map((b) => ({ cardId: b.cardId, name: b.card.name, imageUrl: b.card.imageUrl, status: b.status })),
    })),
  });
}
