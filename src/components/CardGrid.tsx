"use client";

import type { Card, DeckSection } from "@/types/card";

export function CardGrid({
  cards,
  onAdd,
}: {
  cards: Card[];
  onAdd: (card: Card, section: DeckSection) => void;
}) {
  if (cards.length === 0) {
    return <p className="text-sm text-gray-500">Nenhuma carta encontrada.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cards.map((card) => {
        const isExtraDeckType = card.type === "Monster" && card.description.length === 0;
        const defaultSection: DeckSection = card.type !== "Monster" ? "main" : "main";

        return (
          <div
            key={card.id}
            className="rounded border border-edison-border bg-edison-panel p-2 text-xs"
          >
            <p className="mb-1 font-medium text-gray-100">{card.name}</p>
            <p className="mb-2 text-gray-400">
              {card.type}
              {card.atk != null ? ` · ATK ${card.atk}/${card.def}` : ""}
            </p>
            {card.banlistEntries?.[0] && card.banlistEntries[0].status !== "unlimited" && (
              <p className="mb-2 text-amber-400">
                Banlist: {card.banlistEntries[0].status}
              </p>
            )}
            <div className="flex gap-1">
              <button
                onClick={() => onAdd(card, "main")}
                className="flex-1 rounded bg-edison-gold py-1 text-black hover:opacity-90"
              >
                + Main
              </button>
              <button
                onClick={() => onAdd(card, "extra")}
                className="flex-1 rounded border border-edison-border py-1 hover:bg-edison-border"
              >
                + Extra
              </button>
              <button
                onClick={() => onAdd(card, "side")}
                className="flex-1 rounded border border-edison-border py-1 hover:bg-edison-border"
              >
                + Side
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
