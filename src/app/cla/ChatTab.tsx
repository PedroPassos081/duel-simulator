"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, MessageCircle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { RoleBadge } from "@/components/RoleBadge";
import { formatRelative } from "@/lib/dates";

const MAX_LENGTH = 1000;

interface ChatMessage {
  id: string;
  author: {
    userId: string;
    avatar: { image: string | null; name: string | null; frameUrl: string | null };
    playerName: { name: string | null; effect: string | null; profile: string | null };
  };
  authorRole: string;
  mine: boolean;
  canDelete: boolean;
  body: string;
  createdAt: string;
}

/** Chat privado do clã: só os membros leem e escrevem. */
export function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | null>(null);

  const apply = (data: { messages: ChatMessage[] }) => setMessages(data.messages);

  const load = useCallback(async () => {
    const res = await fetch("/api/clans/chat");
    const data = await res.json();
    if (res.ok) apply(data);
    else setError(data.error ?? "Não foi possível abrir o chat.");
  }, []);

  useEffect(() => {
    load();
    // Atualiza sozinho enquanto a aba estiver aberta
    const id = setInterval(() => document.visibilityState === "visible" && load(), 6_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const last = messages?.at(-1)?.id ?? null;
    if (last !== lastId.current) bottom.current?.scrollIntoView({ block: "nearest" });
    lastId.current = last;
  }, [messages]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/clans/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    const data = await res.json();
    setSending(false);
    if (!res.ok) return setError(data.error ?? "Não foi possível enviar.");
    setText("");
    apply(data);
  }

  async function remove(id: string) {
    if (!confirm("Apagar esta mensagem?")) return;
    const res = await fetch(`/api/clans/chat?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) apply(data);
    else setError(data.error ?? "Não foi possível apagar.");
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <h2 className="flex items-center gap-2 font-bold text-zinc-100">
          <MessageCircle className="h-5 w-5 text-amber-400" /> Chat do clã
        </h2>
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          <Lock className="h-3 w-3" /> Só os membros veem
        </span>
      </header>

      <ol className="flex max-h-[55vh] min-h-[240px] flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages === null && !error && <li className="text-sm text-zinc-500">Carregando...</li>}
        {messages?.length === 0 && <li className="m-auto text-sm text-zinc-500">Ninguém escreveu ainda. Puxe o assunto!</li>}
        {messages?.map((m) => (
          <li key={m.id} className="group flex gap-3">
            <Avatar {...m.author.avatar} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-xs">
                <PlayerName {...m.author.playerName} className="text-sm font-semibold" />
                <RoleBadge role={m.authorRole} />
                <span className="text-zinc-500">{formatRelative(new Date(m.createdAt))}</span>
                {m.canDelete && (
                  <button onClick={() => remove(m.id)} className="ml-auto text-zinc-600 opacity-0 transition hover:text-red-300 group-hover:opacity-100 focus:opacity-100" aria-label="Apagar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-200">{m.body}</p>
            </div>
          </li>
        ))}
        <div ref={bottom} />
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex flex-col gap-2 border-t border-zinc-800 p-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={MAX_LENGTH}
          rows={2}
          placeholder="Escreva para o clã... (Enter envia)"
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-red-400">{error}</span>
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-black transition-colors hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>
    </section>
  );
}
