import { NextResponse } from "next/server";

import {
  createVerificationCode,
  sendVerificationEmail,
} from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import { resendVerificationSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = resendVerificationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Resposta genérica para não revelar quais e-mails possuem conta.
  if (!user || user.emailVerified) {
    return NextResponse.json({
      message: "Se a conta estiver pendente, um novo código será enviado.",
    });
  }

  try {
    const code = await createVerificationCode(email);
    await sendVerificationEmail(email, code);
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFICATION_COOLDOWN") {
      return NextResponse.json(
        { error: "Aguarde um minuto antes de solicitar outro código." },
        { status: 429 }
      );
    }

    console.error("Falha ao reenviar código de verificação", error);
    return NextResponse.json(
      { error: "Não foi possível enviar o código agora." },
      { status: 503 }
    );
  }

  return NextResponse.json({ message: "Novo código enviado." });
}
