import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import {
  createVerificationCode,
  sendVerificationEmail,
} from "@/lib/email-verification";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, username, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.email === email
            ? "Este e-mail já está cadastrado."
            : "Este nome de usuário já está em uso.",
      },
      { status: 409 }
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: { name, username, email, passwordHash },
  });

  await prisma.wallet.create({ data: { userId: user.id } });

  try {
    const code = await createVerificationCode(email);
    await sendVerificationEmail(email, code);
  } catch (error) {
    console.error("Falha ao enviar código de verificação", error);
    return NextResponse.json(
      {
        error:
          "A conta foi criada, mas não foi possível enviar o código. Tente reenviar.",
        requiresVerification: true,
        email,
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      message: "Enviamos um código de confirmação para o seu e-mail.",
      requiresVerification: true,
      email,
    },
    { status: 201 }
  );
}
