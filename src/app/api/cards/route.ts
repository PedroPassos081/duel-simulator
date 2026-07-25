import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
    take: 50,
    include: {
      card: { include: { banlistEntries: { where: { format: "edison" } } } },
    },
  });

  return NextResponse.json(
    ownerships.map(({ card, quantity }) => ({
      ...card,
      ownedQuantity: quantity,
    }))
  );
}
