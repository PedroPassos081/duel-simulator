import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MatchmakingError, leaveMatch } from "@/lib/matchmaking";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  try {
    await leaveMatch(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MatchmakingError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
