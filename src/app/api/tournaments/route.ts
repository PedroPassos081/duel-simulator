import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTournaments } from "@/lib/tournaments";

// Torneios abertos e os últimos finalizados
export async function GET() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  return NextResponse.json(await listTournaments(userId));
}
