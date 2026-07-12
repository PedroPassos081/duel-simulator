"use client";

import type { DeckCardUI, DeckSection as DeckSectionType } from "@/types/card";

const LABELS: Record<DeckSectionType, string> = {
  main: "Main Deck",
  extra: "Extra Deck",
  side: "Side Deck",
};

export function DeckSection({
  section,
  entries,
  onRemove,
}: {
  section: DeckSectionType;
  entries: DeckCardUI[];
  onRemove: (cardId: number) => void;
}) {
  const total = entries.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-300">
        {LABELS[section]} <span className="text-gray-500">({total})</span>
      </h3>
      <div className="flex flex-col gap-1">
        {entries.map((entry) => (
          <div
            key={entry.card.id}
            className="flex items-center justify-between rounded border border-edison-border bg-edison-panel px-2 py-1 text-xs"
          >
            <span>
              {entry.card.name} <span className="text-gray-500">x{entry.quantity}</span>
            </span>
            <button
              onClick={() => onRemove(entry.card.id)}
              className="text-red-400 hover:text-red-300"
              aria-label={`Remover ${entry.card.name}`}
            >
              remover
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-xs text-gray-600">Nenhuma carta ainda.</p>
        )}
      </div>
    </div>
  );
}
