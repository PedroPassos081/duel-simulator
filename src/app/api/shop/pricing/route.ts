import { NextResponse } from "next/server";
import { getShopPricing } from "@/lib/site-settings";

// % das raridades (a tela calcula os preços de Rara/Ultra/Secreta com elas)
export async function GET() {
  const { finishPercents } = await getShopPricing();
  return NextResponse.json({ finishPercents });
}
