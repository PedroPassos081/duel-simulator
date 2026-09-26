import { NextResponse } from "next/server";
import argon2 from "argon2";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordChangeSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const parsed = passwordChangeSchema.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // Contas criadas só com Google não têm senha: podem definir uma sem a atual.
  if (user.passwordHash) {
    const valid = currentPassword
      ? await argon2.verify(user.passwordHash, currentPassword)
      : false;
    if (!valid) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
    }
  }

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
