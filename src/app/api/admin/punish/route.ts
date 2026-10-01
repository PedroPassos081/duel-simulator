import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { PunishmentError, punishPlayer } from "@/lib/punishments";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("warning") }),
  z.object({ type: z.literal("suspension"), hours: z.number().int().min(1).max(24 * 3650).nullable() }),
  z.object({ type: z.literal("unsuspend") }),
  z.object({ type: z.literal("remove_gold"), amount: z.number().int().min(1) }),
  z.object({ type: z.literal("remove_cash"), amount: z.number().int().min(1) }),
  z.object({ type: z.literal("remove_cards"), cardId: z.number().int().positive(), quantity: z.number().int().min(1) }),
  z.object({ type: z.literal("wipe_cards") }),
]);

const punishSchema = z.object({
  username: z.string().trim().min(1, "Informe o @usuário."),
  reason: z.string().trim().min(3, "Explique o motivo da punição.").max(300),
  password: z.string().min(1, "Digite a senha de punição."),
  action: actionSchema,
});

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin pode punir." }, { status: 403 });

  const parsed = punishSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const { username, action, reason, password } = parsed.data;
    return NextResponse.json(await punishPlayer(admin.id, username, action, reason, password));
  } catch (err) {
    if (err instanceof PunishmentError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Erro ao aplicar a punição." }, { status: 500 });
  }
}
