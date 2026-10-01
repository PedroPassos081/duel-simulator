import { NextResponse } from "next/server";
import { getSpectatorState } from "@/lib/spectate";

export const dynamic = "force-dynamic";

// Um duelo ao vivo: campo, cemitérios, banidas e pontos de vida (a mão fica escondida)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const state = await getSpectatorState(params.id);
  return state ? NextResponse.json(state) : NextResponse.json({ error: "Duelo não encontrado." }, { status: 404 });
}
