"use client";

import { useState } from "react";
import { CardSearch } from "@/components/CardSearch";
import { CardGrid } from "@/components/CardGrid";
import { DeckSection } from "@/components/DeckSection";
import { DeckSummary } from "@/components/DeckSummary";
import { useDeckBuilderStore } from "@/store/deck-builder-store";
import { exportYdk } from "@/lib/ydk";
import type { Card, DeckSection as DeckSectionType } from "@/types/card";

export default function DeckBuilderPage() {
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { deckName, main, extra, side, setDeckName, addCard, removeCard } =
    useDeckBuilderStore();

  const banlist = [
    // Em produção isso vem de /api/banlist; mantido inline para simplicidade do MVP.
  ] as { cardId: number; status: any }[];

  function handleAdd(card: Card, section: DeckSectionType) {
    addCard(card, section);
  }

  function handleExport() {
    const entries = [...main, ...extra, ...side].map((e) => ({
      cardId: e.card.id,
      section: e.section,
      quantity: e.quantity,
    }));
    const ydk = exportYdk(entries, deckName);
    const blob = new Blob([ydk], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deckName}.ydk`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);

    const entries = [...main, ...extra, ...side].map((e) => ({
      cardId: e.card.id,
      section: e.section,
      quantity: e.quantity,
    }));

    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: deckName, cards: entries }),
    });

    setSaving(false);

    if (res.ok) {
      setSaveMessage("Deck salvo com sucesso.");
    } else {
      const data = await res.json();
      setSaveMessage(
        data.issues
          ? `Não foi possível salvar: ${data.issues.map((i: any) => i.message).join(" ")}`
          : "Erro ao salvar o deck. Faça login primeiro."
      );
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-3">
        <input
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          className="rounded border border-edison-border bg-edison-panel px-3 py-2 text-sm font-medium"
        />
        <CardSearch onResults={setSearchResults} />
        <CardGrid cards={searchResults} onAdd={handleAdd} />
      </div>

      <div className="flex flex-col gap-6">
        <DeckSection section="main" entries={main} onRemove={(id) => removeCard(id, "main")} />
        <DeckSection section="extra" entries={extra} onRemove={(id) => removeCard(id, "extra")} />
        <DeckSection section="side" entries={side} onRemove={(id) => removeCard(id, "side")} />
      </div>

      <div className="flex flex-col gap-4">
        <DeckSummary main={main} extra={extra} side={side} banlist={banlist} />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded bg-edison-gold px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar deck"}
          </button>
          <button
            onClick={handleExport}
            className="flex-1 rounded border border-edison-border px-3 py-2 text-sm hover:bg-edison-panel"
          >
            Exportar .ydk
          </button>
        </div>
        {saveMessage && <p className="text-sm text-gray-400">{saveMessage}</p>}
      </div>
    </div>
  );
}
