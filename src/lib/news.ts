import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";

export const POST_TYPES = {
  news: { label: "Notícia", plural: "Notícias", badge: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  notice: { label: "Aviso", plural: "Avisos", badge: "bg-red-500/15 text-red-300 border-red-500/30" },
  tournament: { label: "Torneio", plural: "Torneios", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
} as const;

export type PostType = keyof typeof POST_TYPES;

export function isPostType(value: string | undefined): value is PostType {
  return Boolean(value && value in POST_TYPES);
}

export const COMMENT_MAX_LENGTH = 1000;

export async function listPosts(type?: PostType) {
  return prisma.newsPost.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: 50,
    include: { _count: { select: { comments: { where: { deletedAt: null } } } } },
  });
}

export async function getPost(id: string) {
  const post = await prisma.newsPost.findUnique({
    where: { id },
    include: { author: { select: { role: true, ...userAvatarSelect } } },
  });
  if (!post) return null;
  const { author, ...rest } = post;
  return {
    ...rest,
    author: author ? { avatar: toAvatarProps(author), name: toPlayerNameProps(author), role: author.role } : null,
  };
}

/**
 * Comentários de uma publicação, já com respostas, likes/deslikes e a reação
 * de quem está vendo. Comentários principais: mais novos primeiro; respostas:
 * na ordem em que foram escritas.
 */
export async function getPostComments(postId: string, viewerId?: string | null, viewerIsAdmin = false) {
  const comments = await prisma.newsComment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, role: true, ...userAvatarSelect } } },
  });

  const ids = comments.map((c) => c.id);
  const [counts, viewerReactions] = await Promise.all([
    prisma.newsCommentReaction.groupBy({
      by: ["commentId", "value"],
      where: { commentId: { in: ids } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.newsCommentReaction.findMany({ where: { commentId: { in: ids }, userId: viewerId } })
      : Promise.resolve([]),
  ]);

  const countOf = (commentId: string, value: number) =>
    counts.find((c) => c.commentId === commentId && c.value === value)?._count._all ?? 0;
  const viewerReactionOf = (commentId: string) =>
    viewerReactions.find((r) => r.commentId === commentId)?.value ?? 0;

  const toView = (c: (typeof comments)[number]) => ({
    id: c.id,
    parentId: c.parentId,
    content: c.deletedAt ? null : c.content,
    deleted: Boolean(c.deletedAt),
    createdAt: c.createdAt.toISOString(),
    isMine: c.userId === viewerId,
    // O autor apaga o próprio comentário; o Admin modera qualquer um
    canDelete: c.userId === viewerId || viewerIsAdmin,
    author: { avatar: toAvatarProps(c.user), name: toPlayerNameProps(c.user), role: c.user.role },
    likes: countOf(c.id, 1),
    dislikes: countOf(c.id, -1),
    myReaction: viewerReactionOf(c.id),
  });

  const topLevel = comments
    .filter((c) => !c.parentId)
    .reverse()
    .map((c) => ({
      ...toView(c),
      replies: comments.filter((r) => r.parentId === c.id).map(toView),
    }))
    // Comentário apagado sem respostas não precisa aparecer
    .filter((c) => !c.deleted || c.replies.length > 0);

  return topLevel;
}

export type CommentView = Awaited<ReturnType<typeof getPostComments>>[number];

export const POST_TITLE_MAX = 120;
export const POST_SUMMARY_MAX = 200;
export const POST_CONTENT_MAX = 10_000;

export interface PostInput {
  type: PostType;
  title: string;
  content: string;
  summary?: string | null;
  imageUrl?: string | null;
  pinned?: boolean;
}

/**
 * Publica uma notícia ou aviso no jornal. Só o Admin publica (a rota da
 * API confere o cargo antes de chamar esta função).
 */
export async function createPost(data: PostInput & { authorId?: string; publishedAt?: Date }) {
  return prisma.newsPost.create({ data });
}

export async function updatePost(id: string, data: PostInput) {
  return prisma.newsPost.update({ where: { id }, data });
}

export async function deletePost(id: string) {
  return prisma.newsPost.delete({ where: { id } });
}

const PODIUM_EMOJI = ["🥇", "🥈", "🥉"];

/** Publicação automática com o resultado de um torneio (chamada ao registrar a competição). */
export async function createTournamentPost(competitionId: string) {
  const competition = await prisma.competition.findUniqueOrThrow({
    where: { id: competitionId },
    include: {
      results: {
        include: { user: { select: { username: true, name: true } } },
        orderBy: [{ placement: "asc" }, { points: "desc" }],
      },
    },
  });

  const lines = competition.results.map((r, i) => {
    const position = r.placement ?? i + 1;
    const player = r.user.username ? `@${r.user.username}` : r.user.name ?? "Duelista";
    return `${PODIUM_EMOJI[position - 1] ?? `${position}º`} ${player} — ${r.points} pontos`;
  });
  const champion = competition.results[0];
  const championName = champion?.user.username ? `@${champion.user.username}` : champion?.user.name;

  return prisma.newsPost.upsert({
    where: { competitionId },
    update: {},
    create: {
      type: "tournament",
      competitionId,
      title: `Resultado: ${competition.name}`,
      summary: championName ? `${championName} é o campeão!` : "O torneio foi encerrado.",
      content: [competition.description, "Classificação final:", lines.join("\n")]
        .filter(Boolean)
        .join("\n\n"),
      publishedAt: new Date(),
    },
  });
}
