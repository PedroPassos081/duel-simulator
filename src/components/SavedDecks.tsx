"use client";

import { ChevronDown, Copy, Eye, X } from "lucide-react";
import type { Card, DeckSection } from "@/types/card";

export type SavedDeck = {
  id: string;
  name: string;
  isEquipped: boolean;
  cards: { cardId: number; section: DeckSection; quantity: number; card: Card }[];
};

export function SavedDecks({ decks, open, onToggle, preview, onPreview, onDuplicate, onEquip }: {
  decks: SavedDeck[]; open: boolean; onToggle: () => void; preview?: SavedDeck;
  onPreview: (deck?: SavedDeck) => void; onDuplicate: (deck: SavedDeck) => void;
  onEquip: (deck: SavedDeck) => void;
}) {
  const section = (deck: SavedDeck, value: DeckSection) =>
    deck.cards.filter((item) => item.section === value);

  return (
    <>
      <div className="rounded-xl border border-edison-border bg-black/10">
        <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
          <span>Decks salvos <span className="ml-1 text-gray-500">({decks.length}/20)</span></span>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div className="space-y-2 border-t border-edison-border p-3">
          {decks.map((deck) => (
            <div key={deck.id} className="flex items-center gap-3 rounded-lg border border-edison-border bg-edison-panel px-3 py-2">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{deck.name}</p><p className="text-xs text-gray-500">{deck.cards.reduce((n, c) => n + c.quantity, 0)} cartas {deck.isEquipped && <span className="text-edison-gold">· Equipado</span>}</p></div>
              <button onClick={() => onPreview(deck)} className="flex items-center gap-1 rounded border border-edison-border px-2 py-1 text-xs hover:bg-zinc-800"><Eye className="h-3 w-3" /> Visualizar</button>
              <button onClick={() => onDuplicate(deck)} className="flex items-center gap-1 rounded border border-edison-border px-2 py-1 text-xs hover:bg-zinc-800"><Copy className="h-3 w-3" /> Duplicar</button>
              <button onClick={() => onEquip(deck)} disabled={deck.isEquipped} className="rounded bg-edison-gold px-2 py-1 text-xs font-bold text-black disabled:opacity-40">Equipar</button>
            </div>
          ))}
          {!decks.length && <p className="py-4 text-center text-sm text-gray-500">Nenhum deck salvo.</p>}
        </div>}
      </div>

      {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => onPreview()}>
        <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-edison-border bg-edison-bg p-5" onClick={(e) => e.stopPropagation()}>
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-edison-gold">Visualização do deck</p><h2 className="text-xl font-bold">{preview.name}</h2></div><button onClick={() => onPreview()} className="rounded-lg border border-edison-border p-2 hover:bg-zinc-800"><X className="h-5 w-5" /></button></div>
          {(["main", "extra", "side"] as DeckSection[]).map((key) => <section key={key} className="mb-5"><h3 className="mb-2 text-sm font-semibold capitalize">{key} Deck ({section(preview, key).reduce((n, c) => n + c.quantity, 0)})</h3><div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 md:grid-cols-12">{section(preview, key).flatMap((item) => Array.from({ length: item.quantity }, (_, i) => item.card.imageUrl ? <img key={`${item.cardId}-${i}`} src={item.card.imageUrl} alt={item.card.name} className="w-full rounded border border-edison-border" /> : <div key={`${item.cardId}-${i}`} className="aspect-[421/614] rounded border border-edison-border p-1 text-[8px]">{item.card.name}</div>))}</div></section>)}
          <div className="flex justify-center"><button onClick={() => onEquip(preview)} className="rounded-lg bg-edison-gold px-6 py-2 font-bold text-black">{preview.isEquipped ? "Deck equipado" : "Equipar este deck"}</button></div>
        </div>
      </div>}
    </>
  );
}
