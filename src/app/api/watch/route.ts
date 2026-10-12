import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { listLiveDuels } from "@/lib/spectate";

export const dynamic = "force-dynamic";

// Duelos em andamento para assistir (Random e torneios)
export async function GET() {
  if (!(await auth())?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json(await listLiveDuels());
}
