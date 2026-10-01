import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdmin } from "@/lib/admin-server";

// Listas para os formulários do Admin: clãs (envio por clã), Structure Decks (prêmio) e banlists (torneio)
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const [clans, structures, banlists] = await Promise.all([
    prisma.clan.findMany({ select: { id: true, name: true, _count: { select: { members: true } } }, orderBy: { name: "asc" } }),
    prisma.structureDeck.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.banlist.findMany({ select: { id: true, name: true, kind: true }, orderBy: [{ kind: "asc" }, { createdAt: "asc" }] }),
  ]);
  return NextResponse.json({ clans: clans.map((c) => ({ id: c.id, name: c.name, members: c._count.members })), structures, banlists });
}
