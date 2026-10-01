import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { AdminGrantError, sendToPlayers } from "@/lib/admin-grants";
import { rewardSchema, targetSchema } from "@/lib/reward-schema";
import { EconomyError } from "@/lib/economy";

const sendSchema = z.object({
  // Novo: destino (jogadores, todos ou clã). "recipients" continua aceito (só @usuários).
  target: targetSchema.optional(),
  recipients: z.string().optional(),
  reason: z.enum(["prize", "event", "compensation", "gift"]),
  note: z.string().trim().max(200).optional(),
  payload: rewardSchema,
});

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin pode enviar." }, { status: 403 });

  const parsed = sendSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const { target, recipients, payload, reason, note } = parsed.data;
    const to = target ?? (recipients ? { mode: "users" as const, input: recipients } : null);
    if (!to) return NextResponse.json({ error: "Informe para quem enviar." }, { status: 400 });
    return NextResponse.json(await sendToPlayers(admin.id, to, payload, reason, note));
  } catch (err) {
    if (err instanceof AdminGrantError || err instanceof EconomyError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao enviar." }, { status: 500 });
  }
}
