import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { TournamentError, getTournament, joinTournament, leaveTournament } from "@/lib/tournaments";
import { getBracketView, processBrackets } from "@/lib/brackets";

async function currentUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

// Detalhes e classificação
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = await getTournament(params.id, await currentUserId());
  if (!t) return NextResponse.json({ error: "Torneio não encontrado." }, { status: 404 });
  const { rawPrizes, ...rest } = t;
  void rawPrizes; // só o Admin precisa do formato cru dos prêmios
  // Chaves: o chaveamento com placares (e o torneio anda: abre duelos, aplica W.O.)
  if (t.structure === "bracket") {
    await processBrackets();
    return NextResponse.json({ ...rest, bracket: await getBracketView(params.id) });
  }
  return NextResponse.json(rest);
}

const actionSchema = z.object({ action: z.enum(["join", "leave"]) });

// Inscrever-se ou sair
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Entre na sua conta para participar." }, { status: 401 });
  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  try {
    return NextResponse.json(parsed.data.action === "join" ? await joinTournament(userId, params.id) : await leaveTournament(userId, params.id));
  } catch (err) {
    if (err instanceof TournamentError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
