"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { MillenniumPouch } from "@/components/theme/EgyptIcons";
import { FoilCard } from "@/components/FoilCard";
import {
  FINISHES,
  ITEMS,
  applyItem,
  variantKey,
  variantLabel,
  type Border,
  type Finish,
  type ItemKey,
  type Variant,
} from "@/lib/card-finish";

interface Copy extends Variant {
  quantity: number;
  label: string;
}

interface CollectionCard {
  id: number;
  name: string;
  type: string;
  imageUrl: string | null;
  total: number;
  copies: Copy[];
  best: Variant;
}

interface CollectionData {
  cards: CollectionCard[];
  items: Partial<Record<ItemKey, number>>;
}

const ITEM_KEYS = Object.keys(ITEMS) as ItemKey[];

export function CollectionTab() {
  const [data, setData] = useState<CollectionData | null>(null);
  const [search, setSearch] = useState("");
  const [onlyEvolved, setOnlyEvolved] = useState(false);
  const [openCardId, setOpenCardId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/collection");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.cards.filter(
      (c) => (!q || c.name.toLowerCase().includes(q)) && (!onlyEvolved || c.copies.some((copy) => variantKey(copy) !== "normal:none"))
    );
  }, [data, search, onlyEvolved]);

  if (!data) return <p className="text-sm text-zinc-400">Carregando...</p>;

  const openCard = data.cards.find((c) => c.id === openCardId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* ITENS */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-base font-bold text-zinc-100">Seus itens</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Use em uma cópia para evoluir: Normal → Rara → Ultra → Secreta. Molduras colocam borda prata ou dourada.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ITEM_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2" title={ITEMS[key].description}>
              <MillenniumPouch className={`h-4 w-4 shrink-0 ${ITEMS[key].color}`} />
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{ITEMS[key].name}</span>
              <span className="text-sm font-bold text-zinc-100">{data.items[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar carta na Maleta..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={onlyEvolved} onChange={(e) => setOnlyEvolved(e.target.checked)} className="h-4 w-4 accent-amber-500" />
          Só evoluídas
        </label>
        <span className="text-xs text-zinc-500">{cards.length} carta(s)</span>
      </div>

      {/* CARTAS */}
      {cards.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-12 text-center text-sm text-zinc-500">
          {data.cards.length === 0 ? "Você ainda não tem cartas. Visite a loja!" : "Nenhuma carta encontrada."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cards.map((card) => {
            const evolved = card.copies.filter((c) => variantKey(c) !== "normal:none");
            return (
              <button
                key={card.id}
                onClick={() => setOpenCardId(card.id)}
                className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-left transition-colors hover:border-amber-500/50"
              >
                <FoilCard src={card.imageUrl} alt={card.name} finish={card.best.finish} border={card.best.border} interactive={false} />
                <span className="truncate text-sm font-semibold text-zinc-200">{card.name}</span>
                <span className="text-[11px] text-zinc-400">
                  {card.total} cópia(s)
                  {evolved.length > 0 && ` · ${evolved.map((c) => `${c.quantity} ${c.label}`).join(", ")}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {openCard && <EvolveModal card={openCard} items={data.items} onClose={() => setOpenCardId(null)} onChanged={load} />}
    </div>
  );
}

function EvolveModal({
  card,
  items,
  onClose,
  onChanged,
}: {
  card: CollectionCard;
  items: Partial<Record<ItemKey, number>>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Variant>(card.best);
  const [busy, setBusy] = useState<ItemKey | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Se a cópia selecionada deixou de existir (ex.: a única foi evoluída), volta para a melhor
  const selectedCopy = card.copies.find((c) => variantKey(c) === variantKey(selected));
  const current: Variant = selectedCopy ?? card.best;

  async function use(item: ItemKey) {
    setBusy(item);
    setFeedback(null);
    const res = await fetch("/api/account/collection/evolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, from: { finish: current.finish, border: current.border }, item }),
    });
    const json = await res.json();
    setBusy(null);
    setFeedback({ ok: res.ok, text: res.ok ? json.message : json.error ?? "Não foi possível evoluir." });
    if (res.ok) {
      setSelected(json.to);
      await onChanged();
    }
  }

  const usable = (Object.keys(ITEMS) as ItemKey[]).filter((key) => applyItem(current, key));

  // Vai para o body: dentro de um painel com backdrop-filter o `fixed` ficaria preso
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col gap-6 overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 md:flex-row">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-zinc-800 p-1.5 text-zinc-400 hover:text-white" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto w-56 shrink-0">
          <FoilCard src={card.imageUrl} alt={card.name} finish={current.finish} border={current.border} />
          <p className="mt-3 text-center text-xs text-zinc-400">Passe o mouse na carta</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">{card.name}</h2>
            <p className="text-xs text-zinc-500">{card.total} cópia(s) na Maleta</p>
          </div>

          {/* CÓPIAS */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Escolha a cópia</p>
            <div className="flex flex-wrap gap-2">
              {card.copies.map((copy) => {
                const active = variantKey(copy) === variantKey(current);
                return (
                  <button
                    key={variantKey(copy)}
                    onClick={() => setSelected(copy)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active ? "border-amber-500 bg-amber-500/10 text-amber-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {copy.quantity}x {copy.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ITENS */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Evoluir esta cópia</p>
            {usable.length === 0 ? (
              <p className="text-sm text-zinc-500">Esta cópia já está no máximo.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {usable.map((key) => {
                  const owned = items[key] ?? 0;
                  const to = applyItem(current, key)!;
                  return (
                    <button
                      key={key}
                      onClick={() => use(key)}
                      disabled={owned <= 0 || busy !== null}
                      className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2.5 text-left transition-colors enabled:hover:border-purple-400/60 disabled:opacity-40"
                    >
                      <MillenniumPouch className={`h-5 w-5 shrink-0 ${ITEMS[key].color}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-zinc-100">{ITEMS[key].name}</span>
                        <span className="block text-xs text-zinc-400">
                          {variantLabel(current)} → <strong className="text-zinc-200">{variantLabel(to)}</strong>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">{busy === key ? "Usando..." : `você tem ${owned}`}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {feedback && <p className={`text-sm ${feedback.ok ? "text-emerald-400" : "text-red-400"}`}>{feedback.text}</p>}

          <p className="text-[11px] text-zinc-500">
            A evolução é só visual: no deck, a carta continua valendo o mesmo e o limite de 3 cópias não muda.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Reexport para tipagem de quem usa (evita importar card-finish só por causa do tipo)
export type { Finish, Border };
export { FINISHES };
