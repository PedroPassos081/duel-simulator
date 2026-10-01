import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ChallengeError, claimChallenge, getChallenges } from "@/lib/challenges";

export const dynamic = "force-dynamic";

async function currentUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

// Desafios diários e missões do jogador
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  return NextResponse.json(await getChallenges(userId));
}

// Resgatar um desafio ou missão concluída
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = z.object({ key: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Desafio inválido." }, { status: 400 });
  try {
    return NextResponse.json(await claimChallenge(userId, parsed.data.key));
  } catch (err) {
    if (err instanceof ChallengeError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
