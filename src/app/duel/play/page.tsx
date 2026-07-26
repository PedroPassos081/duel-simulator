"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Bug,
  Eye,
  Loader2,
  MessageCircle,
  Circle,
  Hand,
  ScrollText,
  Scissors,
  Send,
  Swords,
  X,
} from "lucide-react";
import type { Card, DeckSection } from "@/types/card";

type EquippedDeck = {
  id: string;
  name: string;
  isEquipped: boolean;
  cards: { section: DeckSection; quantity: number; card: Card }[];
};

type RoomState = {
  id: string;
  status: "waiting" | "rps" | "choosing" | "active";
  meId: string;
  rpsRound: number;
  rpsDeadline?: string | null;
  rpsWinnerId?: string;
  firstPlayerId?: string;
  game?: RoomGameState | null;
  players: {
    id: string;
    nickname: string;
    choiceSubmitted: boolean;
    rpsChoice?: "rock" | "paper" | "scissors";
  }[];
};

type RoomGameState = {
  ownHand: Card[];
  ownMonsters: FieldCardView[];
  ownSpellTraps: FieldCardView[];
  opponentMonsters: FieldCardView[];
  opponentSpellTraps: FieldCardView[];
  ownDeckCount: number;
  ownExtraCount: number;
  opponentHandCount: number;
  opponentDeckCount: number;
  opponentExtraCount: number;
  isYourTurn: boolean;
  currentTurn: number;
  currentPhase: string;
  legalActions: Record<string, DuelCardAction[]>;
};

type DuelCardAction =
  | "summon"
  | "set_monster"
  | "set_spell_trap"
  | "activate"
  | "special_summon";

type FieldCardView = {
  card?: Card;
  faceDown: boolean;
  position: string;
};

const PHASES = ["DP", "SP", "MP1", "BP", "MP2", "EP"];
const PHASE_KEYS: Record<string, string> = {
  DP: "draw",
  SP: "standby",
  MP1: "main1",
  BP: "battle",
  MP2: "main2",
  EP: "end",
};

function CardBack({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`${small ? "h-[clamp(68px,9vh,88px)] aspect-[421/614]" : "h-[clamp(96px,14.5vh,142px)] aspect-[0.72]"} rounded border border-violet-300/50 bg-[#14101c] p-1 shadow-lg`}
    >
      <div className="flex h-full items-center justify-center rounded-sm border border-fuchsia-500/30 bg-[repeating-radial-gradient(ellipse_at_center,#5b214f_0,#25122d_18%,#0b0810_35%)]">
        <span className="-rotate-12 text-[9px] font-black tracking-tighter text-fuchsia-300/70">
          EDS
        </span>
      </div>
    </div>
  );
}

function DeckPile({ count }: { count: number }) {
  return (
    <div className="relative w-fit">
      <CardBack />
      <span className="absolute -bottom-1.5 -right-1.5 flex h-7 min-w-7 items-center justify-center rounded-full border border-white/25 bg-black px-1.5 font-mono text-xs font-black text-white shadow-lg">
        {count}
      </span>
    </div>
  );
}

function EmptyZone({
  accent = "blue",
}: {
  accent?: "blue" | "pink";
}) {
  return (
    <div
      className={`relative flex h-[clamp(96px,14.5vh,142px)] aspect-[0.72] min-h-0 justify-self-center items-center justify-center rounded-[3px] border bg-black/15 ${
        accent === "pink"
          ? "border-fuchsia-300/80 shadow-[inset_0_0_12px_rgba(244,114,182,0.12)]"
          : "border-sky-300/80 shadow-[inset_0_0_12px_rgba(56,189,248,0.12)]"
      }`}
    >
      <div
        className={`h-8 w-8 rotate-45 rounded-sm border-2 ${
          accent === "pink" ? "border-fuchsia-500/50" : "border-sky-400/50"
        }`}
      />
    </div>
  );
}

function ZoneRow({
  opponent = false,
  kind,
  cards = [],
  onSelect,
}: {
  opponent?: boolean;
  kind: "monster" | "spell";
  cards?: FieldCardView[];
  onSelect?: (card: Card) => void;
}) {
  const pink = kind === "spell";
  return (
    <div className={`grid grid-cols-[repeat(5,104px)] justify-center gap-1 ${opponent ? "rotate-180" : ""}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fieldCard = cards[index];
        const card = fieldCard?.card;
        return fieldCard ? (
          <button
            key={`${card?.id ?? "hidden"}-${index}`}
            onClick={() => card && onSelect?.(card)}
            className="group relative h-[clamp(96px,14.5vh,142px)] aspect-[0.72] min-h-0 justify-self-center overflow-hidden rounded-[3px] border border-edison-gold/70 bg-black/30 shadow-lg transition hover:-translate-y-1 hover:border-edison-gold hover:brightness-110"
            title={card ? `Ver ${card.name}` : "Carta virada para baixo"}
          >
            {fieldCard.faceDown || !card?.imageUrl ? (
              <CardBack />
            ) : (
              <Image
                src={card.imageUrl}
                alt={card.name}
                fill
                sizes="100px"
                className="object-cover"
                unoptimized
              />
            )}
          </button>
        ) : (
          <EmptyZone
            key={index}
            accent={pink ? "pink" : "blue"}
          />
        );
      })}
    </div>
  );
}

function CardInspector({ card }: { card?: Card }) {
  const [panel, setPanel] = useState<"card" | "chat" | "log">("card");
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (card) setPanel("card");
  }, [card]);

  function addLocalMessage() {
    const message = chatText.trim();
    if (!message) return;
    setMessages((current) => [...current, message]);
    setChatText("");
  }

  async function sendReport() {
    if (report.trim().length < 10) return;
    setReportStatus("sending");
    const response = await fetch("/api/duel/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: report.trim(),
        context: "Tela de duelo · Turno 01 · Main Phase 1",
      }),
    });
    if (response.ok) {
      setReportStatus("sent");
      setReport("");
    } else {
      setReportStatus("error");
    }
  }

  return (
    <aside className="relative flex h-[calc(100vh-16px)] max-h-[1000px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/55 backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-edison-gold">
          {panel === "card" && <><Eye className="h-4 w-4" /> Carta selecionada</>}
          {panel === "chat" && <><MessageCircle className="h-4 w-4" /> Chat do duelo</>}
          {panel === "log" && <><ScrollText className="h-4 w-4" /> Log do duelo</>}
        </p>
      </div>
      {panel === "card" && card ? (
        <>
          <div className="p-4 pb-3">
            <div className="relative mx-auto aspect-[421/614] w-full max-w-[250px] overflow-hidden rounded shadow-2xl">
              {card.imageUrl ? (
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  sizes="280px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <CardBack />
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 p-4">
            <h2 className="text-lg font-black leading-tight">{card.name}</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-sky-300">
              {card.type}
              {card.race ? ` · ${card.race}` : ""}
            </p>
            {(card.atk !== null || card.def !== null) && (
              <div className="mt-3 flex gap-2 font-mono text-sm font-black">
                <span className="rounded bg-red-500/15 px-2 py-1 text-red-300">
                  ATK {card.atk ?? "?"}
                </span>
                <span className="rounded bg-sky-500/15 px-2 py-1 text-sky-300">
                  DEF {card.def ?? "?"}
                </span>
              </div>
            )}
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/75">
              {card.description}
            </p>
          </div>
        </>
      ) : panel === "card" ? (
        <div className="flex flex-1 flex-col items-center justify-center p-5 text-center text-white/30">
          <Eye className="h-9 w-9" />
          <p className="mt-3 text-xs leading-5">
            Clique em uma carta da mão ou do campo para ler seus dados e efeito.
          </p>
        </div>
      ) : panel === "chat" ? (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-2 text-[10px] leading-4 text-amber-200/65">
            O envio entre os dois duelistas será ativado junto com as salas multiplayer.
          </p>
          <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-black/25 p-2">
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-xs text-white/25">Nenhuma mensagem ainda.</p>
            ) : messages.map((message, index) => (
              <div key={index} className="ml-auto max-w-[85%] rounded-lg bg-sky-600 px-3 py-2 text-xs">
                <strong className="block text-[9px] text-sky-100/70">Você</strong>
                {message}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addLocalMessage()}
              placeholder="Digite uma mensagem..."
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-xs outline-none focus:border-sky-400"
            />
            <button onClick={addLocalMessage} className="rounded-lg bg-sky-600 p-2.5 hover:bg-sky-500">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {[
            "Duelo iniciado.",
            "Você comprou 5 cartas.",
            "Turno 01 iniciado.",
            "Draw Phase concluída.",
            "Standby Phase concluída.",
            "Main Phase 1 iniciada.",
          ].map((entry, index) => (
            <div key={entry} className="flex gap-3 border-b border-white/5 py-2 text-xs">
              <span className="font-mono text-white/25">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-white/65">{entry}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 border-t border-white/10 bg-black/30 p-2">
        <button onClick={() => setPanel("chat")} className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold ${panel === "chat" ? "bg-sky-600" : "bg-white/5 hover:bg-white/10"}`}>
          <MessageCircle className="h-3.5 w-3.5" /> Chat
        </button>
        <button onClick={() => setPanel("log")} className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold ${panel === "log" ? "bg-emerald-600" : "bg-white/5 hover:bg-white/10"}`}>
          <ScrollText className="h-3.5 w-3.5" /> Log
        </button>
        <button onClick={() => { setReportOpen(true); setReportStatus("idle"); }} className="flex items-center justify-center gap-1 rounded-lg bg-red-700/80 py-2 text-[10px] font-bold hover:bg-red-600">
          <Bug className="h-3.5 w-3.5" /> Relatar bug
        </button>
      </div>

      {reportOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full rounded-xl border border-red-400/25 bg-[#15131b] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black">Relatar um bug</h2>
                <p className="mt-1 text-xs font-semibold text-amber-300">Descreva o mais detalhado possível.</p>
              </div>
              <button onClick={() => setReportOpen(false)} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={report}
              onChange={(event) => setReport(event.target.value)}
              rows={8}
              placeholder="Conte o que aconteceu, qual carta ou ação estava usando e o que esperava que acontecesse..."
              className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-black/35 p-3 text-sm outline-none focus:border-red-400"
            />
            {reportStatus === "sent" && <p className="mt-2 text-xs text-emerald-300">Relatório enviado. Obrigado por ajudar.</p>}
            {reportStatus === "error" && <p className="mt-2 text-xs text-red-300">Não foi possível enviar. Verifique a configuração do e-mail.</p>}
            <button
              onClick={sendReport}
              disabled={report.trim().length < 10 || reportStatus === "sending"}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-red-700 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reportStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
              Enviar relatório
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function DuelistHud({ opponent = false }: { opponent?: boolean }) {
  return (
    <section
      className={`flex min-w-56 items-center gap-3 rounded-xl border px-3 py-2 backdrop-blur-md ${
        opponent
          ? "border-red-400/25 bg-red-950/35"
          : "border-sky-400/25 bg-sky-950/35"
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
          opponent
            ? "border-red-400/30 bg-red-500/10 text-red-300"
            : "border-sky-400/30 bg-sky-500/10 text-sky-300"
        }`}
      >
        {opponent ? <Bot className="h-6 w-6" /> : <Swords className="h-6 w-6" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black">
          {opponent ? "Oponente" : "Você"}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
            <div
              className={`h-full w-full ${
                opponent ? "bg-red-500" : "bg-sky-500"
              }`}
            />
          </div>
          <p className="font-mono text-sm font-black">8000 LP</p>
        </div>
      </div>
    </section>
  );
}

function PreDuelGate({
  roomId,
  onGameState,
}: {
  roomId: string;
  onGameState: (game?: RoomGameState | null) => void;
}) {
  const [room, setRoom] = useState<RoomState>();
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const response = await fetch(
        `/api/duel/rooms/${roomId}?time=${Date.now()}`,
        {
        cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        }
      );
      if (response.ok && active) {
        const nextRoom: RoomState = await response.json();
        setRoom(nextRoom);
        onGameState(nextRoom.game);
        setSyncError(false);
      } else if (active) {
        setSyncError(true);
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 700);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [roomId, onGameState]);

  useEffect(() => {
    function updateCountdown() {
      if (!room?.rpsDeadline) {
        setSecondsLeft(15);
        return;
      }
      setSecondsLeft(
        Math.max(0, Math.ceil((new Date(room.rpsDeadline).getTime() - Date.now()) / 1000))
      );
    }
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, [room?.rpsDeadline]);

  if (room?.status === "active") return null;
  const me = room?.players.find((player) => player.id === room.meId);
  const winner = room?.rpsWinnerId === room?.meId;

  async function chooseRps(choice: "rock" | "paper" | "scissors") {
    setSending(true);
    await fetch(`/api/duel/rooms/${roomId}/rps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    });
    setSending(false);
  }

  async function chooseOrder(goFirst: boolean) {
    setSending(true);
    await fetch(`/api/duel/rooms/${roomId}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goFirst }),
    });
    setSending(false);
  }

  async function cancelSearch() {
    setCancelling(true);
    const response = await fetch(`/api/duel/rooms/${roomId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      window.location.href = "/duel";
      return;
    }
    setCancelling(false);
  }

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#080b12]/95 p-6 backdrop-blur-lg">
      <section className="w-full max-w-xl rounded-3xl border border-edison-gold/25 bg-[#15131b] p-8 text-center shadow-2xl">
        {!room || room.status === "waiting" ? (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-edison-gold" />
            <h1 className="mt-5 text-2xl font-black">Procurando oponente</h1>
            <p className="mt-2 text-sm text-white/50">
              Você está na fila. A partida abrirá quando outro jogador apertar Jogar.
            </p>
            <button
              type="button"
              onClick={cancelSearch}
              disabled={cancelling}
              className="mt-7 rounded-xl border border-red-400/30 bg-red-500/10 px-6 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling ? "Cancelando..." : "Cancelar busca"}
            </button>
          </>
        ) : room.status === "rps" ? (
          <>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-edison-gold">
              Rodada {room.rpsRound}
            </p>
            <h1 className="mt-2 text-2xl font-black">Pedra, papel ou tesoura</h1>
            <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-edison-gold/40 bg-edison-gold/10 font-mono text-xl font-black text-edison-gold">
              {secondsLeft}
            </div>
            <p className="mt-2 text-sm text-white/50">
              {me?.choiceSubmitted
                ? "Escolha enviada. Aguardando o outro duelista."
                : "Escolha uma opção. Ela ficará escondida até os dois responderem."}
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              {[
                { value: "rock" as const, label: "Pedra", Icon: Circle },
                { value: "paper" as const, label: "Papel", Icon: Hand },
                { value: "scissors" as const, label: "Tesoura", Icon: Scissors },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => chooseRps(value)}
                  disabled={sending || me?.choiceSubmitted}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 font-black transition hover:border-edison-gold hover:bg-edison-gold/10 disabled:opacity-40"
                >
                  <Icon className="h-9 w-9" />
                  {label}
                </button>
              ))}
            </div>
            {syncError && (
              <p className="mt-4 text-xs text-red-300">
                Reconectando à sala...
              </p>
            )}
          </>
        ) : winner ? (
          <>
            <Swords className="mx-auto h-12 w-12 text-edison-gold" />
            <h1 className="mt-4 text-2xl font-black">Você venceu</h1>
            <p className="mt-2 text-sm text-white/50">
              Escolha a ordem do duelo.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button onClick={() => chooseOrder(true)} disabled={sending} className="rounded-xl bg-edison-gold px-5 py-4 font-black text-black disabled:opacity-50">
                Quero começar
              </button>
              <button onClick={() => chooseOrder(false)} disabled={sending} className="rounded-xl border border-white/15 bg-white/5 px-5 py-4 font-black disabled:opacity-50">
                Quero ir em segundo
              </button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-white/50" />
            <h1 className="mt-5 text-2xl font-black">Aguardando a escolha</h1>
            <p className="mt-2 text-sm text-white/50">
              O vencedor está escolhendo quem começa.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

export default function DuelPlayPage() {
  const [roomId, setRoomId] = useState<string>();
  const [deck, setDeck] = useState<EquippedDeck>();
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<Card>();
  const [playerDeckCount, setPlayerDeckCount] = useState(0);
  const [opponentDeckCount, setOpponentDeckCount] = useState(35);
  const [gameState, setGameState] = useState<RoomGameState | null>();
  const [actionError, setActionError] = useState<string>();
  const [acting, setActing] = useState(false);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number>();

  useEffect(() => {
    setRoomId(new URLSearchParams(window.location.search).get("room") ?? undefined);
    fetch("/api/decks")
      .then((response) => response.json())
      .then((decks: EquippedDeck[]) => {
        if (Array.isArray(decks)) {
          const equippedDeck = decks.find((item) => item.isEquipped);
          setDeck(equippedDeck);
          setSelectedCard(
            equippedDeck?.cards.find((item) => item.section === "main")?.card
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const mainDeck = useMemo(
    () =>
      deck?.cards
        .filter((item) => item.section === "main")
        .flatMap((item) => Array.from({ length: item.quantity }, () => item.card)) ??
      [],
    [deck]
  );
  const extraCount =
    deck?.cards
      .filter((item) => item.section === "extra")
      .reduce((total, item) => total + item.quantity, 0) ?? 0;
  const hand = gameState?.ownHand ?? mainDeck.slice(0, 5);
  const fieldMonsters = gameState?.ownMonsters ?? [];
  const fieldSpellTraps = gameState?.ownSpellTraps ?? [];
  const selectedActions = selectedCard
    ? gameState?.legalActions[String(selectedCard.id)] ?? []
    : [];

  useEffect(() => {
    setPlayerDeckCount(
      gameState?.ownDeckCount ?? Math.max(mainDeck.length - 5, 0)
    );
    setOpponentDeckCount(gameState?.opponentDeckCount ?? 35);
  }, [gameState, mainDeck.length]);

  useEffect(() => {
    function updateDeckCounts(event: Event) {
      const detail = (
        event as CustomEvent<{ player?: number; opponent?: number }>
      ).detail;
      if (Number.isInteger(detail?.player) && detail.player! >= 0) {
        setPlayerDeckCount(detail.player!);
      }
      if (Number.isInteger(detail?.opponent) && detail.opponent! >= 0) {
        setOpponentDeckCount(detail.opponent!);
      }
    }

    window.addEventListener("duel:deck-count", updateDeckCounts);
    return () => window.removeEventListener("duel:deck-count", updateDeckCounts);
  }, []);

  async function sendAction(
    action:
      | { type: "next_phase" | "end_turn" }
      | {
          type: "summon" | "set_monster" | "set_spell_trap";
          cardId: number;
        }
  ) {
    if (!roomId || acting) return;
    setActing(true);
    setActionError(undefined);
    const response = await fetch(`/api/duel/rooms/${roomId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    if (!response.ok) {
      const result = await response.json();
      setActionError(result.error ?? "Não foi possível realizar esta ação.");
    } else {
      setSelectedHandIndex(undefined);
    }
    setActing(false);
  }

  function handleCardAction(action: DuelCardAction, cardId: number) {
    if (action === "activate" || action === "special_summon") return;
    sendAction({ type: action, cardId });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#080b12] text-white">
      {roomId && (
        <PreDuelGate roomId={roomId} onGameState={setGameState} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(77,55,128,0.35),transparent_60%),linear-gradient(135deg,#080b12,#111425_50%,#080b12)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(168,85,247,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,.2)_1px,transparent_1px)] [background-size:80px_80px]" />

      <div className="relative z-10 mx-auto grid h-screen w-full max-w-[1600px] grid-cols-[clamp(300px,25vw,360px)_minmax(0,1fr)] items-center gap-2 overflow-hidden p-2">
        <CardInspector card={selectedCard} />

        <main className="relative mx-auto flex h-[calc(100vh-16px)] max-h-[1000px] w-full max-w-[1160px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[radial-gradient(circle_at_center,rgba(72,39,85,0.65),rgba(8,21,25,0.92)_70%)] p-2 shadow-[0_0_60px_rgba(91,33,182,0.22)]">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,transparent_0,transparent_28%,rgba(168,85,247,.5)_29%,transparent_30%,transparent_43%,rgba(34,211,238,.35)_44%,transparent_45%)]" />

          <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-1">
            <div className="absolute left-1 top-1 z-10">
              <DuelistHud />
            </div>
            <div className="absolute right-1 top-1 z-10">
              <DuelistHud opponent />
            </div>
            <div className="mb-2 flex min-h-[58px] items-start justify-center gap-1 pt-1">
              {Array.from(
                { length: gameState?.opponentHandCount ?? 5 },
                (_, index) => (
                <CardBack key={index} small />
                )
              )}
            </div>

            <div className="mx-auto grid w-full max-w-[790px] grid-cols-[96px_1fr_96px] items-center gap-1 rounded-xl border border-red-400/15 bg-red-950/[0.08] p-1">
              <div className="flex flex-col items-center gap-2">
                <DeckPile count={opponentDeckCount} />
                <EmptyZone accent="blue" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <ZoneRow
                  opponent
                  kind="spell"
                  cards={gameState?.opponentSpellTraps}
                />
                <ZoneRow
                  opponent
                  kind="monster"
                  cards={gameState?.opponentMonsters}
                  onSelect={setSelectedCard}
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <EmptyZone accent="pink" />
                <EmptyZone accent="blue" />
              </div>
            </div>

            <div className="mx-auto w-full max-w-[790px] rounded-xl border border-white/10 bg-black/45 px-3 py-1.5 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-center gap-1.5">
                {PHASES.map((phase) => (
                  <button
                    key={phase}
                    disabled
                    className={`min-w-11 rounded px-3 py-1.5 text-[10px] font-black transition ${
                      PHASE_KEYS[phase] === gameState?.currentPhase
                        ? "bg-emerald-600 text-white shadow-[0_0_14px_rgba(22,163,74,0.35)]"
                        : "border border-white/10 bg-white/10 text-white/50 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    {phase}
                  </button>
                ))}
                <button
                  onClick={() => sendAction({ type: "next_phase" })}
                  disabled={acting || !gameState?.isYourTurn}
                  className="ml-2 rounded bg-emerald-700 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-emerald-600 disabled:opacity-35"
                >
                  Próxima fase
                </button>
                <button
                  onClick={() => sendAction({ type: "end_turn" })}
                  disabled={acting || !gameState?.isYourTurn}
                  className="rounded bg-red-700 px-4 py-1.5 text-[10px] font-black text-white transition hover:bg-red-600 disabled:opacity-35"
                >
                  Terminar turno
                </button>
                <div className="ml-1 flex items-center gap-2 rounded border border-edison-gold/25 bg-edison-gold/10 px-3 py-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/45">
                    Turno
                  </span>
                  <strong className="font-mono text-sm text-edison-gold">
                    {String(gameState?.currentTurn ?? 1).padStart(2, "0")}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-[790px] grid-cols-[96px_1fr_96px] items-center gap-1 rounded-xl border border-sky-400/20 bg-sky-950/[0.1] p-1">
              <div className="flex flex-col items-center gap-2">
                <EmptyZone accent="pink" />
                <div className="relative">
                  <EmptyZone accent="blue" />
                  <span className="absolute -bottom-1 -right-1 rounded bg-black px-1.5 py-0.5 text-[9px] font-bold">
                    {extraCount}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div>
                  <ZoneRow
                    kind="monster"
                    cards={fieldMonsters}
                    onSelect={setSelectedCard}
                  />
                </div>
                <div>
                  <ZoneRow
                    kind="spell"
                    cards={fieldSpellTraps}
                    onSelect={setSelectedCard}
                  />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <EmptyZone accent="blue" />
                <DeckPile count={playerDeckCount} />
              </div>
            </div>

            <div className="flex h-[clamp(132px,20vh,190px)] shrink-0 items-center justify-center gap-2 overflow-visible">
              {loading &&
                Array.from({ length: 5 }, (_, index) => (
                  <CardBack key={index} small />
                ))}
              {!loading &&
                hand.map((card, index) =>
                  card.imageUrl ? (
                    <div
                      key={`${card.id}-${index}`}
                      className="group relative h-[clamp(126px,19vh,184px)] aspect-[421/614] transition hover:z-20"
                    >
                      {selectedHandIndex === index &&
                        selectedActions.length > 0 && (
                          <div className="absolute bottom-[calc(100%+6px)] left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-lg border border-white/15 bg-[#111018]/95 p-1.5 shadow-2xl backdrop-blur">
                            {selectedActions.map((action) => (
                              <button
                                key={action}
                                type="button"
                                onClick={() => handleCardAction(action, card.id)}
                                disabled={acting}
                                className="whitespace-nowrap rounded-md bg-edison-gold px-2.5 py-1.5 text-[10px] font-black text-black transition hover:brightness-110 disabled:opacity-40"
                              >
                                {{
                                  summon: "Normal Summon",
                                  set_monster: "Set",
                                  set_spell_trap: "Set",
                                  activate: "Ativar efeito",
                                  special_summon: "Special Summon",
                                }[action]}
                              </button>
                            ))}
                          </div>
                        )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCard(card);
                          setSelectedHandIndex((current) =>
                            current === index ? undefined : index
                          );
                          setActionError(undefined);
                        }}
                        className={`relative h-full w-full transition hover:-translate-y-2 hover:scale-105 ${
                          selectedHandIndex === index
                            ? "-translate-y-2 ring-2 ring-edison-gold"
                            : ""
                        }`}
                      >
                        <Image
                          src={card.imageUrl}
                          alt={card.name}
                          fill
                          sizes="80px"
                          className="rounded object-cover shadow-xl"
                          unoptimized
                        />
                      </button>
                      {selectedHandIndex === index && actionError && (
                        <p className="absolute left-1/2 top-[calc(100%+4px)] z-50 w-48 -translate-x-1/2 rounded bg-red-950/95 px-2 py-1 text-center text-[9px] text-red-200">
                          {actionError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <CardBack key={`${card.id}-${index}`} small />
                  )
                )}
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}
