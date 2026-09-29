import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deletePost, updatePost } from "@/lib/news";
import { getViewer } from "@/lib/admin-server";
import { postSchema } from "../schema";

async function guard(id: string) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    return NextResponse.json({ error: "Só o Admin pode alterar publicações." }, { status: 403 });
  }
  if (!(await prisma.newsPost.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = await guard(params.id);
  if (denied) return denied;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  await updatePost(params.id, parsed.data);
  return NextResponse.json({ id: params.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const denied = await guard(params.id);
  if (denied) return denied;

  await deletePost(params.id);
  return NextResponse.json({ ok: true });
}
