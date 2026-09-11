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

  const existingByEmail = await prisma.user.findUnique({ where: { email } });

  // Conta já cadastrada com este e-mail mas nunca verificada: em vez de
  // travar o usuário para sempre, deixamos ele reenviar o código e seguir
  // o fluxo de verificação normalmente.
  if (existingByEmail && !existingByEmail.emailVerified) {
    const usernameTaken = await prisma.user.findFirst({
      where: { username, NOT: { id: existingByEmail.id } },
    });
    if (usernameTaken) {
      return NextResponse.json(
        { error: "Este nome de usuário já está em uso." },
        { status: 409 }
      );
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: { name, username, passwordHash },
    });

    try {
      const code = await createVerificationCode(email);
      await sendVerificationEmail(email, code);
    } catch (error) {
      if (error instanceof Error && error.message === "VERIFICATION_COOLDOWN") {
        return NextResponse.json(
          {
            message: "Um código já foi enviado recentemente. Confira seu e-mail.",
            requiresVerification: true,
            email,
          },
          { status: 200 }
        );
      }
      console.error("Falha ao enviar código de verificação", error);
      return NextResponse.json(
        {
          error:
            "A conta já existe, mas não foi possível enviar o código. Tente reenviar.",
          requiresVerification: true,
          email,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        message: "Enviamos um novo código de confirmação para o seu e-mail.",
        requiresVerification: true,
        email,
      },
      { status: 200 }
    );
  }

  if (existingByEmail) {
    return NextResponse.json(
      { error: "Este e-mail já está cadastrado." },
      { status: 409 }
    );
  }

  const existingByUsername = await prisma.user.findUnique({ where: { username } });
  if (existingByUsername) {
    return NextResponse.json(
      { error: "Este nome de usuário já está em uso." },
      { status: 409 }
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // Usuário e carteira são gravados juntos. Se uma operação falhar,
  // nenhuma das duas fica incompleta no banco.
  await prisma.user.create({
    data: {
      name,
      username,
      email,
      passwordHash,
      wallet: { create: {} },
    },
  });

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
