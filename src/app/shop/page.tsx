"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Crown, Layers, Loader2 } from "lucide-react";
import { BattlePassTab } from "./BattlePassTab";
import { CosmeticShowcase } from "./CosmeticShowcase";
import { RoomBanlistStatus } from "@/components/RoomBanlistStatus";
import { MillenniumPouch } from "@/components/theme/EgyptIcons";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { ArtBanner } from "@/components/theme/ArtBanner";
import { BoxIcon } from "@/components/theme/BoxIcon";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { ART } from "@/lib/card-art";
import { StructureDecksTab } from "./StructureDecksTab";
import { SellTab } from "./SellTab";
import { ItemShopTab } from "./ItemShopTab";
import { BulkBar } from "./BulkBar";
import { useRouter } from "next/navigation";
import { MAX_BULK_SALE } from "@/lib/card-sale-rules";
import { FoilCard } from "@/components/FoilCard";
import { CardFilters } from "@/components/CardFilters";
import { DEFAULT_FILTERS, applyFilters, monsterTypesOf, type Filters } from "@/lib/card-filters";
import {
  BORDERS,
  BORDER_PRICE_MULTIPLIER,
  DEFAULT_FINISH_PERCENTS,
  FINISHES,
  finishPriceMultiplier,
  priceWithVariant,
  upgradeCost,
  variantLabel,
  type Border,
  type Finish,
  type FinishPercents,
} from "@/lib/card-finish";
import type { Card } from "@/types/card";
import {
  CREDIT_LABEL,
  canBuyNextWithGold,
  goldCopyLimit,
  goldLimitNotice,
} from "@/lib/shop-rules";

interface ShopListing {
  id: string;
  cardId: number;
  card: Card;
  priceGold: number | null;
  priceCash: number | null;
  cashOnly: boolean;
  ownedQuantity: number;
  maxTotal: number;
  maxGold: number;
  // Versões que o jogador tem desta carta (Normal, Rara... + borda)
  versions?: { finish: Finish; border: Border; quantity: number }[];
  // Salas em que a carta existe (pool)
  rooms?: string[];
  // Promoção de lançamento: priceGold/priceCash já vêm com desconto; aqui o preço cheio
  promo?: { percent: number; endsAt: string; releaseName: string; priceGold: number | null; priceCash: number | null } | null;
}

// Cartas por página na aba Cartas
const PAGE_SIZE = 60;

type ShopTab = "pass" | "cards" | "structures" | "sell" | "cosmetics";

const SHOP_TABS: { id: ShopTab; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: "pass", label: "Passe de Batalha", icon: Crown, hint: "Suba de nível e ganhe prêmios" },
  { id: "structures", label: "Structure Decks", icon: BoxIcon, hint: "Caixas de deck pronto" },
  { id: "cards", label: "Cartas", icon: Layers, hint: "Cópias avulsas" },
  { id: "sell", label: "Vender", icon: GoldIcon, hint: "Troque cópias por moedas" },
  { id: "cosmetics", label: "Cosméticos", icon: MillenniumPouch, hint: "Vitrine e Pó do Milênio" },
];

export default function ShopPage() {
  const [tab, setTab] = useState<ShopTab>("structures");

  return (
    <GlassPanel className="max-w-7xl">
      {/* Upstart Goblin: o goblin comerciante, com a Pot of Greed de fundo do emblema */}
      <ArtBanner
        art={ART.potOfGreed}
        emblemArt={ART.upstartGoblin}
        eyebrow="Mercado do Goblin"
        title="Loja"
        subtitle="Passe de Batalha, decks prontos, cartas avulsas, venda de cartas e cosméticos."
        tone="emerald"
        position="center 40%"
      />

      {/* ABAS DA LOJA */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:w-fit">
        {SHOP_TABS.map(({ id, label, icon: Icon, hint }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-4 py-2.5 text-center transition-all sm:flex-row sm:gap-2 sm:text-left ${
              tab === id
                ? "border-amber-500 bg-amber-500/10 text-amber-300"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>
              <span className="block text-sm font-bold">{label}</span>
              <span className="hidden text-[11px] opacity-70 sm:block">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {tab === "pass" && <BattlePassTab />}
      {tab === "structures" && <StructureDecksTab />}
      {tab === "cards" && <CardsTab />}
      {tab === "sell" && <SellTab />}
      {tab === "cosmetics" && (
        <>
          <CosmeticShowcase />
          <ItemShopTab />
        </>
      )}
    </GlassPanel>
  );
}

// Última lista carregada: ao voltar para a aba, as cartas aparecem na hora (e atualizam em seguida)
let cachedListings: ShopListing[] | null = null;

function CardsTab() {
  const [listings, setListingsState] = useState<ShopListing[]>(() => cachedListings ?? []);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(cachedListings ? "ready" : "loading");
  const setListings = (next: ShopListing[]) => {
    cachedListings = next;
    setListingsState(next);
  };
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<ShopListing | null>(null);

  // Filtros e ordenação (ver src/lib/card-filters.ts)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // Raridade da cópia a comprar: muda o brilho das cartas e o preço (dobra a cada nível)
  const [finish, setFinish] = useState<Finish>("normal");
  // Borda da cópia: preço próprio (prata 2x, dourada 3x o base) e segue a cópia quando ela evolui
  const [border, setBorder] = useState<Border>("none");
  // Compra em massa: cada item é 1 cópia (com a raridade/borda escolhidas na hora)
  const router = useRouter();
  const [bulk, setBulk] = useState(false);
  const [cart, setCart] = useState<{ cardId: number; finish: Finish; border: Border }[]>([]);
  const [buyingAll, setBuyingAll] = useState(false);
  // % de cada raridade sobre o preço base (definidas no painel do Admin)
  const [finishPercents, setFinishPercents] = useState<FinishPercents>(DEFAULT_FINISH_PERCENTS);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shop/pricing")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.finishPercents && setFinishPercents(data.finishPercents))
      .catch(() => {});
  }, []);

  // Sobe a raridade de uma cópia que o jogador já tem, pagando só a diferença
  async function upgrade(cardId: number, from: { finish: Finish; border: Border }, to: Finish, currency: "gold" | "cash", price: number) {
    const label = currency === "gold" ? "gold" : CREDIT_LABEL.toLowerCase();
    if (!confirm(`Evoluir 1 cópia ${variantLabel(from)} para ${FINISHES[to].label} por ${price.toLocaleString("pt-BR")} ${label}?`)) return;
    setUpgrading(`${cardId}-${from.finish}-${from.border}-${to}-${currency}`);
    setMessage(null);
    const res = await fetch("/api/shop/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, from, to, currency }),
    });
    const data = await res.json();
    setUpgrading(null);
    setMessage(res.ok ? data.message : data.error ?? "Não foi possível evoluir.");
    if (res.ok) {
      loadListings();
      router.refresh(); // atualiza o saldo na barra de navegação
    }
  }

  async function loadListings() {
    try {
      const res = await fetch("/api/shop");
      if (!res.ok) throw new Error(String(res.status));
      setListings(await res.json());
      setLoadState("ready");
    } catch {
      // Mantém o que já estava na tela; sem nada, mostra o erro com "tentar de novo"
      setLoadState(cachedListings ? "ready" : "error");
    }
  }

  useEffect(() => {
    loadListings();
  }, []);

  useEffect(() => {
    if (selectedListing) {
      const updated = listings.find((l) => l.cardId === selectedListing.cardId);
      if (updated) setSelectedListing(updated);
    }
  }, [listings]);

  async function handleBuy(cardId: number, currency: "gold" | "cash") {
    setLoadingId(`${cardId}-${currency}`);
    setMessage(null);

    const res = await fetch("/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, currency, finish, border }),
    });

    const data = await res.json();
    setLoadingId(null);

    if (res.ok) {
      setMessage(
        finish === "normal" && border === "none"
          ? "Compra realizada com sucesso!"
          : `Compra realizada: 1 cópia ${variantLabel({ finish, border })}!`
      );
      loadListings();
    } else {
      setMessage(data.error ?? "Erro na compra.");
    }
  }

  const filteredListings = useMemo(() => applyFilters(listings, filters), [listings, filters]);
  // Mostra 60 cartas por vez (desenhar as 2000+ com brilho de uma vez pesa)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [filters]);
  // Tipos de monstro que aparecem no catálogo (para o filtro)
  const races = useMemo(() => monsterTypesOf(listings.map((l) => l.card)), [listings]);

  // ----- compra em massa -----
  const inCart = (cardId: number) => cart.filter((c) => c.cardId === cardId).length;
  function addToCart(listing: ShopListing) {
    if (listing.ownedQuantity + inCart(listing.cardId) >= listing.maxTotal) {
      return setMessage(`${listing.card.name}: limite de ${listing.maxTotal} cópia(s).`);
    }
    if (cart.length >= MAX_BULK_SALE) return setMessage(`No máximo ${MAX_BULK_SALE} cópias por compra.`);
    setCart((current) => [...current, { cardId: listing.cardId, finish, border }]);
  }
  function removeFromCart(cardId: number) {
    setCart((current) => {
      const i = current.map((c) => c.cardId).lastIndexOf(cardId);
      return i >= 0 ? current.filter((_, j) => j !== i) : current;
    });
  }
  // Total em cada moeda (null = alguma cópia não pode ser paga nessa moeda)
  const cartTotals = useMemo(() => {
    let gold: number | null = 0;
    let cash: number | null = 0;
    const counted = new Map<number, number>();
    for (const item of cart) {
      const listing = listings.find((l) => l.cardId === item.cardId);
      if (!listing) continue;
      const nth = counted.get(item.cardId) ?? 0;
      counted.set(item.cardId, nth + 1);
      // Gold respeita o limite de cópias em gold (ex.: 3ª cópia só com crédito)
      const goldOk = listing.priceGold != null && canBuyNextWithGold(listing, listing.ownedQuantity + nth);
      gold = gold != null && goldOk ? gold + priceWithVariant(listing.priceGold!, item, finishPercents) : null;
      cash = cash != null && listing.priceCash != null ? cash + priceWithVariant(listing.priceCash, item, finishPercents) : null;
    }
    return { gold, cash };
  }, [cart, listings, finishPercents]);

  async function buyCart(currency: "gold" | "cash") {
    const total = currency === "gold" ? cartTotals.gold : cartTotals.cash;
    const label = currency === "gold" ? "gold" : CREDIT_LABEL.toLowerCase();
    if (!confirm(`Comprar ${cart.length} cópia(s) por ${total?.toLocaleString("pt-BR")} ${label}?`)) return;
    setBuyingAll(true);
    setMessage(null);
    const res = await fetch("/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency, items: cart }),
    });
    const data = await res.json();
    setBuyingAll(false);
    if (!res.ok) return setMessage(data.error ?? "Erro na compra.");
    setMessage(`Compra em massa concluída: ${data.count} cópia(s) por ${data.total.toLocaleString("pt-BR")} ${label}.`);
    setCart([]);
    setBulk(false);
    loadListings();
    router.refresh(); // atualiza o saldo na barra de navegação
  }

  return (
    <div className={bulk ? "pb-32" : ""}>
      {message && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 text-sm text-amber-400 font-medium animate-fade-in">
          {message}
        </div>
      )}

      {/* BARRA DE FILTROS */}
      <div className="mb-8 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <CardFilters filters={filters} onChange={setFilters} races={races} total={listings.length} shown={filteredListings.length} />
        <div className="border-t border-zinc-800 pt-3">
          {/* RARIDADE DA CÓPIA (muda o brilho das cartas e o preço) */}
          <RaritySelector finish={finish} onChange={setFinish} border={border} onBorderChange={setBorder} percents={finishPercents} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
          <button
            onClick={() => {
              setBulk((v) => !v);
              setCart([]);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              bulk ? "bg-amber-500 text-black" : "border border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
            }`}
          >
            {bulk ? "Sair da compra em massa" : "Compra em massa"}
          </button>
          <p className="text-xs text-zinc-500">
            {bulk
              ? "Toque nas cartas para escolher. Cada toque soma 1 cópia com a raridade e a borda marcadas acima."
              : "Escolha várias cartas e pague tudo de uma vez."}
          </p>
        </div>
      </div>

      {/* GRID DE CARTAS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filteredListings.slice(0, visibleCount).map((listing) => {
          const maxAllowed = listing.maxTotal;
          const maxed = listing.ownedQuantity >= maxAllowed;
          const goldAllowed = canBuyNextWithGold(listing, listing.ownedQuantity);
          const notice = goldLimitNotice(listing);

          return (
            <div
              key={listing.id}
              className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 transition-all duration-200 hover:border-amber-500/50 hover:bg-zinc-900 shadow-sm"
            >
              <div 
                className="cursor-pointer"
                onClick={() => (bulk ? addToCart(listing) : setSelectedListing(listing))}
              >
                <div className="relative w-full transition-transform duration-300 group-hover:scale-[1.03]">
                  <FoilCard src={listing.card.imageUrl} alt={listing.card.name} finish={finish} border={border} interactive={false} />
                  {listing.promo && (
                    <span className="absolute left-1 top-1 rounded-md bg-rose-500 px-1.5 py-0.5 text-[11px] font-black text-white shadow-lg" title={`Promoção de lançamento: ${listing.promo.releaseName}`}>
                      -{listing.promo.percent}%
                    </span>
                  )}
                  {inCart(listing.cardId) > 0 && (
                    <span className="absolute right-1 top-1 flex items-center gap-1 rounded-full bg-amber-500 py-0.5 pl-2 pr-0.5 text-xs font-black text-black">
                      ×{inCart(listing.cardId)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(listing.cardId);
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-black/30 text-sm leading-none hover:bg-black/50"
                        aria-label="Tirar uma"
                      >
                        −
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 mt-3">
                  <h3 
                    className="font-semibold text-sm text-zinc-200 truncate leading-snug group-hover:text-amber-400 transition-colors" 
                    title={listing.card.name}
                  >
                    {listing.card.name}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Possui:</span>
                    <span className={`font-medium ${maxed ? 'text-amber-500' : 'text-zinc-300'}`}>
                      {listing.ownedQuantity} / {maxAllowed}
                    </span>
                  </div>
                  {notice && (
                    <div className="text-[10px] font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-md px-1.5 py-1 text-center leading-tight">
                      {notice}
                    </div>
                  )}
                </div>
              </div>

              {/* BOTÕES DE COMPRA NA GRID (somem na compra em massa) */}
              <div className={`flex flex-col gap-2 mt-3 pt-2 border-t border-zinc-800/60 ${bulk ? "hidden" : ""}`}>
                <div className="grid grid-cols-2 gap-1.5">
                  {listing.priceGold != null && (
                    <button
                      disabled={maxed || !goldAllowed || loadingId === `${listing.cardId}-gold`}
                      title={!goldAllowed && !maxed ? `Próxima cópia só com ${CREDIT_LABEL.toLowerCase()}` : "Comprar com gold"}
                      onClick={() => handleBuy(listing.cardId, "gold")}
                      className="group/btn rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold py-2 px-1 hover:bg-amber-500 hover:text-black disabled:bg-zinc-800/30 disabled:text-zinc-600 transition-all text-center flex items-center justify-center gap-1 min-h-[32px]"
                    >
                      {loadingId === `${listing.cardId}-gold` ? (
                        "..."
                      ) : (
                        <>
                          <GoldIcon className="w-3.5 h-3.5 text-amber-400 group-hover/btn:text-black transition-colors" />
                          <span>{priceWithVariant(listing.priceGold, { finish, border }, finishPercents)}</span>
                        </>
                      )}
                    </button>
                  )}
                  {/* BOTÃO GEM (ROXO) */}
                  {listing.priceCash != null && (
                    <button
                      disabled={maxed || loadingId === `${listing.cardId}-cash`}
                      title={`Comprar com ${CREDIT_LABEL.toLowerCase()}`}
                      onClick={() => handleBuy(listing.cardId, "cash")}
                      className="group/btn rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold py-2 px-1 hover:bg-purple-500 hover:text-white disabled:bg-zinc-800/30 disabled:text-zinc-600 transition-all text-center flex items-center justify-center gap-1 min-h-[32px]"
                    >
                      {loadingId === `${listing.cardId}-cash` ? (
                        "..."
                      ) : (
                        <>
                          <CreditIcon className="w-3.5 h-3.5 text-purple-400 group-hover/btn:text-white transition-colors" />
                          <span>{priceWithVariant(listing.priceCash, { finish, border }, finishPercents)}</span>
                        </>
                      )}
                    </button>
                  )}
          
                </div>

                {maxed && (
                  <div className="text-center text-[10px] font-medium text-amber-500/80 bg-amber-500/10 py-1 rounded-md border border-amber-500/20">
                    Limite Alcançado
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loadState === "loading" && listings.length === 0 && (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-12 text-center text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Carregando as cartas da loja...
        </p>
      )}
      {loadState === "error" && listings.length === 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-10 text-center text-sm text-red-300">
          Não foi possível carregar as cartas.
          <button
            onClick={() => {
              setLoadState("loading");
              loadListings();
            }}
            className="ml-2 font-bold underline hover:text-red-200"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {filteredListings.length === 0 && listings.length > 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-12 text-center text-sm text-zinc-500">
          Nenhuma carta com esses filtros.
        </p>
      )}
      {visibleCount < filteredListings.length && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            Mostrar mais ({filteredListings.length - visibleCount} restantes)
          </button>
        </div>
      )}

      {bulk && (
        <BulkBar
          count={cart.length}
          onClear={() => setCart([])}
          summary={
            cartTotals.gold == null && cart.length > 0
              ? `Algumas cópias só saem com ${CREDIT_LABEL.toLowerCase()} (limite de cópias em gold).`
              : "Escolha a moeda para pagar tudo."
          }
        >
          <button
            onClick={() => buyCart("gold")}
            disabled={buyingAll || cart.length === 0 || cartTotals.gold == null}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-black text-black hover:bg-amber-400 disabled:opacity-40"
          >
            <GoldIcon className="h-4 w-4" />
            {cartTotals.gold != null ? cartTotals.gold.toLocaleString("pt-BR") : "—"} gold
          </button>
          <button
            onClick={() => buyCart("cash")}
            disabled={buyingAll || cart.length === 0 || cartTotals.cash == null}
            className="flex items-center gap-1.5 rounded-lg bg-purple-500 px-4 py-2 text-sm font-black text-white hover:bg-purple-400 disabled:opacity-40"
          >
            <CreditIcon className="h-4 w-4" />
            {cartTotals.cash != null ? cartTotals.cash.toLocaleString("pt-BR") : "—"} {CREDIT_LABEL.toLowerCase()}
          </button>
        </BulkBar>
      )}

      {/* MODAL DE DETALHES */}
      {selectedListing && (() => {
        const card = selectedListing.card;
        const maxAllowed = selectedListing.maxTotal;
        const maxed = selectedListing.ownedQuantity >= maxAllowed;
        const goldAllowed = canBuyNextWithGold(selectedListing, selectedListing.ownedQuantity);
        const goldLimit = goldCopyLimit(selectedListing);

        // Vai para o body: dentro do GlassPanel (backdrop-filter) o `fixed` ficaria preso à caixa do painel
        return createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div 
              className="absolute inset-0" 
              onClick={() => setSelectedListing(null)} 
            />

            <div className="relative z-10 flex flex-col md:flex-row w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
              <button
                onClick={() => setSelectedListing(null)}
                className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
              >
                ✕
              </button>

              <div className="flex items-center justify-center bg-zinc-950/60 p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-zinc-800">
                <FoilCard src={card.imageUrl} alt={card.name} finish={finish} border={border} className="w-full max-w-[260px]" />
              </div>

              <div className="flex flex-col justify-between p-6 md:w-1/2 gap-4 max-h-[80vh] overflow-y-auto">
                <div className="flex flex-col gap-3">
                  <h2 className="text-2xl font-bold text-zinc-100 leading-tight">
                    {card.name}
                  </h2>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-300 border border-zinc-700">
                      {card.type}
                    </span>
                    {card.attribute && (
                      <span className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1">
                        {card.attribute}
                      </span>
                    )}
                    {card.race && (
                      <span className="rounded-md bg-zinc-800/80 text-zinc-400 px-2 py-1">
                        [{card.race}]
                      </span>
                    )}
                    {card.level && (
                      <span className="rounded-md bg-amber-400/10 text-amber-300 px-2 py-1">
                        ★ Nível {card.level}
                      </span>
                    )}
                  </div>

                  {(card.atk != null || card.def != null) && (
                    <div className="flex items-center gap-4 text-xs font-bold text-zinc-300 bg-zinc-950/40 p-2 rounded-lg border border-zinc-800">
                      {card.atk != null && <span>ATK / {card.atk}</span>}
                      {card.def != null && <span>DEF / {card.def}</span>}
                    </div>
                  )}

                  {selectedListing.promo && (
                    <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      🔥 <strong>Promoção de lançamento: -{selectedListing.promo.percent}%</strong> ({selectedListing.promo.releaseName}) até{" "}
                      {new Date(selectedListing.promo.endsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.
                      {selectedListing.promo.priceGold != null && (
                        <span className="ml-1 text-rose-300/70 line-through">{selectedListing.promo.priceGold.toLocaleString("pt-BR")} gold</span>
                      )}
                    </p>
                  )}

                  {/* Condição da carta em cada sala */}
                  <RoomBanlistStatus entries={card.banlistEntries} rooms={selectedListing.rooms} />

                  <hr className="border-zinc-800" />

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Efeito / Descrição
                    </span>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line bg-zinc-950/30 p-3 rounded-lg border border-zinc-800/50 max-h-[180px] overflow-y-auto">
                      {card.description || "Esta carta não possui descrição de efeito."}
                    </p>
                  </div>
                </div>

                {/* EVOLUIR AS CÓPIAS QUE O JOGADOR JÁ TEM (paga só a diferença) */}
                {(() => {
                  const upgradable = (selectedListing.versions ?? []).filter((v) => v.finish !== "secreta");
                  if (upgradable.length === 0) return null;
                  const higher = (from: Finish) => (Object.keys(FINISHES) as Finish[]).filter((f) => FINISHES[f].rank > FINISHES[from].rank);
                  return (
                    <div className="flex flex-col gap-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-200">Evoluir suas cópias</p>
                      <p className="text-[11px] text-zinc-400">Pague só a diferença e a mesma cópia sobe de raridade (a borda continua).</p>
                      {upgradable.map((v) => (
                        <div key={`${v.finish}-${v.border}`} className="flex flex-col gap-1.5 border-t border-zinc-800/60 pt-2 first:border-t-0 first:pt-0">
                          <span className="text-xs text-zinc-300">
                            Sua {variantLabel(v)} <span className="text-zinc-500">(x{v.quantity})</span> →
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {higher(v.finish).flatMap((to) =>
                              (["gold", "cash"] as const).flatMap((currency) => {
                                const base = currency === "gold" ? selectedListing.priceGold : selectedListing.priceCash;
                                if (base == null) return [];
                                const price = upgradeCost(base, v.finish, to, finishPercents);
                                const key = `${selectedListing.cardId}-${v.finish}-${v.border}-${to}-${currency}`;
                                return [
                                  <button
                                    key={key}
                                    disabled={upgrading !== null}
                                    onClick={() => upgrade(selectedListing.cardId, v, to, currency, price)}
                                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition disabled:opacity-40 ${FINISHES[to].badge} hover:brightness-125`}
                                  >
                                    {FINISHES[to].label} ·{" "}
                                    {currency === "gold" ? <GoldIcon className="h-3 w-3" /> : <CreditIcon className="h-3 w-3" />}
                                    {upgrading === key ? "..." : price.toLocaleString("pt-BR")}
                                  </button>,
                                ];
                              })
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* BOTÕES DE COMPRA NO MODAL */}
                <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800">
                  <RaritySelector finish={finish} onChange={setFinish} border={border} onBorderChange={setBorder} percents={finishPercents} compact />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Na Maleta:</span>
                    <span className={`font-bold ${maxed ? 'text-amber-500' : 'text-zinc-200'}`}>
                      {selectedListing.ownedQuantity} / {maxAllowed}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-purple-200 bg-purple-500/10 border border-purple-500/20 rounded-lg p-2.5 leading-relaxed">
                    <CreditIcon className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>
                      {goldLimit === 0
                        ? `Esta carta só pode ser comprada com ${CREDIT_LABEL.toLowerCase()}.`
                        : goldLimit >= maxAllowed
                          ? `Todas as cópias podem ser compradas com gold ou ${CREDIT_LABEL.toLowerCase()}.`
                          : `${goldLimit === 1 ? "Só a 1ª cópia pode" : `As ${goldLimit} primeiras cópias podem`} ser compradas com gold. As demais, só com ${CREDIT_LABEL.toLowerCase()}.`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {selectedListing.priceGold != null && (
                      <button
                        disabled={maxed || !goldAllowed || loadingId === `${selectedListing.cardId}-gold`}
                        onClick={() => handleBuy(selectedListing.cardId, "gold")}
                        className="rounded-xl bg-amber-500 text-black text-xs font-bold py-3 px-2 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        {loadingId === `${selectedListing.cardId}-gold` ? (
                          "..."
                        ) : (
                          <>
                            <GoldIcon className="w-4 h-4 text-black" />
                            <span>Gold ({priceWithVariant(selectedListing.priceGold, { finish, border }, finishPercents)})</span>
                          </>
                        )}
                      </button>
                    )}
                    {selectedListing.priceCash != null && (
                      <button
                        disabled={maxed || loadingId === `${selectedListing.cardId}-cash`}
                        onClick={() => handleBuy(selectedListing.cardId, "cash")}
                        className="rounded-xl bg-purple-600 text-white text-xs font-bold py-3 px-2 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        {loadingId === `${selectedListing.cardId}-cash` ? (
                          "..."
                        ) : (
                          <>
                            <CreditIcon className="w-4 h-4 text-white" />
                            <span>{CREDIT_LABEL} ({priceWithVariant(selectedListing.priceCash, { finish, border }, finishPercents)})</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {maxed ? (
                    <div className="text-center text-xs font-medium text-amber-500 bg-amber-500/10 py-1.5 rounded-lg border border-amber-500/20">
                      Você já possui o limite máximo dessa carta.
                    </div>
                  ) : !goldAllowed && selectedListing.priceGold != null && (
                    <div className="text-center text-xs font-medium text-purple-300">
                      A {selectedListing.ownedQuantity + 1}ª cópia só pode ser comprada com {CREDIT_LABEL.toLowerCase()}.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

/**
 * Escolha da raridade e da borda da cópia a comprar.
 * Raridade dobra o preço a cada nível; a borda soma 2x (prata) ou 3x (dourada) o preço base.
 */
function RaritySelector({
  finish,
  onChange,
  border,
  onBorderChange,
  compact,
  percents = DEFAULT_FINISH_PERCENTS,
}: {
  finish: Finish;
  onChange: (f: Finish) => void;
  border: Border;
  onBorderChange: (b: Border) => void;
  compact?: boolean;
  percents?: FinishPercents;
}) {
  const option = (active: boolean, activeClass: string) =>
    `rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
      active ? `${activeClass} ring-1 ring-white/20` : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-16 text-xs font-medium text-zinc-400">Raridade:</span>
        {(Object.keys(FINISHES) as Finish[]).map((f) => (
          <button key={f} onClick={() => onChange(f)} className={option(finish === f, FINISHES[f].badge)}>
            {FINISHES[f].label}
            {f !== "normal" && <span className="ml-1 opacity-70">{finishPriceMultiplier(f, percents).toLocaleString("pt-BR")}x</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-16 text-xs font-medium text-zinc-400">Borda:</span>
        {(Object.keys(BORDERS) as Border[]).map((b) => (
          <button
            key={b}
            onClick={() => onBorderChange(b)}
            className={option(
              border === b,
              b === "ouro" ? "bg-amber-500/20 text-amber-200 border-amber-400/40" : b === "prata" ? "bg-zinc-400/20 text-zinc-100 border-zinc-300/40" : "bg-zinc-700 text-zinc-200"
            )}
          >
            {b === "none" ? "Sem borda" : BORDERS[b].label.replace("Borda ", "")}
            {b !== "none" && <span className="ml-1 opacity-70">+{BORDER_PRICE_MULTIPLIER[b]}x</span>}
          </button>
        ))}
      </div>
      {!compact && (finish !== "normal" || border !== "none") && (
        <p className="text-[11px] text-zinc-500">
          Cada compra é 1 cópia {variantLabel({ finish, border })}. A borda continua na cópia quando ela evolui de raridade.
        </p>
      )}
    </div>
  );
}
