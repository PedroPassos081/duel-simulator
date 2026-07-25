"use client";

import type { DeckCardUI, DeckSection as Section } from "@/types/card";

const LABELS: Record<Section, string> = { main: "Main Deck", extra: "Extra Deck", side: "Side Deck" };

function cardTypeOrder(type: string) {
  if (/spell/i.test(type)) return 1;
  if (/trap/i.test(type)) return 2;
  return 0;
}

export function DeckSection({ section, entries, onRemove }: { section: Section; entries: DeckCardUI[]; onRemove: (id: number) => void }) {
  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const sortedEntries = [...entries].sort((a, b) => {
    const typeDifference =
      cardTypeOrder(a.card.type) - cardTypeOrder(b.card.type);

    if (typeDifference !== 0) return typeDifference;

    return a.card.name.localeCompare(b.card.name, "pt-BR");
  });

  return (
    <section className="rounded-2xl border border-edison-border bg-edison-panel p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{LABELS[section]}</h2><span className="rounded-full bg-black/30 px-2.5 py-1 text-xs text-gray-400">{total} cartas</span></div>
      <div className="grid min-h-28 grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
        {sortedEntries.flatMap((entry) => Array.from({ length: entry.quantity }, (_, index) => (
          <button key={`${entry.card.id}-${index}`} onClick={() => onRemove(entry.card.id)} title={`Remover ${entry.card.name}`} className="group relative overflow-hidden rounded border border-edison-border bg-black/20 hover:border-red-400">
            {entry.card.imageUrl ? <img src={entry.card.imageUrl} alt={entry.card.name} className="aspect-[421/614] w-full object-cover" /> : <span className="flex aspect-[421/614] items-center p-1 text-[9px]">{entry.card.name}</span>}
            <span className="absolute inset-0 flex items-center justify-center bg-red-950/75 text-lg font-bold opacity-0 transition group-hover:opacity-100">−</span>
          </button>
        )))}
        {!entries.length && <p className="col-span-full m-auto text-sm text-gray-600">Adicione cartas da sua coleção.</p>}
      </div>
    </section>
  );
}
