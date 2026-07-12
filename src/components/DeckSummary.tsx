"use client";

import { validateDeck, type DeckIssue } from "@/lib/validate-deck";
import type { DeckCardUI } from "@/types/card";

export function DeckSummary({
  main,
  extra,
  side,
  banlist,
}: {
  main: DeckCardUI[];
  extra: DeckCardUI[];
  side: DeckCardUI[];
  banlist: { cardId: number; status: any }[];
}) {
  const entries = [...main, ...extra, ...side].map((e) => ({
    cardId: e.card.id,
    section: e.section,
    quantity: e.quantity,
  }));

  const issues: DeckIssue[] = validateDeck(entries, banlist);
  const errors = issues.filter((i) => i.level === "error");

  return (
    <div className="rounded border border-edison-border bg-edison-panel p-3">
      <h3 className="mb-2 text-sm font-semibold">Validação</h3>
      {errors.length === 0 ? (
        <p className="text-sm text-green-400">Deck válido para o formato Edison.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm text-red-400">
          {errors.map((issue, i) => (
            <li key={i}>• {issue.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
