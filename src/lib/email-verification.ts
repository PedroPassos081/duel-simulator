import "server-only";

import { createHash, randomInt } from "node:crypto";
import { Resend } from "resend";

import { prisma } from "@/lib/prisma";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

function hashCode(email: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não configurado");
  }

  return createHash("sha256")
    .update(`${email}:${code}:${secret}`)
    .digest("hex");
}

export async function createVerificationCode(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const latest = await prisma.emailVerificationCode.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });

  if (
    latest &&
    Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000
  ) {
    throw new Error("VERIFICATION_COOLDOWN");
  }

  const code = randomInt(100000, 1000000).toString();

  await prisma.$transaction([
    prisma.emailVerificationCode.deleteMany({
      where: { email: normalizedEmail },
    }),
    prisma.emailVerificationCode.create({
      data: {
        email: normalizedEmail,
        codeHash: hashCode(normalizedEmail, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  return code;
}

export async function sendVerificationEmail(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Seu código de confirmação",
    text: `Seu código de confirmação do Edison Duel Simulator é ${code}. Ele expira em ${CODE_TTL_MINUTES} minutos.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
        <h1 style="font-size:22px">Confirme seu e-mail</h1>
        <p>Use o código abaixo para concluir seu cadastro no Edison Duel Simulator:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
        <p>O código expira em ${CODE_TTL_MINUTES} minutos.</p>
        <p style="color:#666;font-size:13px">Se você não criou esta conta, ignore esta mensagem.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`RESEND_ERROR:${error.message}`);
  }
}

export function isVerificationCodeValid(
  email: string,
  code: string,
  expectedHash: string
) {
  return hashCode(email.trim().toLowerCase(), code) === expectedHash;
}
