"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { FoilCard } from "@/components/FoilCard";
import { StructureBox } from "@/components/StructureBox";
import { FINISHES, type Finish } from "@/lib/card-finish";

export interface StructureCard {
  id: number;
  name: string;
  type: string;
  imageUrl: string | null;
  section: string;
  quantity: number;
  finish?: string;
}

const SECTIONS = [
  { key: "main", title: "Main Deck" },
  { key: "extra", title: "Extra Deck" },
  { key: "side", title: "Side Deck" },
];
const finishOf = (c: StructureCard): Finish => (c.finish && c.finish in FINISHES ? (c.finish as Finish) : "normal");

/** Conteúdo do Structure Deck em imagens: a caixa, os destaques com raridade e todas as cartas. */
export function StructureContents({
  deck,
  onClose,
}: {
  deck: { name: string; description: string | null; coverImageUrl: string | null; cardCount: number; cards: StructureCard[] };
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState<StructureCard | null>(null);

  // Esc fecha (primeiro a carta ampliada) e a página não rola por trás
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoom) setZoom(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [zoom, onClose]);

  const highlights = deck.cards.filter((c) => finishOf(c) !== "normal").sort((a, b) => FINISHES[finishOf(b)].rank - FINISHES[finishOf(a)].rank);
  const count = (key: string) => deck.cards.filter((c) => c.section === key).reduce((n, c) => n + c.quantity, 0);

  const tile = (c: StructureCard, big = false) => {
    const finish = finishOf(c);
    return (
      <li key={`${c.id}-${c.section}`} className={big ? "w-36 sm:w-40" : ""}>
        <button onClick={() => setZoom(c)} title={c.name} className="group relative block w-full transition hover:scale-105">
          <FoilCard src={c.imageUrl} alt={c.name} finish={finish} interactive={false} />
          <span className="absolute right-1 top-1 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-black text-amber-200 shadow">×{c.quantity}</span>
          {finish !== "normal" && (
            <span className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-black shadow ${FINISHES[finish].badge}`}>{FINISHES[finish].label}</span>
          )}
        </button>
        <p className="mt-1 truncate text-[10px] text-zinc-400" title={c.name}>
          {c.name}
        </p>
      </li>
    );
  };

  // Portal: o blur dos painéis prenderia um modal "fixed" dentro deles
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={deck.name} className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80">O que vem no Structure Deck</p>
            <h2 className="text-lg font-black text-zinc-100">{deck.name}</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto p-4">
          {/* CAIXA + RESUMO + DESTAQUES COM RARIDADE */}
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex shrink-0 justify-center md:w-56">
              <StructureBox name={deck.name} coverImageUrl={deck.coverImageUrl} cardCount={deck.cardCount} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {deck.description && <p className="text-sm text-zinc-400">{deck.description}</p>}
              <p className="text-sm text-zinc-300">
                <strong className="text-amber-200">{deck.cardCount} cartas</strong> · {count("main")} no Main Deck · {count("extra")} no Extra Deck
                {count("side") > 0 && ` · ${count("side")} no Side`}
              </p>
              {highlights.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fuchsia-200">
                    <Sparkles className="h-3.5 w-3.5" /> Vêm com raridade
                  </p>
                  <ul className="flex flex-wrap gap-3">{highlights.map((c) => tile(c, true))}</ul>
                </div>
              )}
            </div>
          </div>

          {/* TODAS AS CARTAS */}
          {SECTIONS.map(({ key, title }) => {
            const list = deck.cards.filter((c) => c.section === key);
            if (list.length === 0) return null;
            return (
              <section key={key}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-300">
                  {title} <span className="text-zinc-600">({count(key)})</span>
                </h3>
                <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">{list.map((c) => tile(c))}</ul>
              </section>
            );
          })}
        </div>
      </div>

      {/* Carta ampliada, com o brilho da raridade */}
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6" onClick={(e) => (e.stopPropagation(), setZoom(null))}>
          <div className="flex w-full max-w-xs flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <FoilCard src={zoom.imageUrl} alt={zoom.name} finish={finishOf(zoom)} className="w-full" />
            <p className="flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-zinc-100">
              {zoom.quantity}× {zoom.name}
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-black ${FINISHES[finishOf(zoom)].badge}`}>{FINISHES[finishOf(zoom)].label}</span>
            </p>
            <button onClick={() => setZoom(null)} className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
