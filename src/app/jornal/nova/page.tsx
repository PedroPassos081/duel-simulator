import { notFound } from "next/navigation";
import { getViewer } from "@/lib/admin-server";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { PostForm } from "../PostForm";

export default async function NewPostPage() {
  // Publicar é exclusivo do Admin
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();

  return (
    <GlassPanel className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-zinc-100">Nova publicação</h1>
      <PostForm />
    </GlassPanel>
  );
}
