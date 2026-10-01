import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { BattlePassError, buyPremium, claimMission, claimReward, getPassView } from "@/lib/battle-pass";

export const dynamic = "force-dynamic";

async function currentUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

// Passe de Batalha: trilhas, progresso e missões do jogador
export async function GET() {
  return NextResponse.json(await getPassView(await currentUserId()));
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), level: z.number().int().min(1).max(200), track: z.enum(["free", "premium"]), choiceId: z.string().optional() }),
  z.object({ action: z.literal("buy_premium") }),
  z.object({ action: z.literal("mission"), key: z.string().min(1) }),
]);

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  try {
    const body = parsed.data;
    if (body.action === "claim") return NextResponse.json(await claimReward(userId, body.level, body.track, body.choiceId));
    if (body.action === "buy_premium") return NextResponse.json(await buyPremium(userId));
    return NextResponse.json(await claimMission(userId, body.key));
  } catch (err) {
    if (err instanceof BattlePassError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
