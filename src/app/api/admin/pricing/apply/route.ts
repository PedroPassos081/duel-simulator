import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-server";
import { applyTierPrices } from "@/lib/admin-pricing";

// Aplica o preço das categorias em todas as cartas (menos as de preço manual)
export async function POST() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const { changed, total, custom } = await applyTierPrices();
  return NextResponse.json({ message: `Preços aplicados: ${changed} de ${total} cartas mudaram (${custom} com preço manual ficaram como estão).` });
}
