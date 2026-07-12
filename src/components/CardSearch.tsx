"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/types/card";

export function CardSearch({ onResults }: { onResults: (cards: Card[]) => void }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/cards?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        onResults(await res.json());
      }
    }, 250); // debounce

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <input
      type="text"
      placeholder="Buscar carta por nome..."
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      className="w-full rounded border border-edison-border bg-edison-panel px-3 py-2 text-sm"
    />
  );
}
