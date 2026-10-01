import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      username: true,
      email: true,
      image: true,
      passwordHash: true,
      createdAt: true,
      cosmetics: {
        include: { cosmetic: true },
        orderBy: { acquiredAt: "desc" },
      },
      equippedCosmetics: { select: { type: true, cosmeticId: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const { passwordHash, cosmetics, equippedCosmetics, ...profile } = user;

  // Aparência do deck equipado (o duelo usa essa; vazio = a da conta)
  const equippedDeck = await prisma.deck.findFirst({
    where: { userId, isEquipped: true },
    select: { sleeveId: true, playmatId: true },
  });

  return NextResponse.json({
    ...profile,
    hasPassword: Boolean(passwordHash),
    cosmetics: cosmetics.map((c) => ({ ...c.cosmetic, source: c.source, acquiredAt: c.acquiredAt })),
    equipped: Object.fromEntries(equippedCosmetics.map((e) => [e.type, e.cosmeticId])),
    deckStyle: { sleeve: equippedDeck?.sleeveId ?? null, playmat: equippedDeck?.playmatId ?? null },
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const parsed = profileUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { username, image } = parsed.data;

  if (username) {
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(username !== undefined && { username }),
      ...(image !== undefined && { image }),
    },
    select: { username: true, image: true },
  });

  return NextResponse.json(user);
}
