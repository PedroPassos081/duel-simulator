import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOcgCoreStatus } from "@/lib/duel/ocgcore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await getOcgCoreStatus());
  } catch (error) {
    console.error("Falha ao carregar o OCGCore:", error);
    return NextResponse.json(
      {
        available: false,
        version: null,
        cardDatabaseConfigured: false,
        scriptsConfigured: false,
        readyForDuels: false,
      },
      { status: 503 }
    );
  }
}
