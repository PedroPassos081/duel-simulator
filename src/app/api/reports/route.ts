import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createReport, isReportReason, REPORT_MAX_LENGTH, ReportError } from "@/lib/reports";

const schema = z.object({
  target: z.string().trim().min(1).max(40),
  reason: z.string().refine(isReportReason),
  message: z.string().max(REPORT_MAX_LENGTH * 2),
});

// Denúncia feita no perfil de um jogador
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return NextResponse.json({ error: "Entre na sua conta para denunciar." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha o motivo e conte o que aconteceu." }, { status: 400 });
  try {
    await createReport(userId, parsed.data.target, parsed.data.reason as Parameters<typeof createReport>[2], parsed.data.message);
    return NextResponse.json({ message: "Denúncia enviada. Obrigado! A equipe vai analisar." }, { status: 201 });
  } catch (err) {
    if (err instanceof ReportError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
