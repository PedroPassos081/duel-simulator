"use client";

import type { Card, DeckSection } from "@/types/card";

export function CardGrid({ cards, onAdd }: { cards: Card[]; onAdd: (card: Card, section: DeckSection) => void }) {
  if (!cards.length) return <div className="rounded-xl border border-dashed border-edison-border p-8 text-center text-sm text-gray-500">Você não possui cartas com esse nome.</div>;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => {
        const extra = /fusion|synchro/i.test(card.type);
        return (
          <button key={card.id} onClick={() => onAdd(card, extra ? "extra" : "main")} title={`Adicionar ${card.name}`} className="group relative overflow-hidden rounded-lg border border-edison-border bg-black/20 text-left transition hover:-translate-y-0.5 hover:border-edison-gold">
            {card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="aspect-[421/614] w-full object-cover" /> : <div className="flex aspect-[421/614] items-center justify-center p-2 text-center text-xs text-gray-500">{card.name}</div>}
            <span className="absolute right-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">x{card.ownedQuantity ?? 0}</span>
            <span className="absolute inset-x-0 bottom-0 translate-y-full bg-edison-gold py-1 text-center text-xs font-bold text-black transition group-hover:translate-y-0">+ Adicionar</span>
          </button>
        );
      })}
    </div>
  );
}
