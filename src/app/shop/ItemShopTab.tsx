"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { CreditIcon } from "@/components/theme/CurrencyIcons";
import { MillenniumPouch } from "@/components/theme/EgyptIcons";
import { ITEMS } from "@/lib/card-finish";
import { CREDIT_LABEL } from "@/lib/shop-rules";

interface ShopItem {
  key: keyof typeof ITEMS;
  name: string;
  description: string;
  priceCash: number;
  moneyCents: number;
  moneyCentsDiscounted: number;
  owned: number;
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Aba Cosméticos: Pó do Milênio para evoluir cartas (preços definidos pelo Admin). */
export function ItemShopTab() {
  const router = useRouter();
  const [data, setData] = useState<{ moneyDiscountPercent: number; items: ShopItem[] } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/items");
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function buy(item: ShopItem, currency: "cash" | "money") {
    const quantity = quantities[item.key] ?? 1;
    if (currency === "cash" && !confirm(`Comprar ${quantity}x ${item.name} por ${item.priceCash * quantity} ${CREDIT_LABEL.toLowerCase()}?`)) return;
    setBusy(`${item.key}-${currency}`);
    setFeedback(null);
    const res = await fetch("/api/shop/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemKey: item.key, quantity, currency }),
    });
    const result = await res.json();
    setBusy(null);
    setFeedback({ ok: res.ok, text: res.ok ? result.message : result.error ?? "Não foi possível comprar." });
    if (res.ok) {
      await load();
      router.refresh(); // atualiza o saldo na barra de navegação
    }
  }

  if (!data) return <p className="text-sm text-zinc-500">Carregando...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-purple-500/30 bg-gradient-to-b from-purple-500/[0.07] to-zinc-900/60 p-4 text-sm text-zinc-200">
        <p>
          <strong className="text-purple-200">Pó do Milênio</strong> evolui uma cópia na sua Maleta: Normal → Rara → Ultra → Secreta.
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Pague com {CREDIT_LABEL.toLowerCase()} ou com dinheiro ({data.moneyDiscountPercent}% de desconto). Sleeves, playmats e molduras chegam em breve.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {data.items.map((item) => {
          const qty = quantities[item.key] ?? 1;
          const setQty = (n: number) => setQuantities({ ...quantities, [item.key]: Math.max(1, Math.min(50, n)) });
          return (
            <div key={item.key} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-purple-400/40 bg-zinc-950 shadow-[0_0_14px_rgba(168,85,247,0.25)]">
                  <MillenniumPouch className={`h-7 w-7 ${ITEMS[item.key].color}`} />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-zinc-100">{item.name}</p>
                  <p className="text-xs text-zinc-400">{item.description}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Você tem: {item.owned}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
                <button onClick={() => setQty(qty - 1)} disabled={qty <= 1} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 disabled:opacity-30" aria-label="Menos">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-bold tabular-nums text-zinc-100">{qty}</span>
                <button onClick={() => setQty(qty + 1)} disabled={qty >= 50} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 disabled:opacity-30" aria-label="Mais">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                onClick={() => buy(item, "cash")}
                disabled={busy !== null}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-40"
              >
                <CreditIcon className="h-4 w-4" />
                {busy === `${item.key}-cash` ? "..." : `${(item.priceCash * qty).toLocaleString("pt-BR")} ${CREDIT_LABEL.toLowerCase()}`}
              </button>
              <button
                onClick={() => buy(item, "money")}
                disabled={busy !== null}
                className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 px-3 py-2 text-xs text-zinc-300 hover:bg-emerald-500/10 disabled:opacity-40"
                title="Pagamento em dinheiro chega em breve"
              >
                <span>
                  <span className="mr-1.5 text-zinc-500 line-through">{brl(item.moneyCents * qty)}</span>
                  <strong className="text-emerald-300">{brl(item.moneyCentsDiscounted * qty)}</strong>
                </span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-400">em breve</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
