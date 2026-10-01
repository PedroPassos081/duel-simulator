import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { acknowledgeWarning } from "@/lib/punishments";

// O jogador confirma que leu a advertência ("Entendi")
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  await acknowledgeWarning((session.user as { id: string }).id, params.id);
  return NextResponse.json({ ok: true });
}
