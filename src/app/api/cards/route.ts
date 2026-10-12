import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROOM_BANLISTS } from "@/lib/banlist-shared";
import { getPools, isInPool } from "@/lib/card-pools";
import { auth } from "@/lib/auth";
import { getBestVariants } from "@/lib/collection";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const ownerships = await prisma.userCardOwnership.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      ...(q ? { card: { name: { contains: q, mode: "insensitive" } } } : {}),
    },
    orderBy: { card: { name: "asc" } },
    // Sem busca: a coleção inteira (o Deck Builder filtra no navegador)
    take: q ? 50 : undefined,
    include: {
      card: {
        include: {
          banlistEntries: { where: { format: { in: ROOM_BANLISTS.map((r) => r.id) } }, select: { format: true, status: true } },
          shopListing: { select: { maxTotal: true } }, // limite de cópias da loja
        },
      },
    },
  });

  // Melhor versão (Rara, Secreta...) de cada carta, para o Deck Builder mostrar o brilho
  const [best, pools] = await Promise.all([
    getBestVariants(userId, ownerships.map((o) => o.cardId)),
    getPools(ROOM_BANLISTS.map((r) => r.id)),
  ]);

  return NextResponse.json(
    ownerships.map(({ card: { shopListing, ...card }, quantity }) => ({
      ...card,
      maxTotal: shopListing?.maxTotal,
      ownedQuantity: quantity,
      bestVariant: best.get(card.id),
      // Salas em que a carta existe (pool de cada sala)
      rooms: ROOM_BANLISTS.map((r) => r.id).filter((room) => isInPool(card, pools.get(room)!)),
    }))
  );
}
