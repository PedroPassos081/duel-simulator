import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewer } from "@/lib/admin-server";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { RoleBadge } from "@/components/RoleBadge";
import { CommentsSection } from "@/components/CommentsSection";
import { PostAdminActions } from "./PostAdminActions";
import { MiniCalendar } from "@/components/MiniCalendar";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { formatDate } from "@/lib/dates";
import { POST_TYPES, getPost, getPostComments } from "@/lib/news";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  if (!post) notFound();

  const viewer = await getViewer();
  const viewerId = viewer?.id ?? null;
  const comments = await getPostComments(post.id, viewerId, viewer?.isAdmin);
  const postType = POST_TYPES[post.type as keyof typeof POST_TYPES] ?? POST_TYPES.news;

  return (
    <GlassPanel className="max-w-6xl">
      <Link href="/jornal" className="mb-5 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="w-4 h-4" />
        Voltar ao jornal
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-md border px-2 py-0.5 font-semibold ${postType.badge}`}>{postType.label}</span>
            <span className="text-zinc-500">
              {formatDate(post.publishedAt, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-zinc-100">{post.title}</h1>
          {post.summary && <p className="mt-2 text-lg text-zinc-400">{post.summary}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {post.author ? (
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <Avatar {...post.author.avatar} size={28} />
                <span>
                  por <PlayerName {...post.author.name} className="font-semibold text-zinc-200" />
                </span>
                <RoleBadge role={post.author.role} />
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Publicação automática</p>
            )}
            {viewer?.isAdmin && <PostAdminActions postId={post.id} />}
          </div>
          {post.imageUrl && (
            <img src={post.imageUrl} alt="" className="mt-5 w-full rounded-xl border border-zinc-800 object-cover" />
          )}
          <div className="mt-5 flex flex-col gap-4 text-[15px] leading-relaxed text-zinc-300">
            {post.content.split(/\n\s*\n/).map((paragraph, i) => (
              <p key={i} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="border-t border-zinc-800 mt-8" />
          <CommentsSection postId={post.id} comments={comments} isLoggedIn={Boolean(viewerId)} />
        </article>

        <MiniCalendar />
      </div>
    </GlassPanel>
  );
}
