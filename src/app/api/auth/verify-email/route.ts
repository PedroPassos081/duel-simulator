import { NextResponse } from "next/server";

import { isVerificationCodeValid } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import { verificationSchema } from "@/lib/validation";

const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  const parsed = verificationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;
  const verification = await prisma.emailVerificationCode.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (!verification || verification.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Código inválido ou expirado. Solicite um novo código." },
      { status: 400 }
    );
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Limite de tentativas atingido. Solicite um novo código." },
      { status: 429 }
    );
  }

  if (!isVerificationCodeValid(email, code, verification.codeHash)) {
    await prisma.emailVerificationCode.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    return NextResponse.json(
      { error: "Código inválido ou expirado." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationCode.deleteMany({ where: { email } }),
  ]);

  return NextResponse.json({ message: "E-mail confirmado com sucesso." });
}
