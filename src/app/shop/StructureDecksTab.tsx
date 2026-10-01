"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle, Check, Crown, Layers, Sparkles, Tag } from "lucide-react";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { COSMETIC_TYPES } from "@/lib/cosmetic-types";
import { CREDIT_LABEL } from "@/lib/shop-rules";
import { Avatar } from "@/components/Avatar";
import { PlaymatView, SleeveView } from "@/components/cosmetics/CosmeticArt";
import { StructureBox } from "@/components/StructureBox";
import { BoxIcon } from "@/components/theme/BoxIcon";
import { MillenniumPouch } from "@/components/theme/EgyptIcons";
import { StructureContents, type StructureCard } from "./StructureContents";

type Edition = "base" | "premium";
type Order = Edition | "upgrade";
interface Coins {
  gold: number;
  cash: number;
}

interface EditionInfo {
  loose: Coins; // as mesmas cartas compradas uma a uma na loja
  price: Coins; // o que paga no Structure Deck (gold + crédito juntos)
  discountPercent: number;
  money: number | null;
  moneyFull: number | null;
  moneyDiscountPercent: number;
}

interface StructureDeck {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  cardCount: number;
  cards: StructureCard[];
  cosmetics: {
    id: string;
    type: string;
    name: string;
    imageUrl: string | null;
    effect: string | null;
  }[];
  premiumItems: { item: string; quantity: number; name: string }[];
  editions: Record<Edition, EditionInfo>;
  owned: "none" | Edition; // cada deck é comprado uma vez só
  upgrade: { price: Coins; money: number | null }; // Base → Premium pagando a diferença
}

const n = (v: number) => v.toLocaleString("pt-BR");
const coinsText = (c: Coins) =>
  [c.gold > 0 ? `${n(c.gold)} gold` : null, c.cash > 0 ? `${c.cash} ${CREDIT_LABEL.toLowerCase()}` : null].filter(Boolean).join(" + ");
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cosmeticTypeLabel = (type: string) => COSMETIC_TYPES.find((t) => t.type === type)?.label ?? type;

export function StructureDecksTab() {
  const router = useRouter();
  const [decks, setDecks] = useState<StructureDeck[] | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/structures");
    if (res.ok) setDecks(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function buy(deck: StructureDeck, edition: Order) {
    if (edition === "upgrade") {
      const text = `Subir ${deck.name} para Premium por ${coinsText(deck.upgrade.price)}?\n\nVocê paga só a diferença e recebe os cosméticos e itens da Premium (as cartas você já tem).`;
      if (!confirm(text)) return;
    } else {
      const info = deck.editions[edition];
      const label = edition === "premium" ? "Premium" : "Base";
      const text = `Comprar ${deck.name} (${label}) por ${coinsText(info.price)}?\n\nAvulsas, essas cartas custariam ${coinsText(info.loose)}. Cada Structure Deck pode ser comprado uma vez.`;
      if (!confirm(text)) return;
    }

    setBuying(`${deck.id}-${edition}`);
    setFeedback(null);
    const res = await fetch("/api/shop/structures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structureDeckId: deck.id,
        edition,
        currency: "coins",
      }),
    });
    const json = await res.json();
    setBuying(null);
    setFeedback({
      ok: res.ok,
      text: res.ok ? json.message : (json.error ?? "Erro na compra."),
    });
    if (res.ok) {
      load();
      router.refresh(); // atualiza o saldo na barra de navegação
    }
  }

  if (!decks) return <p className="text-sm text-zinc-400">Carregando...</p>;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-zinc-400">
        Um deck pronto para jogar: as cartas vão para a sua Maleta e o deck já aparece salvo no Deck Builder.
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
          <BoxIcon className="mx-auto h-10 w-10 text-amber-400" />
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
  onBuy: (deck: StructureDeck, edition: Order) => void;
}) {
  const [showCards, setShowCards] = useState(false);

  return (
    <article className="overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-red-950/30">
      <div className="flex flex-col gap-5 p-5 md:flex-row">
        {/* CAIXA */}
        <div className="flex shrink-0 items-center justify-center px-4 pb-4 pt-2 md:w-60">
          <StructureBox name={deck.name} coverImageUrl={deck.coverImageUrl} cardCount={deck.cardCount} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80">Structure Deck</p>
            <h2 className="text-2xl font-black tracking-tight text-zinc-100">{deck.name}</h2>
            {deck.description && <p className="mt-1 text-sm text-zinc-400">{deck.description}</p>}
            <button
              onClick={() => setShowCards(true)}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/20"
            >
              <Layers className="h-3.5 w-3.5" /> Ver as {deck.cardCount} cartas e raridades
            </button>
          </div>

          {/* VERSÕES */}
          <div className="grid gap-3 sm:grid-cols-2">
            <EditionPanel deck={deck} edition="base" buying={buying} onBuy={onBuy} />
            <EditionPanel deck={deck} edition="premium" buying={buying} onBuy={onBuy} />
          </div>
        </div>
      </div>

      {showCards && <StructureContents deck={deck} onClose={() => setShowCards(false)} />}
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
  onBuy: (deck: StructureDeck, edition: Order) => void;
}) {
  const info = deck.editions[edition];
  const premium = edition === "premium";
  // Já tem esta edição (ou a Premium)? Tem a Base e esta é a Premium? → upgrade pela diferença
  const owned = deck.owned === edition || deck.owned === "premium";
  const upgrading = premium && deck.owned === "base";
  const order: Order = upgrading ? "upgrade" : edition;
  const loose = upgrading ? info.price : info.loose; // no upgrade, o riscado é o preço cheio da Premium
  const price = upgrading ? deck.upgrade.price : info.price;
  const money = upgrading ? deck.upgrade.money : info.money;
  const moneyFull = upgrading ? info.money : info.moneyFull;
  const moneyOff =
    money != null && moneyFull != null && moneyFull > money
      ? upgrading
        ? Math.round((1 - money / moneyFull) * 100)
        : info.moneyDiscountPercent
      : 0;
  const off = upgrading
    ? loose.gold + loose.cash > 0
      ? Math.round((1 - (price.gold + price.cash * 100) / (loose.gold + loose.cash * 100)) * 100)
      : 0
    : info.discountPercent;
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
        {owned && (
          <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">
            <Check className="h-3 w-3" /> Você já tem
          </span>
        )}
        {upgrading && <span className="text-[11px] font-bold text-amber-300">Você tem a Base</span>}
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
        {premium && deck.premiumItems.length > 0 && (
          <li className="flex items-start gap-1.5">
            <MillenniumPouch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="text-zinc-300">{deck.premiumItems.map((i) => `${i.quantity}x ${i.name}`).join(", ")}</span>
          </li>
        )}
        {premium && deck.cosmetics.some((c) => c.type === "sleeve" || c.type === "playmat") && (
          <li className="flex items-center gap-1.5 text-zinc-400">
            <Check className="h-3.5 w-3.5 text-emerald-400" /> Sleeve e playmat já equipados no deck
          </li>
        )}
      </ul>

      {/* prévia dos cosméticos que vêm na caixa Premium */}
      {premium && deck.cosmetics.length > 0 && (
        <div className="flex items-end justify-center gap-3 rounded-lg bg-black/30 p-3">
          {deck.cosmetics.map((c) => (
            <div key={c.id} title={c.name} className="flex flex-col items-center gap-1">
              {c.type === "sleeve" && <SleeveView url={c.imageUrl} className="h-16" />}
              {c.type === "playmat" && <PlaymatView url={c.imageUrl} theme={c.effect} zones={false} className="w-24" />}
              {c.type === "frame" && <Avatar name="?" size={44} frameUrl={c.imageUrl} />}
              <span className="text-[10px] font-semibold uppercase text-zinc-400">{cosmeticTypeLabel(c.type)}</span>
            </div>
          ))}
        </div>
      )}

      {/* PREÇO: gold + crédito juntos, com o valor avulso riscado */}
      <div className="mt-auto flex flex-col gap-2">
        {owned ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 text-center text-xs text-emerald-200">
            {premium || deck.owned === "premium"
              ? "Deck adquirido na versão Premium."
              : "Deck adquirido. Cada Structure Deck é comprado uma vez."}
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-amber-500/30 bg-black/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {upgrading ? "Premium completa" : "Avulsas na loja"}
                </span>
                {off > 0 && (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-black text-emerald-300">
                    <Tag className="h-3 w-3" /> -{off}%
                  </span>
                )}
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 line-through decoration-red-400/70">
                <Coin gold={loose.gold} cash={loose.cash} />
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                {upgrading ? "Você paga só a diferença" : "Você paga"}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-lg font-black text-zinc-100">
                <Coin gold={price.gold} cash={price.cash} big />
              </p>
              {(loose.gold > price.gold || loose.cash > price.cash) && (
                <p className="mt-1 text-[11px] text-emerald-300">
                  Economia de{" "}
                  {coinsText({
                    gold: loose.gold - price.gold,
                    cash: loose.cash - price.cash,
                  })}
                </p>
              )}
            </div>
            <PriceButton
              loading={buying === `${deck.id}-${order}`}
              onClick={() => onBuy(deck, order)}
              className={
                premium
                  ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:brightness-110"
                  : "bg-zinc-800 text-zinc-100 hover:bg-amber-500 hover:text-black"
              }
            >
              {upgrading ? (
                <>
                  <ArrowUpCircle className="h-4 w-4" /> Subir para Premium
                </>
              ) : (
                <>Comprar {premium ? "Premium" : "Base"}</>
              )}
            </PriceButton>
            {money != null && (
              <div
                title="Pagamento com Pix/cartão chega em breve"
                className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-emerald-500/40 px-3 py-2 text-sm"
              >
                <span className="flex flex-wrap items-baseline gap-1.5">
                  {moneyOff > 0 && <span className="text-xs text-zinc-500 line-through decoration-red-400/70">{brl(moneyFull!)}</span>}
                  <strong className="text-emerald-300">{brl(money)}</strong>
                  {moneyOff > 0 && (
                    <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-bold text-emerald-300">-{moneyOff}%</span>
                  )}
                </span>
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Em breve</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Coin({ gold, cash, big = false }: { gold: number; cash: number; big?: boolean }) {
  const icon = big ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <>
      {gold > 0 && (
        <span className="flex items-center gap-1">
          <GoldIcon className={`${icon} text-amber-400`} /> {n(gold)}
        </span>
      )}
      {gold > 0 && cash > 0 && <span className="text-zinc-500">+</span>}
      {cash > 0 && (
        <span className="flex items-center gap-1">
          <CreditIcon className={icon} /> {cash}
        </span>
      )}
    </>
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
