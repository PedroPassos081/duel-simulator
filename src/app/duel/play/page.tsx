"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, Clock3, Eye, Swords } from "lucide-react";
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
      className={`${small ? "h-16 w-11" : "h-[clamp(68px,8.5vh,96px)] w-[clamp(47px,5.8vh,66px)]"} rounded border border-violet-300/50 bg-[#14101c] p-1 shadow-lg`}
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
  label,
}: {
  accent?: "blue" | "pink";
  label?: string;
}) {
  return (
    <div
      className={`relative flex aspect-[0.72] min-h-0 items-center justify-center rounded-[3px] border bg-black/15 ${
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
      {label && (
        <span className="absolute bottom-1 text-[7px] font-bold uppercase tracking-wider text-white/25">
          {label}
        </span>
      )}
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
    <div className={`grid grid-cols-5 gap-[clamp(5px,0.7vw,10px)] ${opponent ? "rotate-180" : ""}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const card = cards[index];
        return card?.imageUrl ? (
          <button
            key={`${card.id}-${index}`}
            onClick={() => onSelect?.(card)}
            className="group relative aspect-[0.72] min-h-0 overflow-hidden rounded-[3px] border border-edison-gold/70 bg-black/30 shadow-lg transition hover:-translate-y-1 hover:border-edison-gold hover:brightness-110"
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
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/80 py-1 text-[7px] font-bold opacity-0 transition group-hover:opacity-100">
              <Eye className="h-2.5 w-2.5" /> Ver carta
            </span>
          </button>
        ) : (
          <EmptyZone
            key={index}
            accent={pink ? "pink" : "blue"}
            label={pink ? "Spell / Trap" : "Monstro"}
          />
        );
      })}
    </div>
  );
}

function CardInspector({ card }: { card?: Card }) {
  return (
    <aside className="flex h-[calc(100vh-82px)] max-h-[900px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/55 backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-edison-gold">
          <Eye className="h-4 w-4" /> Carta selecionada
        </p>
      </div>
      {card ? (
        <>
          <div className="p-4 pb-3">
            <div className="relative mx-auto aspect-[421/614] w-full max-w-[205px] overflow-hidden rounded shadow-2xl">
              {card.imageUrl ? (
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  sizes="240px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <CardBack />
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 p-4">
            <h2 className="text-base font-black leading-tight">{card.name}</h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
              {card.type}
              {card.race ? ` · ${card.race}` : ""}
            </p>
            {(card.atk !== null || card.def !== null) && (
              <div className="mt-3 flex gap-2 font-mono text-xs font-black">
                <span className="rounded bg-red-500/15 px-2 py-1 text-red-300">
                  ATK {card.atk ?? "?"}
                </span>
                <span className="rounded bg-sky-500/15 px-2 py-1 text-sky-300">
                  DEF {card.def ?? "?"}
                </span>
              </div>
            )}
            <p className="mt-3 whitespace-pre-line text-xs leading-5 text-white/70">
              {card.description}
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-5 text-center text-white/30">
          <Eye className="h-9 w-9" />
          <p className="mt-3 text-xs leading-5">
            Clique em uma carta da mão ou do campo para ler seus dados e efeito.
          </p>
        </div>
      )}
    </aside>
  );
}

function PlayerPanel({
  opponent = false,
  deckName,
}: {
  opponent?: boolean;
  deckName?: string;
}) {
  return (
    <section className="w-36 shrink-0 rounded-xl border border-white/10 bg-black/45 p-3 text-center backdrop-blur-md">
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-lg border ${
          opponent
            ? "border-red-400/30 bg-red-500/10 text-red-300"
            : "border-sky-400/30 bg-sky-500/10 text-sky-300"
        }`}
      >
        {opponent ? <Bot className="h-7 w-7" /> : <Swords className="h-7 w-7" />}
      </div>
      <p className="mt-2 truncate text-sm font-bold">
        {opponent ? "CPU Edison" : "Você"}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-white/35">
        {opponent ? "Oponente" : deckName ?? "Deck equipado"}
      </p>
      <div className={`mt-3 h-1.5 rounded-full ${opponent ? "bg-red-500" : "bg-sky-500"}`} />
      <p className="mt-1.5 font-mono text-lg font-black">8000</p>
      <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">
        Pontos de vida
      </span>
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
    <div className="fixed inset-0 z-50 overflow-auto bg-[#080b12] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(77,55,128,0.35),transparent_60%),linear-gradient(135deg,#080b12,#111425_50%,#080b12)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(168,85,247,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,.2)_1px,transparent_1px)] [background-size:80px_80px]" />

      <header className="relative z-10 flex h-14 items-center justify-between border-b border-white/10 bg-black/30 px-4 backdrop-blur-md">
        <Link
          href="/duel"
          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Sair do campo
        </Link>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-edison-gold">
            Duelo Edison
          </p>
          <p className="text-[10px] text-white/35">Turno 1 · Sua vez</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-white/60">
          <Clock3 className="h-4 w-4" /> 05:00
        </div>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-56px)] min-w-[1120px] max-w-[1540px] grid-cols-[260px_minmax(650px,1fr)_170px] items-center gap-4 px-4 py-3">
        <CardInspector card={selectedCard} />

        <main className="relative mx-auto flex h-[calc(100vh-82px)] max-h-[900px] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[radial-gradient(circle_at_center,rgba(72,39,85,0.65),rgba(8,21,25,0.92)_70%)] p-3 shadow-[0_0_60px_rgba(91,33,182,0.22)]">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,transparent_0,transparent_28%,rgba(168,85,247,.5)_29%,transparent_30%,transparent_43%,rgba(34,211,238,.35)_44%,transparent_45%)]" />

          <div className="relative flex min-h-0 flex-1 flex-col justify-evenly gap-2">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: 5 }, (_, index) => (
                <CardBack key={index} small />
              ))}
            </div>

            <div className="grid grid-cols-[70px_1fr_70px] items-center gap-3">
              <div className="space-y-2">
                <EmptyZone accent="pink" label="Campo" />
                <EmptyZone accent="blue" label="Extra" />
              </div>
              <div className="space-y-2">
                <ZoneRow opponent kind="spell" />
                <ZoneRow opponent kind="monster" />
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <CardBack />
                  <span className="absolute -bottom-1 -right-1 rounded bg-black px-1.5 py-0.5 text-[9px] font-bold">
                    35
                  </span>
                </div>
                <EmptyZone accent="blue" label="Cemitério" />
              </div>
            </div>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
              <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/40">
                Campo de duelo
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
            </div>

            <div className="grid grid-cols-[70px_1fr_70px] items-center gap-3">
              <div className="space-y-2">
                <EmptyZone accent="blue" label="Cemitério" />
                <div className="relative">
                  <CardBack />
                  <span className="absolute -bottom-1 -right-1 rounded bg-black px-1.5 py-0.5 text-[9px] font-bold">
                    {Math.max(mainDeck.length - 5, 0)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="mb-1 text-center text-[8px] font-bold uppercase tracking-[0.22em] text-sky-200/55">
                    Zonas de monstros
                  </p>
                  <ZoneRow
                    kind="monster"
                    cards={fieldMonsters}
                    onSelect={setSelectedCard}
                  />
                </div>
                <div>
                  <p className="mb-1 text-center text-[8px] font-bold uppercase tracking-[0.22em] text-fuchsia-200/65">
                    Zonas de Spell / Trap
                  </p>
                  <ZoneRow
                    kind="spell"
                    cards={fieldSpellTraps}
                    onSelect={setSelectedCard}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <EmptyZone accent="blue" label="Extra" />
                <EmptyZone accent="pink" label="Campo" />
              </div>
            </div>

            <div className="flex h-[clamp(72px,10vh,110px)] items-end justify-center gap-1.5">
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
                      className="group relative h-[clamp(68px,9vh,100px)] aspect-[421/614] transition hover:z-10 hover:-translate-y-3 hover:scale-125"
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

        <aside className="flex h-full flex-col items-center justify-between py-4">
          <PlayerPanel opponent />
          <PlayerPanel deckName={deck?.name} />
          <div className="w-full space-y-1">
            <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-white/30">
              Fases
            </p>
            {PHASES.map((phase, index) => (
              <button
                key={phase}
                className={`h-7 w-full border text-[10px] font-bold transition ${
                  index === 0
                    ? "border-emerald-400 bg-emerald-600 text-white"
                    : "border-white/10 bg-black/40 text-white/40 hover:bg-white/10"
                }`}
              >
                {phase}
              </button>
            ))}
          </div>
          <div className="w-full rounded-xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
            <p className="text-xs font-bold">Estado da partida</p>
            <div className="mt-3 space-y-2 text-[10px] text-white/45">
              <div className="flex justify-between">
                <span>Main Deck</span>
                <strong className="text-white/80">{mainDeck.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Extra Deck</span>
                <strong className="text-white/80">{extraCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Cartas na mão</span>
                <strong className="text-white/80">{hand.length}</strong>
              </div>
            </div>
          </div>
          <div className="w-full rounded-xl border border-edison-gold/20 bg-edison-gold/5 p-3 text-center">
            <p className="text-[10px] leading-4 text-white/45">
              Interface visual pronta. As ações serão liberadas quando o motor
              automático for conectado.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
