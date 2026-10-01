import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdmin } from "@/lib/admin-server";
import { HIDDEN_CARD_NAMES } from "@/lib/site";

// Busca no catálogo inteiro (não só nas cartas do Admin) para enviar a jogadores
export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const cards = await prisma.card.findMany({
    where: { name: { contains: q, mode: "insensitive", notIn: HIDDEN_CARD_NAMES } },
    select: { id: true, name: true, type: true, imageUrl: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return NextResponse.json(cards);
}
