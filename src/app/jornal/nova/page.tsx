import { notFound } from "next/navigation";
import { getViewer } from "@/lib/admin-server";
import { PostForm } from "../PostForm";

export default async function NewPostPage() {
  // Publicar é exclusivo do Admin
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-zinc-100">Nova publicação</h1>
      <PostForm />
    </div>
  );
}
