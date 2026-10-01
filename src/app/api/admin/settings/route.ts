import { NextResponse } from "next/server";
import { getViewer } from "@/lib/admin-server";
import { cardSalePercentSchema } from "@/lib/validation";
import { getCardSalePercent, setCardSalePercent } from "@/lib/site-settings";

/** Configurações do jogo (só Admin). */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: "Apenas Admin." }, { status: 403 });
  return NextResponse.json({ cardSalePercent: await getCardSalePercent() });
}

export async function PUT(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: "Apenas Admin." }, { status: 403 });

  const parsed = cardSalePercentSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Use um número inteiro de 1 a 100." }, { status: 400 });

  const cardSalePercent = await setCardSalePercent(parsed.data.cardSalePercent, viewer.id);
  return NextResponse.json({ cardSalePercent });
}
