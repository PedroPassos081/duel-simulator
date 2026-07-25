"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Download, Save, Search, ShoppingBag } from "lucide-react";
import { CardGrid } from "@/components/CardGrid";
import { DeckSection } from "@/components/DeckSection";
import { DeckSummary } from "@/components/DeckSummary";
import { useDeckBuilderStore } from "@/store/deck-builder-store";
import { exportYdk } from "@/lib/ydk";
import type { Card, DeckSection as Section } from "@/types/card";

type SavedDeck = { id: string; name: string; isEquipped: boolean; cards: { cardId: number; section: Section; quantity: number; card: Card }[] };

export default function DeckBuilderPage() {
  const [collection, setCollection] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [shopQuery, setShopQuery] = useState("");
  const [deckId, setDeckId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { deckName, main, extra, side, setDeckName, addCard, removeCard, loadFromEntries } = useDeckBuilderStore();

  useEffect(() => {
    Promise.all([fetch("/api/cards").then((r) => r.json()), fetch("/api/decks").then((r) => r.json())]).then(([cards, decks]: [Card[], SavedDeck[]]) => {
      const ownedCards = Array.isArray(cards) ? cards : [];
      setCollection(ownedCards);
      const equipped = Array.isArray(decks) ? decks.find((d) => d.isEquipped) ?? decks[0] : undefined;
      if (equipped) {
        setDeckId(equipped.id); setDeckName(equipped.name);
        loadFromEntries(equipped.cards, new Map(equipped.cards.map((item) => [item.cardId, { ...item.card, ownedQuantity: ownedCards.find((c) => c.id === item.cardId)?.ownedQuantity }])));
      }
    });
  }, [loadFromEntries, setDeckName]);

  const used = (id: number) => [...main, ...extra, ...side].filter((e) => e.card.id === id).reduce((n, e) => n + e.quantity, 0);
  function handleAdd(card: Card, section: Section) { if (used(card.id) < (card.ownedQuantity ?? 0)) addCard(card, section); }
  const entries = [...main, ...extra, ...side].map((e) => ({ cardId: e.card.id, section: e.section, quantity: e.quantity }));

  async function save() {
    setSaving(true); setMessage("");
    const res = await fetch("/api/decks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deckId, name: deckName, cards: entries }) });
    const data = await res.json(); setSaving(false);
    if (res.ok) { setDeckId(data.id); setMessage("Deck equipado e salvo."); } else setMessage(data.issues?.map((i: { message: string }) => i.message).join(" ") ?? "Não foi possível salvar.");
  }

  function download() {
    const blob = new Blob([exportYdk(entries, deckName)], { type: "text/plain" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${deckName}.ydk`; a.click(); URL.revokeObjectURL(url);
  }

  const filtered = collection.filter((card) => card.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-5 py-3">
      <header className="flex flex-col gap-4 rounded-2xl border border-edison-border bg-edison-panel p-4 sm:flex-row sm:items-center">
        <div className="flex-1"><p className="text-xs font-medium uppercase tracking-wider text-edison-gold">Deck equipado</p><input value={deckName} onChange={(e) => setDeckName(e.target.value)} className="mt-1 w-full bg-transparent text-xl font-bold outline-none" /></div>
        <div className="flex gap-2"><button onClick={download} className="flex h-10 items-center gap-2 rounded-lg border border-edison-border px-4 text-sm"><Download className="h-4 w-4" /> Exportar</button><button onClick={save} disabled={saving} className="flex h-10 items-center gap-2 rounded-lg bg-edison-gold px-4 text-sm font-bold text-black disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Salvando" : "Salvar e equipar"}</button></div>
      </header>
      {message && <p className="rounded-lg border border-edison-border bg-edison-panel px-4 py-3 text-sm text-gray-300">{message}</p>}
      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <aside className="rounded-2xl border border-edison-border bg-edison-panel p-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:overflow-y-auto">
          <h2 className="font-semibold">Minha coleção</h2><p className="mb-4 mt-1 text-xs text-gray-500">Clique em uma carta para adicionar ao deck.</p>
          <label className="mb-4 flex items-center gap-2 rounded-lg border border-edison-border bg-black/20 px-3"><Search className="h-4 w-4 text-gray-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nas minhas cartas" className="h-10 w-full bg-transparent text-sm outline-none" /></label>
          <CardGrid cards={filtered} onAdd={handleAdd} />
        </aside>
        <main className="space-y-4">
          <DeckSummary main={main} extra={extra} side={side} banlist={[]} />
          <DeckSection section="main" entries={main} onRemove={(id) => removeCard(id, "main")} />
          <DeckSection section="extra" entries={extra} onRemove={(id) => removeCard(id, "extra")} />
          <DeckSection section="side" entries={side} onRemove={(id) => removeCard(id, "side")} />
        </main>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-edison-gold/30 bg-gradient-to-r from-edison-panel to-amber-950/30 p-5 sm:p-7">
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-edison-gold/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-edison-gold text-black">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-edison-gold">
              Loja de cartas
            </p>
            <h2 className="mt-1 text-xl font-bold">
              Não encontrou uma carta na sua coleção?
            </h2>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              Pesquise no catálogo da loja e adquira novas cópias para completar
              sua estratégia.
            </p>
          </div>

          <form
            action="/shop"
            className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
          >
            <label className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-edison-border bg-black/30 px-3 focus-within:border-edison-gold">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                name="q"
                value={shopQuery}
                onChange={(event) => setShopQuery(event.target.value)}
                placeholder="Pesquisar uma carta na loja"
                className="h-full w-full bg-transparent text-sm outline-none placeholder:text-gray-600"
              />
            </label>
            <button className="flex h-11 items-center justify-center gap-2 rounded-lg bg-edison-gold px-5 text-sm font-bold text-black transition hover:brightness-110">
              Buscar na loja
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
