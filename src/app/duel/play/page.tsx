"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Bug,
  Eye,
  Loader2,
  MessageCircle,
  ScrollText,
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

const PHASES = ["DP", "SP", "MP1", "BP", "MP2", "EP"];

function CardBack({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`${small ? "h-[clamp(68px,9vh,88px)] aspect-[421/614]" : "h-[clamp(78px,10vh,110px)] aspect-[421/614]"} rounded border border-violet-300/50 bg-[#14101c] p-1 shadow-lg`}
    >
      <div className="flex h-full items-center justify-center rounded-sm border border-fuchsia-500/30 bg-[repeating-radial-gradient(ellipse_at_center,#5b214f_0,#25122d_18%,#0b0810_35%)]">
        <span className="-rotate-12 text-[9px] font-black tracking-tighter text-fuchsia-300/70">
          EDS
        </span>
      </div>
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
      className={`relative flex h-[clamp(82px,13vh,126px)] aspect-[0.72] min-h-0 justify-self-center items-center justify-center rounded-[3px] border bg-black/15 ${
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
  cards?: Card[];
  onSelect?: (card: Card) => void;
}) {
  const pink = kind === "spell";
  return (
    <div className={`grid grid-cols-[repeat(5,92px)] justify-center gap-1 ${opponent ? "rotate-180" : ""}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const card = cards[index];
        return card?.imageUrl ? (
          <button
            key={`${card.id}-${index}`}
            onClick={() => onSelect?.(card)}
            className="group relative h-[clamp(82px,13vh,126px)] aspect-[0.72] min-h-0 justify-self-center overflow-hidden rounded-[3px] border border-edison-gold/70 bg-black/30 shadow-lg transition hover:-translate-y-1 hover:border-edison-gold hover:brightness-110"
            title={`Ver ${card.name}`}
          >
            <Image
              src={card.imageUrl}
              alt={card.name}
              fill
              sizes="100px"
              className="object-cover"
              unoptimized
            />
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
          {opponent ? "CPU Edison" : "Você"}
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

export default function DuelPlayPage() {
  const [deck, setDeck] = useState<EquippedDeck>();
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<Card>();

  useEffect(() => {
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
  const hand = mainDeck.slice(0, 5);
  const fieldMonsters = mainDeck
    .filter(
      (card) => !card.type.toLowerCase().includes("spell") && !card.type.toLowerCase().includes("trap")
    )
    .slice(0, 1);
  const fieldSpellTraps = mainDeck
    .filter((card) => {
      const type = card.type.toLowerCase();
      return type.includes("spell") || type.includes("trap");
    })
    .slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#080b12] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(77,55,128,0.35),transparent_60%),linear-gradient(135deg,#080b12,#111425_50%,#080b12)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(168,85,247,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,.2)_1px,transparent_1px)] [background-size:80px_80px]" />

      <div className="relative z-10 mx-auto grid h-screen w-full max-w-[1600px] grid-cols-[clamp(300px,25vw,360px)_minmax(0,1fr)] items-center gap-2 overflow-hidden p-2">
        <CardInspector card={selectedCard} />

        <main className="relative mx-auto flex h-[calc(100vh-16px)] max-h-[1000px] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[radial-gradient(circle_at_center,rgba(72,39,85,0.65),rgba(8,21,25,0.92)_70%)] p-2 shadow-[0_0_60px_rgba(91,33,182,0.22)]">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,transparent_0,transparent_28%,rgba(168,85,247,.5)_29%,transparent_30%,transparent_43%,rgba(34,211,238,.35)_44%,transparent_45%)]" />

          <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-1">
            <div className="flex items-center justify-between gap-4">
              <DuelistHud />
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/35">
                  Turno
                </p>
                <p className="font-mono text-xl font-black text-edison-gold">01</p>
              </div>
              <DuelistHud opponent />
            </div>

            <div className="flex items-center justify-center gap-1">
              {Array.from({ length: 5 }, (_, index) => (
                <CardBack key={index} small />
              ))}
            </div>

            <div className="mx-auto grid w-full max-w-[700px] grid-cols-[82px_1fr_82px] items-center gap-1 rounded-xl border border-red-400/15 bg-red-950/[0.08] p-1">
              <div className="space-y-2">
                <div className="relative">
                  <CardBack />
                  <span className="absolute -bottom-1 -right-1 rounded bg-black px-1.5 py-0.5 text-[9px] font-bold">
                    35
                  </span>
                </div>
                <EmptyZone accent="blue" />
              </div>
              <div className="space-y-2">
                <ZoneRow opponent kind="spell" />
                <ZoneRow opponent kind="monster" />
              </div>
              <div className="space-y-2">
                <EmptyZone accent="pink" />
                <EmptyZone accent="blue" />
              </div>
            </div>

            <div className="mx-auto w-full max-w-[700px] rounded-xl border border-white/10 bg-black/45 px-3 py-2 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-center gap-1.5">
                {PHASES.map((phase, index) => (
                  <button
                    key={phase}
                    className={`min-w-11 rounded px-3 py-1.5 text-[10px] font-black transition ${
                      index === 2
                        ? "bg-emerald-600 text-white shadow-[0_0_14px_rgba(22,163,74,0.35)]"
                        : "border border-white/10 bg-white/10 text-white/50 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    {phase}
                  </button>
                ))}
                <button className="ml-2 rounded bg-red-700 px-4 py-1.5 text-[10px] font-black text-white transition hover:bg-red-600">
                  Finalizar turno
                </button>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-[700px] grid-cols-[82px_1fr_82px] items-center gap-1 rounded-xl border border-sky-400/20 bg-sky-950/[0.1] p-1">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <EmptyZone accent="blue" />
                <div className="relative">
                  <CardBack />
                  <span className="absolute -bottom-1 -right-1 rounded bg-black px-1.5 py-0.5 text-[9px] font-bold">
                    {Math.max(mainDeck.length - 5, 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex h-[clamp(112px,17vh,164px)] items-end justify-center gap-2">
              {loading &&
                Array.from({ length: 5 }, (_, index) => (
                  <CardBack key={index} small />
                ))}
              {!loading &&
                hand.map((card, index) =>
                  card.imageUrl ? (
                    <button
                      key={`${card.id}-${index}`}
                      onClick={() => setSelectedCard(card)}
                      className="group relative h-[clamp(108px,16vh,158px)] aspect-[421/614] transition hover:z-10 hover:-translate-y-2 hover:scale-105"
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
