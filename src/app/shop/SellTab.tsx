"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShieldCheck, X } from "lucide-react";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { FoilCard } from "@/components/FoilCard";
import { MAX_BULK_SALE, quoteCardSale, type SellableInfo } from "@/lib/card-sale-rules";
import type { FinishPercents } from "@/lib/card-finish";
import { CREDIT_LABEL } from "@/lib/shop-rules";
import type { Card } from "@/types/card";

interface SellRow {
  cardId: number;
  card: Card;
  owned: number;
  fromStructure: number;
  deckUse: number;
  info: SellableInfo;
}

type Category = "ALL" | "MONSTER" | "SPELL" | "TRAP";
const CATEGORIES: { id: Category; label: string }[] = [
  { id: "ALL", label: "Todas" },
  { id: "MONSTER", label: "Monstros" },
  { id: "SPELL", label: "Spells" },
  { id: "TRAP", label: "Traps" },
];

function safeQuote(info: SellableInfo, quantity: number, percent: number, finishPercents?: FinishPercents) {
  try {
    return quoteCardSale(info, quantity, percent, finishPercents);
  } catch {
    return { lines: [], gold: 0, cash: 0 };
  }
}

/** Valor com os ícones das moedas: "1.000 [gold] + 20 [crédito]". */
function Money({ gold, cash, className = "" }: { gold: number; cash: number; className?: string }) {
  if (gold === 0 && cash === 0) return <span className={className}>0</span>;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {gold > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-300">
          <GoldIcon className="h-3.5 w-3.5" />
          {gold.toLocaleString("pt-BR")}
        </span>
      )}
      {cash > 0 && (
        <span className="inline-flex items-center gap-1 text-purple-300">
          <CreditIcon className="h-3.5 w-3.5" />
          {cash.toLocaleString("pt-BR")}
        </span>
      )}
    </span>
  );
}

/** Aba Vender da loja: escolha as cópias livres, veja o total e venda tudo de uma vez. */
export function SellTab() {
  const router = useRouter();
  const [data, setData] = useState<{ percent: number; finishPercents: FinishPercents; cards: SellRow[] } | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("ALL");
  const [selection, setSelection] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/sell");
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const percent = data?.percent ?? 0;
  const finishPercents = data?.finishPercents;
  const sellable = useMemo(() => (data?.cards ?? []).filter((r) => r.info.sellable > 0), [data]);
  const protectedCount = (data?.cards.length ?? 0) - sellable.length;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellable.filter(({ card }) => {
      if (q && !card.name.toLowerCase().includes(q)) return false;
      if (category === "MONSTER") return card.type.includes("Monster");
      if (category === "SPELL") return card.type.includes("Spell");
      if (category === "TRAP") return card.type.includes("Trap");
      return true;
    });
  }, [sellable, search, category]);

  // Total da seleção
  const totals = useMemo(() => {
    let gold = 0;
    let cash = 0;
    let copies = 0;
    for (const row of sellable) {
      const qty = selection[row.cardId] ?? 0;
      if (!qty) continue;
      const q = safeQuote(row.info, qty, percent, finishPercents);
      gold += q.gold;
      cash += q.cash;
      copies += q.lines.length;
    }
    return { gold, cash, copies };
  }, [selection, sellable, percent, finishPercents]);

  function change(row: SellRow, by: number) {
    const current = selection[row.cardId] ?? 0;
    const next = Math.max(0, Math.min(row.info.sellable, current + by));
    if (by > 0 && next > current && totals.copies >= MAX_BULK_SALE) {
      return setFeedback({ ok: false, text: `No máximo ${MAX_BULK_SALE} cópias por venda.` });
    }
    const copy = { ...selection };
    if (next > 0) copy[row.cardId] = next;
    else delete copy[row.cardId];
    setSelection(copy);
  }

  async function sell() {
    const items = Object.entries(selection).map(([cardId, quantity]) => ({ cardId: Number(cardId), quantity }));
    const parts = [
      totals.gold > 0 && `${totals.gold.toLocaleString("pt-BR")} gold`,
      totals.cash > 0 && `${totals.cash.toLocaleString("pt-BR")} ${CREDIT_LABEL.toLowerCase()}`,
    ].filter(Boolean);
    if (!confirm(`Vender ${totals.copies} cópia(s) por ${parts.join(" + ")}?`)) return;

    setBusy(true);
    setFeedback(null);
    const res = await fetch("/api/shop/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const result = await res.json();
    setBusy(false);
    if (!res.ok) return setFeedback({ ok: false, text: result.error ?? "Não foi possível vender." });

    setFeedback({ ok: true, text: `Vendido! ${result.copies} cópia(s) foram para a loja e o valor já está na sua carteira.` });
    setSelection({});
    await load();
    router.refresh(); // atualiza o saldo na barra de navegação
  }

  if (!data) return <p className="text-sm text-zinc-500">Carregando sua Maleta...</p>;

  return (
    <div className={totals.copies > 0 ? "pb-28" : ""}>
      {/* COMO FUNCIONA */}
      <div className="mb-4 rounded-xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.07] to-zinc-900/60 p-4">
        <p className="text-sm text-zinc-200">
          Venda por <strong className="text-emerald-300">{percent}% do preço atual da loja</strong>, na moeda em que você comprou.
          Cartas ganhas pagam em gold.
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          Cópias de Structure Deck e as usadas nos seus decks ficam protegidas. Escolha as cópias e venda tudo de uma vez.
        </p>
      </div>

      {feedback && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
            feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* BUSCA + CATEGORIA */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:flex-row md:items-center">
        <input
          type="text"
          placeholder="Pesquisar carta por nome (Inglês)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none"
        />
        <div className="flex items-center gap-1.5 self-start rounded-lg border border-zinc-800 bg-zinc-950 p-1 md:self-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                category === c.id ? "bg-emerald-500 text-black" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {sellable.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-12 text-center text-sm text-zinc-500">
          Nenhuma carta livre para vender.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((row) => {
            const chosen = selection[row.cardId] ?? 0;
            const one = safeQuote(row.info, 1, percent, finishPercents);
            return (
              <div
                key={row.cardId}
                className={`flex flex-col rounded-xl border bg-zinc-900/40 p-3 transition-all ${
                  chosen > 0 ? "border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.25)]" : "border-zinc-800 hover:border-emerald-500/50"
                }`}
              >
                <button
                  onClick={() => change(row, 1)}
                  title={`Escolher 1 cópia de ${row.card.name}`}
                  className="relative w-full"
                >
                  {/* Brilho da melhor cópia que o jogador tem */}
                  <FoilCard src={row.card.imageUrl} alt={row.card.name} finish={row.card.bestVariant?.finish} border={row.card.bestVariant?.border} interactive={false} />
                  {chosen > 0 && (
                    <span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-black text-black">×{chosen}</span>
                  )}
                </button>

                <h3 className="mt-2 truncate text-sm font-semibold text-zinc-200" title={row.card.name}>
                  {row.card.name}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Livres: <strong className="text-zinc-200">{row.info.sellable}</strong> de {row.owned}
                </p>
                <p className="mt-0.5 text-xs font-bold">
                  <Money gold={one.gold} cash={one.cash} /> <span className="font-normal text-zinc-500">cada</span>
                </p>

                <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
                  <button
                    onClick={() => change(row, -1)}
                    disabled={chosen === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                    aria-label="Menos uma"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-sm font-bold tabular-nums text-zinc-100">{chosen}</span>
                  <button
                    onClick={() => change(row, 1)}
                    disabled={chosen >= row.info.sellable}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                    aria-label="Mais uma"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {protectedCount > 0 && (
        <p className="mt-4 text-center text-xs text-zinc-500">
          {protectedCount} carta(s) não aparecem: todas as cópias estão protegidas (Structure Deck, decks salvos) ou fora da loja.
        </p>
      )}

      {/* BARRA DA VENDA (portal: o painel de vidro prende elementos fixed) */}
      {totals.copies > 0 &&
        createPortal(
          <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-emerald-500/50 bg-zinc-950/95 px-4 py-3 shadow-[0_-8px_30px_rgba(16,185,129,0.15)] backdrop-blur sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm font-bold text-zinc-100">
                  {totals.copies} {totals.copies === 1 ? "cópia escolhida" : "cópias escolhidas"}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                  Você recebe <Money gold={totals.gold} cash={totals.cash} className="font-bold" />
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={sell}
                  disabled={busy}
                  className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-black text-black hover:bg-emerald-400 disabled:opacity-40"
                >
                  {busy ? "Vendendo..." : "Vender"}
                </button>
                <button
                  onClick={() => setSelection({})}
                  className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                >
                  <X className="h-3.5 w-3.5" /> Limpar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
