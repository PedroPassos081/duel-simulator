"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, Mail, PenSquare, Send } from "lucide-react";
import { ArtBanner } from "@/components/theme/ArtBanner";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { ART } from "@/lib/card-art";
import { formatRelative } from "@/lib/dates";

const MAX_LENGTH = 1000;

interface Person {
  userId: string;
  username: string | null;
  avatar: { image: string | null; name: string | null; frameUrl: string | null };
  playerName: { name: string | null; effect: string | null; profile: string | null };
}
interface Conversation {
  partner: Person;
  lastMessage: { body: string; mine: boolean; createdAt: string };
  unread: number;
}
interface Message {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
  read: boolean;
}

const time = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("pt-BR", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Repete uma função a cada `ms` enquanto a aba estiver visível. */
function usePolling(fn: () => void, ms: number) {
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && fn(), ms);
    return () => clearInterval(id);
  }, [fn, ms]);
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<GlassPanel className="max-w-5xl text-sm text-zinc-400">Carregando...</GlassPanel>}>
      <Messages />
    </Suspense>
  );
}

function Messages() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("para")?.replace(/^@/, "").toLowerCase() || null;
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [newTo, setNewTo] = useState("");

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/messages");
    if (res.ok) setConversations(await res.json());
  }, []);
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);
  usePolling(loadConversations, 15_000);

  const open = (username: string | null) => router.push(username ? `/mensagens?para=${encodeURIComponent(username)}` : "/mensagens");

  return (
    <GlassPanel className="max-w-5xl">
      <ArtBanner
        art={ART.messengerOfPeace}
        eyebrow="Correio do Faraó"
        title={
          <span className="flex items-center gap-2">
            <Mail className="h-7 w-7 text-amber-300" /> Mensagens
          </span>
        }
        subtitle="Converse em particular com qualquer duelista pelo @nick."
        tone="blue"
        position="center 30%"
      />

      <div className="grid gap-4 md:grid-cols-[290px_1fr]">
        {/* CONVERSAS (no celular, some quando uma conversa está aberta) */}
        <aside className={`${active ? "hidden md:flex" : "flex"} flex-col gap-3`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newTo.trim()) open(newTo.trim().replace(/^@/, "").toLowerCase());
              setNewTo("");
            }}
            className="flex gap-2"
          >
            <input
              value={newTo}
              onChange={(e) => setNewTo(e.target.value)}
              placeholder="@nick do jogador"
              className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
            />
            <button disabled={!newTo.trim()} title="Nova mensagem" className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40">
              <PenSquare className="h-4 w-4" />
            </button>
          </form>

          <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
            {conversations === null ? (
              <p className="p-4 text-sm text-zinc-500">Carregando...</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">Nenhuma conversa ainda. Digite o @nick de alguém acima ou use o botão &quot;Mensagem&quot; no perfil dele.</p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-zinc-800/70 overflow-y-auto">
                {conversations.map((c) => {
                  const selected = c.partner.username === active;
                  return (
                    <li key={c.partner.userId}>
                      <button
                        onClick={() => open(c.partner.username)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${selected ? "bg-amber-500/10" : "hover:bg-zinc-900"}`}
                      >
                        <Avatar {...c.partner.avatar} size={38} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <PlayerName {...c.partner.playerName} link={false} className="truncate text-sm font-semibold" />
                            <span className="shrink-0 text-[10px] text-zinc-500">{formatRelative(new Date(c.lastMessage.createdAt))}</span>
                          </span>
                          <span className="flex items-center justify-between gap-2">
                            <span className={`truncate text-xs ${c.unread ? "font-semibold text-zinc-200" : "text-zinc-500"}`}>
                              {c.lastMessage.mine && "Você: "}
                              {c.lastMessage.body}
                            </span>
                            {c.unread > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">{c.unread}</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* CONVERSA ABERTA */}
        <section className={`${active ? "flex" : "hidden md:flex"} min-h-[420px] flex-col rounded-xl border border-zinc-800 bg-zinc-950/60`}>
          {active ? (
            <Thread key={active} username={active} onBack={() => open(null)} onChange={loadConversations} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-zinc-500">
              <Mail className="h-10 w-10 text-zinc-700" />
              Escolha uma conversa ou escreva para um @nick.
            </div>
          )}
        </section>
      </div>
    </GlassPanel>
  );
}

function Thread({ username, onBack, onChange }: { username: string; onBack: () => void; onChange: () => void }) {
  const [partner, setPartner] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/messages/${encodeURIComponent(username)}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Não foi possível abrir a conversa.");
    setError(null);
    setPartner(data.partner);
    setMessages(data.messages);
  }, [username]);
  useEffect(() => {
    load().then(onChange); // abrir marca como lidas: atualiza a lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  usePolling(load, 6_000);

  // Desce para a última mensagem quando chega uma nova
  useEffect(() => {
    const last = messages.at(-1)?.id ?? null;
    if (last !== lastId.current) bottom.current?.scrollIntoView({ block: "end" });
    lastId.current = last;
  }, [messages]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: username, body: text }) });
    const data = await res.json();
    setSending(false);
    if (!res.ok) return setError(data.error ?? "Não foi possível enviar.");
    setText("");
    setMessages((m) => [...m, data]);
    onChange();
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-100 md:hidden" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {partner ? (
          <>
            <Avatar {...partner.avatar} size={34} />
            <PlayerName {...partner.playerName} className="font-semibold" />
          </>
        ) : (
          <span className="text-sm text-zinc-400">@{username}</span>
        )}
      </header>

      <div className="flex max-h-[55vh] min-h-[260px] flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {partner && messages.length === 0 && <p className="m-auto text-sm text-zinc-500">Nenhuma mensagem ainda. Diga olá!</p>}
        {messages.map((m, i) => {
          const lastMine = m.mine && !messages.slice(i + 1).some((x) => x.mine);
          return (
            <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
              <p
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                  m.mine ? "rounded-br-sm bg-amber-500/90 text-black" : "rounded-bl-sm border border-zinc-800 bg-zinc-900 text-zinc-100"
                }`}
              >
                {m.body}
              </p>
              <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-zinc-500">
                {time(m.createdAt)}
                {lastMine && (m.read ? <CheckCheck className="h-3 w-3 text-sky-400" aria-label="Lida" /> : <Check className="h-3 w-3" aria-label="Enviada" />)}
              </span>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {error && <p className="px-4 pb-2 text-xs text-red-400">{error}</p>}
      {partner && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 border-t border-zinc-800 p-3"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra a linha
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            maxLength={MAX_LENGTH}
            rows={1}
            placeholder="Escreva uma mensagem..."
            className="max-h-32 min-h-[40px] flex-1 resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
          />
          <button disabled={!text.trim() || sending} className="flex h-10 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40">
            <Send className="h-4 w-4" /> Enviar
          </button>
        </form>
      )}
    </>
  );
}
