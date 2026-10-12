import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMyBracketMatch } from "@/lib/brackets";

export const dynamic = "force-dynamic";

// Duelo de torneio (chaves) do jogador agora: o aviso no topo do site
export async function GET() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return NextResponse.json(null);
  return NextResponse.json(await getMyBracketMatch(userId));
}
