"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Bot, Eye, Swords } from "lucide-react";
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
}: {
  accent?: "blue" | "pink";
}) {
  return (
    <div
      className={`relative flex h-[clamp(72px,11vh,110px)] aspect-[0.72] min-h-0 justify-self-center items-center justify-center rounded-[3px] border bg-black/15 ${
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
    <div className={`grid grid-cols-[repeat(5,80px)] justify-center gap-1 ${opponent ? "rotate-180" : ""}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const card = cards[index];
        return card?.imageUrl ? (
          <button
            key={`${card.id}-${index}`}
            onClick={() => onSelect?.(card)}
            className="group relative h-[clamp(72px,11vh,110px)] aspect-[0.72] min-h-0 justify-self-center overflow-hidden rounded-[3px] border border-edison-gold/70 bg-black/30 shadow-lg transition hover:-translate-y-1 hover:border-edison-gold hover:brightness-110"
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
  return (
    <aside className="flex h-[calc(100vh-24px)] max-h-[1000px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/55 backdrop-blur-md">
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

      <div className="relative z-10 mx-auto grid h-screen w-full max-w-[1600px] grid-cols-[clamp(210px,18vw,250px)_minmax(0,1fr)] items-center gap-2 overflow-hidden p-2">
        <CardInspector card={selectedCard} />

        <main className="relative mx-auto flex h-[calc(100vh-16px)] max-h-[1000px] w-full max-w-[1240px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[radial-gradient(circle_at_center,rgba(72,39,85,0.65),rgba(8,21,25,0.92)_70%)] p-2 shadow-[0_0_60px_rgba(91,33,182,0.22)]">
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

            <div className="grid grid-cols-[70px_1fr_70px] items-center gap-1.5 rounded-xl border border-red-400/15 bg-red-950/[0.08] p-1">
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

            <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 shadow-lg backdrop-blur-sm">
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

            <div className="grid grid-cols-[70px_1fr_70px] items-center gap-1.5 rounded-xl border border-sky-400/20 bg-sky-950/[0.1] p-1">
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

            <div className="flex h-[clamp(96px,14vh,140px)] items-end justify-center gap-1.5">
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
                      className="group relative h-[clamp(92px,13vh,134px)] aspect-[421/614] transition hover:z-10 hover:-translate-y-2 hover:scale-105"
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
