"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, CircleDollarSign, Crown, Gem, Package, Sparkles } from "lucide-react";
import { COSMETIC_TYPES } from "@/lib/cosmetic-types";
import { CREDIT_LABEL } from "@/lib/shop-rules";

type Edition = "base" | "premium";
type Currency = "cash" | "gold" | "money";

interface EditionInfo {
  prices: { cash: number | null; gold: number | null; money: number | null; moneyFull: number | null };
  bought: number;
}

interface StructureDeck {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  moneyDiscountPercent: number;
  cardCount: number;
  cards: { id: number; name: string; type: string; section: string; quantity: number }[];
  cosmetics: { id: string; type: string; name: string }[];
  editions: Record<Edition, EditionInfo>;
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cosmeticTypeLabel = (type: string) => COSMETIC_TYPES.find((t) => t.type === type)?.label ?? type;

export function StructureDecksTab() {
  const router = useRouter();
  const [decks, setDecks] = useState<StructureDeck[] | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/structures");
    if (res.ok) setDecks(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function buy(deck: StructureDeck, edition: Edition, currency: Currency, price: number) {
    const priceText = currency === "gold" ? `${price} gold` : `${price} ${CREDIT_LABEL.toLowerCase()}`;
    if (!confirm(`Comprar ${deck.name} (${edition === "premium" ? "Premium" : "Base"}) por ${priceText}?`)) return;

    setBuying(`${deck.id}-${edition}-${currency}`);
    setFeedback(null);
    const res = await fetch("/api/shop/structures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structureDeckId: deck.id, edition, currency }),
    });
    const json = await res.json();
    setBuying(null);
    setFeedback({ ok: res.ok, text: res.ok ? json.message : json.error ?? "Erro na compra." });
    if (res.ok) {
      load();
      router.refresh(); // atualiza o saldo na barra de navegação
    }
  }

  if (!decks) return <p className="text-sm text-zinc-400">Carregando...</p>;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-zinc-400">
        Um deck pronto para jogar: as cartas vão para a sua coleção e o deck já aparece salvo no Deck Builder.
      </p>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {decks.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-16 text-center">
          <Package className="mx-auto h-8 w-8 text-amber-400" />
          <p className="mt-3 font-bold text-zinc-200">Nenhum Structure Deck à venda ainda</p>
          <p className="mt-1 text-sm text-zinc-500">Os primeiros decks chegam em breve.</p>
        </div>
      ) : (
        decks.map((deck) => <DeckCard key={deck.id} deck={deck} buying={buying} onBuy={buy} />)
      )}
    </div>
  );
}

function DeckCard({
  deck,
  buying,
  onBuy,
}: {
  deck: StructureDeck;
  buying: string | null;
  onBuy: (deck: StructureDeck, edition: Edition, currency: Currency, price: number) => void;
}) {
  const [showCards, setShowCards] = useState(false);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-col gap-5 p-5 md:flex-row">
        {/* CAPA */}
        <div className="mx-auto w-40 shrink-0 md:mx-0">
          <div className="relative aspect-[1/1.45] overflow-hidden rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            {deck.coverImageUrl ? (
              <img src={deck.coverImageUrl} alt={deck.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-zinc-800">
                <Package className="h-10 w-10 text-zinc-600" />
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80">Structure Deck</p>
            <h2 className="text-2xl font-black tracking-tight text-zinc-100">{deck.name}</h2>
            {deck.description && <p className="mt-1 text-sm text-zinc-400">{deck.description}</p>}
            <button
              onClick={() => setShowCards((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              {deck.cardCount} cartas · {showCards ? "Esconder lista" : "Ver cartas"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCards ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* VERSÕES */}
          <div className="grid gap-3 sm:grid-cols-2">
            <EditionPanel deck={deck} edition="base" buying={buying} onBuy={onBuy} />
            <EditionPanel deck={deck} edition="premium" buying={buying} onBuy={onBuy} />
          </div>
        </div>
      </div>

      {showCards && (
        <ul className="grid gap-x-6 gap-y-1 border-t border-zinc-800 bg-zinc-950/40 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {deck.cards.map((c) => (
            <li key={`${c.id}-${c.section}`} className="flex items-center gap-2">
              <span className="w-6 text-right font-bold text-zinc-500">{c.quantity}x</span>
              <span className="truncate text-zinc-300">{c.name}</span>
              {c.section !== "main" && (
                <span className="rounded bg-zinc-800 px-1 text-[10px] uppercase text-zinc-400">{c.section}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function EditionPanel({
  deck,
  edition,
  buying,
  onBuy,
}: {
  deck: StructureDeck;
  edition: Edition;
  buying: string | null;
  onBuy: (deck: StructureDeck, edition: Edition, currency: Currency, price: number) => void;
}) {
  const info = deck.editions[edition];
  const premium = edition === "premium";
  const { cash, gold, money, moneyFull } = info.prices;
  const cosmeticTypes = [...new Set(deck.cosmetics.map((c) => cosmeticTypeLabel(c.type)))];

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        premium
          ? "border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-transparent shadow-[0_0_24px_rgba(245,158,11,0.12)]"
          : "border-zinc-800 bg-zinc-950/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`flex items-center gap-1.5 font-bold ${premium ? "text-amber-300" : "text-zinc-200"}`}>
          {premium && <Crown className="h-4 w-4" />}
          {premium ? "Premium" : "Base"}
        </p>
        {info.bought > 0 && <span className="text-[11px] text-zinc-500">Você já comprou {info.bought}x</span>}
      </div>

      <ul className="flex flex-col gap-1 text-xs text-zinc-300">
        <li className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-400" /> {deck.cardCount} cartas + deck pronto
        </li>
        {premium && (
          <li className="flex items-start gap-1.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>
              <strong className="text-amber-200">Acompanha cosméticos exclusivos</strong>
              {cosmeticTypes.length > 0 && <span className="block text-zinc-400">{cosmeticTypes.join(", ")}</span>}
            </span>
          </li>
        )}
      </ul>

      {/* PREÇOS */}
      <div className="mt-auto flex flex-col gap-2">
        {cash != null && (
          <PriceButton
            loading={buying === `${deck.id}-${edition}-cash`}
            onClick={() => onBuy(deck, edition, "cash", cash)}
            className="bg-purple-600 text-white hover:bg-purple-500"
          >
            <Gem className="h-4 w-4" /> {cash} {CREDIT_LABEL.toLowerCase()}
          </PriceButton>
        )}
        {gold != null && (
          <PriceButton
            loading={buying === `${deck.id}-${edition}-gold`}
            onClick={() => onBuy(deck, edition, "gold", gold)}
            className="bg-zinc-800 text-zinc-100 hover:bg-amber-500 hover:text-black"
          >
            <CircleDollarSign className="h-4 w-4 text-amber-400" /> {gold} gold
          </PriceButton>
        )}
        {money != null && (
          <div
            title="Pagamento com Pix/cartão chega em breve"
            className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-emerald-500/40 px-3 py-2 text-sm"
          >
            <span className="flex items-baseline gap-1.5">
              {deck.moneyDiscountPercent > 0 && moneyFull != null && (
                <span className="text-xs text-zinc-500 line-through">{brl(moneyFull)}</span>
              )}
              <strong className="text-emerald-300">{brl(money)}</strong>
              {deck.moneyDiscountPercent > 0 && (
                <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-bold text-emerald-300">
                  -{deck.moneyDiscountPercent}%
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold uppercase text-zinc-500">Em breve</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PriceButton({
  loading,
  onClick,
  className,
  children,
}: {
  loading: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${className}`}
    >
      {loading ? "Comprando..." : children}
    </button>
  );
}
