import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 1 = like, -1 = deslike, 0 = tirar a reação
const reactionSchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Entre na sua conta para reagir." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const parsed = reactionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Reação inválida." }, { status: 400 });
  }

  const comment = await prisma.newsComment.findUnique({ where: { id: params.id }, select: { deletedAt: true } });
  if (!comment || comment.deletedAt) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
  }

  const key = { commentId_userId: { commentId: params.id, userId } };
  if (parsed.data.value === 0) {
    await prisma.newsCommentReaction.deleteMany({ where: { commentId: params.id, userId } });
  } else {
    await prisma.newsCommentReaction.upsert({
      where: key,
      update: { value: parsed.data.value },
      create: { commentId: params.id, userId, value: parsed.data.value },
    });
  }
  return NextResponse.json({ ok: true });
}
