import { NextResponse } from "next/server";
import { listLiveDuels } from "@/lib/spectate";

export const dynamic = "force-dynamic";

// Duelos em andamento para assistir (Random e torneios)
export async function GET() {
  return NextResponse.json(await listLiveDuels());
}
