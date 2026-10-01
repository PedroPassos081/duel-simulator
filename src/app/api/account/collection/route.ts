import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/collection";

// Coleção do jogador: cartas com as versões (Normal, Rara...) e os itens de evolução
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.json(await getCollection((session.user as { id: string }).id));
}
