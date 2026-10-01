import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { TournamentError } from "@/lib/tournaments";
import { activateBracket, generateBracket, getBracketView, pauseBracket, processBrackets, updateBracketSettings } from "@/lib/brackets";

// Torneio em chaves (Admin): ver as chaves, sortear, ativar, pausar e mudar horários/vagas
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  await processBrackets();
  return NextResponse.json(await getBracketView(params.id));
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate") }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({
    action: z.literal("settings"),
    stages: z.array(z.object({ key: z.enum(["A", "B", "final"]), startsAt: z.coerce.date() })).optional(),
    maxEntrants: z.number().int().min(2).max(512).nullable().optional(),
    clockSeconds: z.number().int().min(30).max(3600).optional(),
  }),
]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  const body = parsed.data;
  try {
    switch (body.action) {
      case "generate": {
        const { players } = await generateBracket(params.id);
        return NextResponse.json({ message: `Chaves sorteadas com ${players} duelistas.` });
      }
      case "activate":
        await activateBracket(params.id);
        return NextResponse.json({ message: "Torneio ativado! Cada chave começa no horário marcado." });
      case "pause":
        await pauseBracket(params.id, true);
        return NextResponse.json({ message: "Torneio pausado: nenhum confronto novo começa (os que já estão rolando terminam)." });
      case "resume":
        await pauseBracket(params.id, false);
        return NextResponse.json({ message: "Torneio retomado." });
      case "settings":
        await updateBracketSettings(params.id, body);
        return NextResponse.json({ message: "Horários e vagas salvos." });
    }
  } catch (err) {
    if (err instanceof TournamentError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
