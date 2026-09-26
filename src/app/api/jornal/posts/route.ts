import { NextResponse } from "next/server";
import { createPost } from "@/lib/news";
import { getViewer } from "@/lib/admin-server";
import { postSchema } from "./schema";

// Publicar no jornal: exclusivo do Admin
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    return NextResponse.json({ error: "Só o Admin pode publicar no jornal." }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const post = await createPost({ ...parsed.data, authorId: viewer.id });
  return NextResponse.json({ id: post.id }, { status: 201 });
}
