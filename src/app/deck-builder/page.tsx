"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Save, Search } from "lucide-react";
import { CardGrid } from "@/components/CardGrid";
import { CardFilters } from "@/components/CardFilters";
import { CardDetailModal } from "@/components/CardDetailModal";
import { EyeOfHorus } from "@/components/theme/EgyptIcons";
import { DEFAULT_FILTERS, applyFilters, copyLimit, isExtraDeck, monsterTypesOf, type Filters } from "@/lib/card-filters";
import { DeckSection } from "@/components/DeckSection";
import { DeckSummary } from "@/components/DeckSummary";
import { DuelStylePanel } from "@/components/DuelStylePanel";
import { SavedDecks, type SavedDeck } from "@/components/SavedDecks";
import { useDeckBuilderStore } from "@/store/deck-builder-store";
import { exportYdk } from "@/lib/ydk";
import { ART, cardArt } from "@/lib/card-art";
import type { Card, DeckSection as Section } from "@/types/card";

// Cartas mostradas de uma vez na lista do Main/Side (desenhar centenas com brilho pesa)
const MAIN_LIST_SIZE = 60;

export default function DeckBuilderPage() {
  const [collection, setCollection] = useState<Card[]>([]);
  // Mesmo filtro da Loja (nível exato ou faixa, tipo, limite de cópias...)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // Carta aberta nos detalhes (efeito e características). from = de onde foi aberta
  const [inspect, setInspect] = useState<{ card: Card; from: "collection" | Section }>();
  const [extraQuery, setExtraQuery] = useState("");
  const [deckId, setDeckId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [preview, setPreview] = useState<SavedDeck>();
  // Aparência do deck no duelo (null = padrão da conta)
  const [sleeveId, setSleeveId] = useState<string | null>(null);
  const [playmatId, setPlaymatId] = useState<string | null>(null);
  const { deckName, main, extra, side, setDeckName, addCard, removeCard, loadFromEntries, reset } = useDeckBuilderStore();

  useEffect(() => {
    Promise.all([fetch("/api/cards").then((r) => r.json()), fetch("/api/decks").then((r) => r.json())]).then(([cards, decks]: [Card[], SavedDeck[]]) => {
      const ownedCards = Array.isArray(cards) ? cards : [];
      setCollection(ownedCards);
      setDecks(Array.isArray(decks) ? decks : []);
      const equipped = Array.isArray(decks) ? decks.find((d) => d.isEquipped) ?? decks[0] : undefined;
      if (equipped) {
        setDeckId(equipped.id); setDeckName(equipped.name);
        setSleeveId(equipped.sleeveId ?? null); setPlaymatId(equipped.playmatId ?? null);
        loadFromEntries(equipped.cards, new Map(equipped.cards.map((item) => [item.cardId, { ...item.card, ownedQuantity: ownedCards.find((c) => c.id === item.cardId)?.ownedQuantity }])));
      }
    });
  }, [loadFromEntries, setDeckName]);

  const used = (id: number) => [...main, ...extra, ...side].filter((e) => e.card.id === id).reduce((n, e) => n + e.quantity, 0);
  function handleAdd(card: Card, section: Section) { if (used(card.id) < (card.ownedQuantity ?? 0)) addCard(card, section); }
  const entries = [...main, ...extra, ...side].map((e) => ({ cardId: e.card.id, section: e.section, quantity: e.quantity }));

  async function save() {
    setSaving(true); setMessage("");
    const res = await fetch("/api/decks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deckId, name: deckName, cards: entries, sleeveId, playmatId }) });
    const data = await res.json(); setSaving(false);
    if (res.ok) {
      setDeckId(data.id); setMessage("Deck equipado e salvo.");
      setDecks((current) => [data, ...current.filter((deck) => deck.id !== data.id)].map((deck) => ({ ...deck, isEquipped: deck.id === data.id })));
    } else setMessage(data.error ?? data.issues?.map((i: { message: string }) => i.message).join(" ") ?? "Não foi possível salvar.");
  }

  function loadDeck(deck: SavedDeck) {
    setDeckId(deck.id); setDeckName(deck.name);
    setSleeveId(deck.sleeveId ?? null); setPlaymatId(deck.playmatId ?? null);
    loadFromEntries(deck.cards, new Map(deck.cards.map((item) => [item.cardId, { ...item.card, ownedQuantity: collection.find((card) => card.id === item.cardId)?.ownedQuantity }])));
  }

  async function equipDeck(deck: SavedDeck) {
    const res = await fetch(`/api/decks/${deck.id}`, { method: "PATCH" });
    if (!res.ok) return setMessage("Não foi possível equipar o deck.");
    loadDeck(deck); setPreview(undefined);
    setDecks((current) => current.map((item) => ({ ...item, isEquipped: item.id === deck.id })));
    setMessage(`${deck.name} foi equipado.`);
  }

  async function duplicateDeck(deck: SavedDeck) {
    const res = await fetch(`/api/decks/${deck.id}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "Não foi possível duplicar o deck.");
    setDecks((current) => [...current, data]);
    setSavedOpen(true);
    setMessage(`${data.name} foi criado.`);
  }

  // Troca a sleeve/playmat. Deck já salvo: grava na hora; deck novo: vai junto no "Salvar"
  async function changeAppearance(field: "sleeveId" | "playmatId", value: string | null) {
    const setter = field === "sleeveId" ? setSleeveId : setPlaymatId;
    setter(value);
    if (!deckId) return setMessage("Aparência escolhida. Ela será salva junto com o deck.");
    const res = await fetch(`/api/decks/${deckId}/appearance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "Não foi possível trocar a aparência.");
    setDecks((current) => current.map((deck) => (deck.id === deckId ? { ...deck, ...data } : deck)));
    setMessage(field === "sleeveId" ? "Sleeve do deck atualizada." : "Playmat do deck atualizado.");
  }

  function newDeck() {
    if (decks.length >= 20) return setMessage("Você atingiu o limite de 20 decks.");
    reset(); setDeckId(undefined); setSleeveId(null); setPlaymatId(null); setMessage("Novo deck iniciado. Escolha um nome único.");
  }

  function download() {
    const blob = new Blob([exportYdk(entries, deckName)], { type: "text/plain" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${deckName}.ydk`; a.click(); URL.revokeObjectURL(url);
  }

  const isExtraDeckCard = (card: Card) =>
    /fusion|synchro|xyz|link/i.test(card.type);

  // O filtro vale para as duas listas (Main/Side e Extra Deck)
  const matching = useMemo(
    () => applyFilters(collection.map((card) => ({ card, ownedQuantity: card.ownedQuantity ?? 0, maxTotal: card.maxTotal })), filters).map((i) => i.card),
    [collection, filters]
  );
  const races = useMemo(() => monsterTypesOf(collection), [collection]);

  const filtered = matching.filter((card) => !isExtraDeckCard(card));

  const extraDeckCards = matching
    .filter(
      (card) =>
        isExtraDeckCard(card) &&
        card.name.toLowerCase().includes(extraQuery.toLowerCase())
    )
    .slice(0, extraQuery ? 50 : 10);
  return (
    <div className="space-y-5 py-3">
      <header className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-edison-gold/30 bg-edison-panel p-4 sm:flex-row sm:items-center">
        {/* Dark Magician e Blue-Eyes: os dois duelistas clássicos guardando o deck equipado */}
        <img src={cardArt(ART.darkMagician)} alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 animate-banner-drift object-cover object-[center_20%] opacity-40" />
        <img src={cardArt(ART.blueEyes)} alt="" aria-hidden className="pointer-events-none absolute inset-y-0 left-0 h-full w-1/2 object-cover object-[center_20%] opacity-25" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-edison-panel via-edison-panel/85 to-edison-panel/40" />
        <div className="relative flex-1"><p className="text-xs font-medium uppercase tracking-wider text-edison-gold">Deck equipado</p><input value={deckName} onChange={(e) => setDeckName(e.target.value)} className="mt-1 w-full bg-transparent text-xl font-bold outline-none" /></div>
        <div className="relative flex gap-2"><button onClick={download} className="flex h-10 items-center gap-2 rounded-lg border border-edison-border px-4 text-sm"><Download className="h-4 w-4" /> Exportar</button><button onClick={save} disabled={saving} className="flex h-10 items-center gap-2 rounded-lg bg-edison-gold px-4 text-sm font-bold text-black disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Salvando" : "Salvar e equipar"}</button></div>
      </header>
      <DuelStylePanel sleeveId={sleeveId} playmatId={playmatId} onChange={changeAppearance} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <SavedDecks decks={decks} open={savedOpen} onToggle={() => setSavedOpen((value) => !value)} preview={preview} onPreview={setPreview} onDuplicate={duplicateDeck} onEquip={equipDeck} />
        <button onClick={newDeck} className="rounded-xl border border-edison-border bg-edison-panel px-5 py-3 text-sm font-semibold hover:border-edison-gold">+ Novo deck</button>
      </div>
      {message && <p className="rounded-lg border border-edison-border bg-edison-panel px-4 py-3 text-sm text-gray-300">{message}</p>}
      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <aside className="self-start rounded-2xl border border-edison-border bg-edison-panel p-4 xl:sticky xl:top-20">
          <section>
            <h2 className="font-semibold">Main e Side Deck</h2>
            <p className="mb-4 mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
              Clique na carta para adicionar. Toque no
              <EyeOfHorus className="h-2.5 w-4 text-amber-300" />
              para ver o efeito.
            </p>
            <div className="mb-4">
              <CardFilters
                filters={filters}
                onChange={setFilters}
                races={races}
                total={collection.length}
                shown={matching.length}
                mode="deck"
                compact
                placeholder="Buscar para Main ou Side"
              />
            </div>
            <CardGrid cards={filtered.slice(0, MAIN_LIST_SIZE)} onAdd={handleAdd} onInfo={(card) => setInspect({ card, from: "collection" })} />
            {filtered.length > MAIN_LIST_SIZE && (
              <p className="mt-3 text-center text-xs text-gray-500">
                Mostrando {MAIN_LIST_SIZE} de {filtered.length}. Use a busca ou os filtros para achar a carta.
              </p>
            )}
          </section>

          <section className="mt-6 border-t border-edison-border pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-purple-300">Extra Deck</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Fusion, Synchro, Xyz e Link da sua Maleta.
                </p>
              </div>
              <span className="rounded-full bg-purple-400/10 px-2 py-1 text-[10px] font-semibold text-purple-300">
                {collection.filter(isExtraDeckCard).length} cartas
              </span>
            </div>
            <label className="mb-4 flex items-center gap-2 rounded-lg border border-purple-400/20 bg-purple-950/10 px-3 focus-within:border-purple-400">
              <Search className="h-4 w-4 text-purple-300" />
              <input
                value={extraQuery}
                onChange={(e) => setExtraQuery(e.target.value)}
                placeholder="Buscar monstros do Extra Deck"
                className="h-10 w-full bg-transparent text-sm outline-none"
              />
            </label>
            <CardGrid cards={extraDeckCards} onAdd={handleAdd} onInfo={(card) => setInspect({ card, from: "collection" })} />
          </section>
        </aside>
        <main className="space-y-4">
          <DeckSummary main={main} extra={extra} side={side} banlist={[]} />
          <DeckSection section="main" entries={main} onRemove={(id) => removeCard(id, "main")} onInfo={(card) => setInspect({ card, from: "main" })} />
          <DeckSection section="extra" entries={extra} onRemove={(id) => removeCard(id, "extra")} onInfo={(card) => setInspect({ card, from: "extra" })} />
          <DeckSection section="side" entries={side} onRemove={(id) => removeCard(id, "side")} onInfo={(card) => setInspect({ card, from: "side" })} />
        </main>
      </div>

      {/* DETALHES DA CARTA (efeito e características) */}
      {inspect && (() => {
        const owned = collection.find((c) => c.id === inspect.card.id) ?? inspect.card;
        const card = { ...inspect.card, ...owned };
        const inDeck = used(card.id);
        const max = Math.min(card.ownedQuantity ?? 0, copyLimit({ card, ownedQuantity: card.ownedQuantity ?? 0, maxTotal: card.maxTotal }));
        const full = inDeck >= max;
        const targets: Section[] = isExtraDeck(card.type) ? ["extra", "side"] : ["main", "side"];
        const label: Record<Section, string> = { main: "Main", extra: "Extra", side: "Side" };
        const button = "rounded-lg px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
        return (
          <CardDetailModal
            card={card}
            onClose={() => setInspect(undefined)}
            actions={
              <>
                {targets.map((section) => (
                  <button key={section} disabled={full} onClick={() => handleAdd(card, section)} className={`${button} bg-edison-gold text-black hover:brightness-110`}>
                    + {label[section]}
                  </button>
                ))}
                {inspect.from !== "collection" && (
                  <button
                    onClick={() => {
                      removeCard(card.id, inspect.from as Section);
                      // Era a última cópia nessa seção: fecha os detalhes
                      const here = { main, extra, side }[inspect.from as Section].find((e) => e.card.id === card.id)?.quantity ?? 0;
                      if (here <= 1) setInspect(undefined);
                    }}
                    className={`${button} border border-red-400/40 text-red-300 hover:bg-red-950/50`}
                  >
                    − Tirar do {label[inspect.from as Section]}
                  </button>
                )}
                <span className="ml-auto self-center text-xs text-gray-500">
                  No deck: {inDeck}/{max}
                </span>
              </>
            }
          />
        );
      })()}
    </div>
  );
}
