import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // mensagem genérica de propósito — não revela se o e-mail já existe,
    // para dificultar enumeração de contas
    return NextResponse.json(
      { message: "Se o cadastro for válido, você receberá um e-mail de confirmação." },
      { status: 200 }
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  await prisma.wallet.create({ data: { userId: user.id } });

  // TODO (produção): gerar token de verificação, enviar e-mail real (Resend/SendGrid),
  // e só setar emailVerified quando o usuário clicar no link.
  // Para rodar o MVP localmente sem servidor de e-mail, deixamos auto-verificado:
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });

  return NextResponse.json(
    { message: "Se o cadastro for válido, você receberá um e-mail de confirmação." },
    { status: 201 }
  );
}
