import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-server";
import { getPlayerStatus } from "@/lib/punishments";

// Situação de um jogador (saldo, cartas, suspensão, histórico de punições)
export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const username = new URL(req.url).searchParams.get("u") ?? "";
  const status = username ? await getPlayerStatus(username) : null;
  if (!status) return NextResponse.json({ error: "Jogador não encontrado." }, { status: 404 });
  return NextResponse.json(status);
}
