import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COMMENT_MAX_LENGTH } from "@/lib/news";

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Escreva algo antes de enviar.")
    .max(COMMENT_MAX_LENGTH, `Máximo de ${COMMENT_MAX_LENGTH} caracteres.`),
  parentId: z.string().min(1).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { postId: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Entre na sua conta para comentar." }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const parsed = commentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Comentário inválido." }, { status: 400 });
  }

  const post = await prisma.newsPost.findUnique({ where: { id: params.postId }, select: { id: true } });
  if (!post) {
    return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
  }

  // Respostas ficam em um nível: responder a uma resposta a coloca no mesmo comentário principal
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await prisma.newsComment.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.postId !== post.id) {
      return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
    }
    parentId = parent.parentId ?? parent.id;
  }

  const comment = await prisma.newsComment.create({
    data: { postId: post.id, userId, parentId, content: parsed.data.content },
  });
  return NextResponse.json(comment, { status: 201 });
}
