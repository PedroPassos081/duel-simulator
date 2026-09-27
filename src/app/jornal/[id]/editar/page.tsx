import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/admin-server";
import { PostForm } from "../../PostForm";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();

  const post = await prisma.newsPost.findUnique({ where: { id: params.id } });
  if (!post) notFound();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-zinc-100">Editar publicação</h1>
      <PostForm
        postId={post.id}
        initial={{
          type: post.type as "news" | "notice" | "tournament",
          title: post.title,
          summary: post.summary ?? "",
          content: post.content,
          imageUrl: post.imageUrl ?? "",
          pinned: post.pinned,
        }}
      />
    </div>
  );
}
