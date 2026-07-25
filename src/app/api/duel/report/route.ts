import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { auth } from "@/lib/auth";

const reportSchema = z.object({
  description: z.string().trim().min(10).max(4000),
  context: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const parsed = reportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const recipient = process.env.BUG_REPORT_EMAIL;
  if (!apiKey || !from || !recipient) {
    return NextResponse.json(
      { error: "E-mail de relatórios não configurado." },
      { status: 503 }
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: recipient,
    subject: "Novo bug relatado no Edison Duel Simulator",
    text: [
      `Usuário: ${session.user.name ?? "Sem nome"}`,
      `E-mail: ${session.user.email ?? "Sem e-mail"}`,
      `Contexto: ${parsed.data.context ?? "Não informado"}`,
      "",
      "Descrição:",
      parsed.data.description,
    ].join("\n"),
  });

  if (error) {
    return NextResponse.json({ error: "Falha ao enviar relatório." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
