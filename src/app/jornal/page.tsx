import Link from "next/link";
import { MessageCircle, Newspaper, Pin, Plus } from "lucide-react";
import { MiniCalendar } from "@/components/MiniCalendar";
import { getViewer } from "@/lib/admin-server";
import { formatDate } from "@/lib/dates";
import { POST_TYPES, isPostType, listPosts } from "@/lib/news";

export const dynamic = "force-dynamic";

export default async function JornalPage({ searchParams }: { searchParams: { tipo?: string } }) {
  const type = isPostType(searchParams.tipo) ? searchParams.tipo : undefined;
  const [posts, viewer] = await Promise.all([listPosts(type), getViewer()]);

  const filters = [
    { id: undefined, label: "Tudo" },
    ...Object.entries(POST_TYPES).map(([id, t]) => ({ id, label: t.plural })),
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-zinc-100 tracking-tight">
            <Newspaper className="w-7 h-7 text-amber-400" />
            Jornal
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Notícias, avisos e resultados de torneios.</p>
        </div>
        {/* Publicar é exclusivo do Admin */}
        {viewer?.isAdmin && (
          <Link
            href="/jornal/nova"
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" /> Nova publicação
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {/* FILTROS */}
          <div className="mb-4 flex w-fit flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            {filters.map((f) => (
              <Link
                key={f.label}
                href={f.id ? `/jornal?tipo=${f.id}` : "/jornal"}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  f.id === type ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>

          {/* PUBLICAÇÕES */}
          {posts.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-12 text-center text-sm text-zinc-500">
              Nenhuma publicação por aqui ainda.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {posts.map((post) => {
                const postType = POST_TYPES[post.type as keyof typeof POST_TYPES] ?? POST_TYPES.news;
                return (
                  <li key={post.id}>
                    <Link
                      href={`/jornal/${post.id}`}
                      className={`group flex flex-col overflow-hidden rounded-xl border bg-zinc-900/60 transition-colors hover:border-amber-500/50 sm:flex-row ${
                        post.pinned ? "border-amber-500/30" : "border-zinc-800"
                      }`}
                    >
                      {post.imageUrl && (
                        <img
                          src={post.imageUrl}
                          alt=""
                          className="h-40 w-full object-cover sm:h-auto sm:w-48"
                          loading="lazy"
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {post.pinned && (
                            <span className="flex items-center gap-1 font-semibold text-amber-400">
                              <Pin className="w-3 h-3" /> Fixado
                            </span>
                          )}
                          <span className={`rounded-md border px-2 py-0.5 font-semibold ${postType.badge}`}>
                            {postType.label}
                          </span>
                          <span className="text-zinc-500">
                            {formatDate(post.publishedAt, { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <h2 className="text-lg font-bold leading-snug text-zinc-100 group-hover:text-amber-400 transition-colors">
                          {post.title}
                        </h2>
                        {(post.summary || post.content) && (
                          <p className="line-clamp-2 text-sm text-zinc-400">{post.summary ?? post.content}</p>
                        )}
                        <p className="mt-auto flex items-center gap-1 text-xs text-zinc-500">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {post._count.comments} {post._count.comments === 1 ? "comentário" : "comentários"}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <MiniCalendar />
      </div>
    </div>
  );
}
