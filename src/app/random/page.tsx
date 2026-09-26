"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, Layers3, Swords, Users } from "lucide-react";
import { MillenniumPyramid } from "@/components/theme/EgyptIcons";

type RoomId = "slifer" | "obelisk";

interface Room {
  id: RoomId;
  name: string;
  title: string;
  level: string;
  tagline: string;
  artUrl: string;
  description: string;
  theme: "red" | "blue";
  waiting: number;
  deckIssues: { message: string }[];
  banlist: { cardId: number; name: string; status: string }[];
}

type QueueStatus =
  | { status: "idle" }
  | { status: "waiting"; rooms: RoomId[]; since: string }
  | { status: "matched"; matchId: string };

interface RandomData {
  deck: { id: string; name: string } | null;
  queue: QueueStatus;
  rooms: Room[];
}

const POLL_WAITING_MS = 2_500;
const POLL_IDLE_MS = 10_000;

// Visual de cada sala. Classes estáticas (o Tailwind não enxerga classes montadas dinamicamente).
const THEMES = {
  red: {
    // Recorte da arte com zoom no rosto do deus (tamanho e posição do fundo)
    face: { size: "260%", position: "33% 44%" },
    card: "border-red-500/40 hover:border-red-400/80 bg-zinc-950",
    overlay: "from-red-950/55 via-zinc-950/80 to-zinc-950/95",
    emblem: "text-red-400 bg-red-500/10 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.35)]",
    title: "text-red-300",
    subtitle: "text-red-400/80",
    badge: "bg-red-500/15 text-red-200 border-red-500/40",
    button: "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.35)]",
    ring: "border-red-500",
  },
  blue: {
    face: { size: "480%", position: "49.5% 9%" },
    card: "border-blue-500/40 hover:border-blue-400/80 bg-zinc-950",
    overlay: "from-blue-950/55 via-zinc-950/80 to-zinc-950/95",
    emblem: "text-blue-300 bg-blue-500/10 border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.35)]",
    title: "text-blue-300",
    subtitle: "text-blue-400/80",
    badge: "bg-blue-500/15 text-blue-200 border-blue-500/40",
    button: "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.35)]",
    ring: "border-blue-500",
  },
} as const;

const STATUS_LABELS: Record<string, string> = {
  forbidden: "Proibida",
  limited: "Limitada (1)",
  "semi-limited": "Semi-limitada (2)",
};

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function RandomPage() {
  const router = useRouter();
  const [data, setData] = useState<RandomData | null>(null);
  const [queue, setQueue] = useState<QueueStatus>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadData = useCallback(async () => {
    const res = await fetch("/api/random");
    if (!res.ok) return;
    const json: RandomData = await res.json();
    setData(json);
    setQueue(json.queue);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Duelo encontrado → vai para a mesa
  useEffect(() => {
    if (queue.status === "matched") router.push(`/duel/${queue.matchId}`);
  }, [queue, router]);

  // Enquanto aguarda: consulta a fila (mantém a vaga viva) e atualiza o cronômetro
  useEffect(() => {
    if (queue.status !== "waiting") return;
    const poll = setInterval(async () => {
      const res = await fetch("/api/random/queue");
      if (res.ok) setQueue(await res.json());
    }, POLL_WAITING_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [queue.status]);

  // Parado: atualiza de tempos em tempos quantos jogadores estão aguardando
  useEffect(() => {
    if (queue.status !== "idle") return;
    const poll = setInterval(loadData, POLL_IDLE_MS);
    return () => clearInterval(poll);
  }, [queue.status, loadData]);

  async function join(rooms: RoomId[]) {
    setJoining(rooms.join("+"));
    setError(null);
    const res = await fetch("/api/random/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rooms }),
    });
    const json = await res.json();
    setJoining(null);
    if (res.ok) {
      setNow(Date.now());
      setQueue(json);
    } else {
      setError(json.error ?? "Não foi possível entrar na sala.");
      loadData();
    }
  }

  async function leave() {
    await fetch("/api/random/queue", { method: "DELETE" });
    setQueue({ status: "idle" });
    loadData();
  }

  if (!data) {
    return <div className="container mx-auto max-w-5xl px-4 py-8 text-sm text-zinc-400">Carregando...</div>;
  }

  const roomsById = Object.fromEntries(data.rooms.map((r) => [r.id, r])) as Record<RoomId, Room>;
  const canJoinBoth = Boolean(data.deck) && data.rooms.every((r) => r.deckIssues.length === 0);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* CABEÇALHO */}
      <div className="mb-6 flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-zinc-100">
            <Swords className="w-7 h-7 text-amber-400" />
            Random
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Escolha uma sala e enfrente um oponente aleatório.</p>
        </div>
        {/* DECK EQUIPADO */}
        <Link
          href="/deck-builder"
          className="flex items-center gap-2 self-start rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm hover:border-amber-500/50 sm:self-auto"
        >
          <Layers3 className="w-4 h-4 text-amber-400" />
          {data.deck ? (
            <span className="text-zinc-300">
              Deck: <strong className="text-zinc-100">{data.deck.name}</strong>
            </span>
          ) : (
            <span className="text-amber-400">Monte e equipe um deck →</span>
          )}
        </Link>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {queue.status === "waiting" ? (
        <WaitingPanel
          rooms={queue.rooms.map((id) => roomsById[id])}
          elapsed={formatElapsed(now - new Date(queue.since).getTime())}
          onCancel={leave}
        />
      ) : (
        <>
          {/* COMO FUNCIONA — em uma linha */}
          <ol className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
            {["Escolha a sala", "Aguarde um oponente", "O duelo começa sozinho"].map((step, i) => (
              <li key={step} className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {/* SALAS */}
          <div className="grid gap-5 md:grid-cols-2">
            {data.rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                hasDeck={Boolean(data.deck)}
                joining={joining === room.id}
                onJoin={() => join([room.id])}
              />
            ))}
          </div>

          {/* AGUARDAR NAS DUAS */}
          <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-red-950/40 via-amber-950/30 to-blue-950/40 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3">
              <MillenniumPyramid className="hidden h-10 w-10 shrink-0 text-amber-400 sm:block" />
              <div>
                <p className="font-bold text-zinc-100">Aguardar nas duas salas</p>
                <p className="text-xs text-zinc-400">Mais rápido: o duelo começa na primeira sala em que alguém entrar.</p>
              </div>
            </div>
            <button
              onClick={() => join(["slifer", "obelisk"])}
              disabled={!canJoinBoth || joining !== null}
              className="shrink-0 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors"
            >
              {joining === "slifer+obelisk" ? "Entrando..." : "Aguardar nas duas"}
            </button>
          </div>
          {data.deck && !canJoinBoth && (
            <p className="mt-2 text-center text-xs text-zinc-500">Seu deck precisa ser válido nas duas salas.</p>
          )}
        </>
      )}
    </div>
  );
}

function RoomCard({
  room,
  hasDeck,
  joining,
  onJoin,
}: {
  room: Room;
  hasDeck: boolean;
  joining: boolean;
  onJoin: () => void;
}) {
  const [showBanlist, setShowBanlist] = useState(false);
  const theme = THEMES[room.theme];
  const deckValid = hasDeck && room.deckIssues.length === 0;
  const forbiddenCount = room.banlist.filter((b) => b.status === "forbidden").length;
  const restrictedCount = room.banlist.length - forbiddenCount;

  return (
    <section className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-colors ${theme.card}`}>
      {/* arte do deus egípcio da sala, escurecida para o texto ficar legível */}
      <img
        src={room.artUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_20%] opacity-80 transition-transform duration-700 group-hover:scale-105"
      />
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${theme.overlay}`} />

      <div className="relative flex flex-1 flex-col gap-4">
        {/* EMBLEMA + NOME */}
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 ${theme.emblem}`}>
            <RoomEmblem room={room} />
          </div>
          <div className="min-w-0 [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">
            <p className={`text-[11px] font-semibold uppercase tracking-widest ${theme.subtitle}`}>{room.title}</p>
            <h2 className={`text-2xl font-black tracking-tight ${theme.title}`}>{room.name}</h2>
            <p className="text-xs text-zinc-400">{room.tagline}</p>
          </div>
          <span className={`ml-auto shrink-0 self-start rounded-md border px-2 py-1 text-xs font-bold ${theme.badge}`}>
            {room.level}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-zinc-200 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">{room.description}</p>

        {/* INFOS RÁPIDAS */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {room.waiting === 0 ? "Ninguém aguardando" : `${room.waiting} aguardando`}
          </span>
          <button onClick={() => setShowBanlist((v) => !v)} className="flex items-center gap-1 hover:text-zinc-200">
            Banlist:{" "}
            {room.banlist.length === 0 ? "sem restrições ainda" : `${forbiddenCount} proibida(s), ${restrictedCount} limitada(s)`}
            {room.banlist.length > 0 && (
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBanlist ? "rotate-180" : ""}`} />
            )}
          </button>
        </div>

        {showBanlist && room.banlist.length > 0 && (
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs">
            {room.banlist.map((b) => (
              <li key={b.cardId} className="flex justify-between gap-2 py-0.5">
                <span className="truncate text-zinc-300">{b.name}</span>
                <span className={b.status === "forbidden" ? "text-red-400" : "text-amber-400"}>
                  {STATUS_LABELS[b.status] ?? b.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* VALIDADE DO DECK */}
        {hasDeck &&
          (deckValid ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Seu deck pode entrar.
            </p>
          ) : (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <p className="mb-1 font-semibold">Seu deck não pode entrar:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {room.deckIssues.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      <button
        onClick={onJoin}
        disabled={!deckValid || joining}
        className={`relative mt-5 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none ${theme.button}`}
      >
        {joining ? "Entrando..." : `Entrar na ${room.name}`}
      </button>
    </section>
  );
}

function WaitingPanel({ rooms, elapsed, onCancel }: { rooms: Room[]; elapsed: string; onCancel: () => void }) {
  return (
    <section className="flex flex-col items-center gap-5 rounded-2xl border border-amber-500/30 bg-zinc-900/60 px-6 py-12 text-center">
      {/* emblemas das salas girando devagar ao redor da pirâmide */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-dashed border-amber-500/40 [animation-duration:6s]" />
        <MillenniumPyramid className="h-12 w-12 text-amber-400" />
        {rooms.map((r, i) => {
          const theme = THEMES[r.theme];
          return (
            <span
              key={r.id}
              className={`absolute flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 bg-zinc-950 ${theme.emblem} ${
                i === 0 ? "-left-3 top-1/2 -translate-y-1/2" : "-right-3 top-1/2 -translate-y-1/2"
              }`}
            >
              <RoomEmblem room={r} />
            </span>
          );
        })}
      </div>
      <div>
        <h2 className="text-xl font-bold text-zinc-100">Aguardando um oponente...</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {rooms.map((r, i) => (
            <span key={r.id}>
              {i > 0 && " e "}
              <strong className={THEMES[r.theme].title}>{r.name}</strong>
            </span>
          ))}
        </p>
      </div>
      <p className="font-mono text-3xl text-zinc-200">{elapsed}</p>
      <p className="text-xs text-zinc-500">Deixe esta página aberta. O duelo começa sozinho.</p>
      <button
        onClick={onCancel}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        Sair da fila
      </button>
    </section>
  );
}

/** Emblema da sala: o rosto do deus egípcio, recortado da arte da carta. */
function RoomEmblem({ room }: { room: Room }) {
  const { face } = THEMES[room.theme];
  return (
    <span
      role="img"
      aria-label={room.title}
      className="h-full w-full"
      style={{
        backgroundImage: `url(${room.artUrl})`,
        backgroundSize: face.size,
        backgroundPosition: face.position,
      }}
    />
  );
}
