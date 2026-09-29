"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { RoleBadge } from "@/components/RoleBadge";
import { formatRelative } from "@/lib/dates";
import type { CommentView } from "@/lib/news";

type Reply = CommentView["replies"][number];

const COMMENT_MAX_LENGTH = 1000;

export function CommentsSection({
  postId,
  comments,
  isLoggedIn,
}: {
  postId: string;
  comments: CommentView[];
  isLoggedIn: boolean;
}) {
  const total = comments.reduce((sum, c) => sum + (c.deleted ? 0 : 1) + c.replies.filter((r) => !r.deleted).length, 0);

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-100">
        <MessageCircle className="w-5 h-5 text-amber-400" />
        Comentários <span className="text-sm font-normal text-zinc-500">({total})</span>
      </h2>

      <div className="mt-4">
        {isLoggedIn ? (
          <CommentForm postId={postId} placeholder="Escreva um comentário..." />
        ) : (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
            <Link href="/login" className="font-semibold text-amber-400 hover:text-amber-300">
              Entre na sua conta
            </Link>{" "}
            para comentar, curtir e responder.
          </p>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">Ninguém comentou ainda. Seja o primeiro!</p>
      ) : (
        <ol className="mt-6 flex flex-col gap-5">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem postId={postId} comment={comment} isLoggedIn={isLoggedIn} />
              {comment.replies.length > 0 && (
                <ol className="mt-3 ml-5 flex flex-col gap-3 border-l border-zinc-800 pl-4 sm:ml-12">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentItem postId={postId} comment={reply} isLoggedIn={isLoggedIn} small />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CommentForm({
  postId,
  parentId,
  placeholder,
  autoFocus,
  onDone,
}: {
  postId: string;
  parentId?: string;
  placeholder: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch(`/api/jornal/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId }),
    });
    setSending(false);
    if (res.ok) {
      setContent("");
      onDone?.();
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Não foi possível enviar.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        maxLength={COMMENT_MAX_LENGTH}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-red-400">{error}</span>
        <div className="flex items-center gap-2">
          {onDone && (
            <button type="button" onClick={onDone} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-black hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors"
          >
            {sending ? "Enviando..." : parentId ? "Responder" : "Comentar"}
          </button>
        </div>
      </div>
    </form>
  );
}

function CommentItem({
  postId,
  comment,
  isLoggedIn,
  small,
}: {
  postId: string;
  comment: CommentView | Reply;
  isLoggedIn: boolean;
  small?: boolean;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);

  async function react(value: 1 | -1) {
    if (!isLoggedIn || busy) return;
    setBusy(true);
    await fetch(`/api/jornal/comments/${comment.id}/reaction`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Clicar de novo na mesma reação tira ela
      body: JSON.stringify({ value: comment.myReaction === value ? 0 : value }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(comment.isMine ? "Apagar este comentário?" : "Apagar este comentário como moderador?")) return;
    setBusy(true);
    await fetch(`/api/jornal/comments/${comment.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-3">
      <Avatar {...comment.author.avatar} size={small ? 28 : 36} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <PlayerName {...comment.author.name} className="font-semibold text-zinc-200" />
          <RoleBadge role={comment.author.role} />
          <span className="text-xs text-zinc-500">{formatRelative(new Date(comment.createdAt))}</span>
        </p>

        {comment.deleted ? (
          <p className="mt-1 text-sm italic text-zinc-500">Comentário apagado pelo autor.</p>
        ) : (
          <>
            <p className="mt-1 whitespace-pre-line break-words text-sm text-zinc-300">{comment.content}</p>
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              <ReactionButton
                active={comment.myReaction === 1}
                count={comment.likes}
                label="Curtir"
                disabled={!isLoggedIn || busy}
                onClick={() => react(1)}
                activeClass="text-emerald-400"
                icon={ThumbsUp}
              />
              <ReactionButton
                active={comment.myReaction === -1}
                count={comment.dislikes}
                label="Não curtir"
                disabled={!isLoggedIn || busy}
                onClick={() => react(-1)}
                activeClass="text-red-400"
                icon={ThumbsDown}
              />
              {isLoggedIn && (
                <button
                  onClick={() => setReplying((v) => !v)}
                  className="ml-1 rounded-md px-2 py-1 font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Responder
                </button>
              )}
              {comment.canDelete && (
                <button
                  onClick={remove}
                  disabled={busy}
                  title="Apagar comentário"
                  className="ml-auto rounded-md p-1 text-zinc-600 hover:bg-zinc-800 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </>
        )}

        {replying && (
          <div className="mt-2">
            <CommentForm
              postId={postId}
              parentId={comment.id}
              placeholder="Escreva uma resposta..."
              autoFocus
              onDone={() => setReplying(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ReactionButton({
  active,
  count,
  label,
  disabled,
  onClick,
  activeClass,
  icon: Icon,
}: {
  active: boolean;
  count: number;
  label: string;
  disabled: boolean;
  onClick: () => void;
  activeClass: string;
  icon: typeof ThumbsUp;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-pressed={active}
      className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors enabled:hover:bg-zinc-800 ${
        active ? activeClass : "text-zinc-400"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${active ? "fill-current" : ""}`} />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
