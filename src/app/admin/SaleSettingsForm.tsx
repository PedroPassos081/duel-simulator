"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { GoldIcon } from "@/components/theme/CurrencyIcons";
import { MAX_SALE_PERCENT, MIN_SALE_PERCENT } from "@/lib/card-sale-rules";

// Preço de exemplo para mostrar quanto a carta renderia
const EXAMPLE_PRICE = 2500;

/** Quanto o jogador recebe ao vender uma carta na loja (% do preço atual). */
export function SaleSettingsForm({ initialPercent }: { initialPercent: number }) {
  const [percent, setPercent] = useState(String(initialPercent));
  const [saved, setSaved] = useState(initialPercent);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const value = Number(percent);
  const valid = Number.isInteger(value) && value >= MIN_SALE_PERCENT && value <= MAX_SALE_PERCENT;

  async function save() {
    setBusy(true);
    setFeedback(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardSalePercent: value }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setFeedback({ ok: false, text: data.error ?? "Não foi possível salvar." });
    setSaved(data.cardSalePercent);
    setFeedback({ ok: true, text: `Salvo! Agora a venda paga ${data.cardSalePercent}% do preço da loja.` });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-3">
        <GoldIcon className="mt-0.5 h-7 w-7 shrink-0 text-amber-300" />
        <div>
          <h2 className="font-bold text-zinc-100">Venda de cartas</h2>
          <p className="text-sm text-zinc-400">
            Quanto o jogador recebe ao vender uma carta na loja, em % do preço atual dela. Hoje: <strong className="text-amber-300">{saved}%</strong>.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Porcentagem
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={MIN_SALE_PERCENT}
              max={MAX_SALE_PERCENT}
              step={1}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base font-bold text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            />
            <span className="text-lg font-bold text-zinc-300">%</span>
          </span>
        </label>
        <button
          onClick={save}
          disabled={!valid || busy || value === saved}
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {busy ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {valid
          ? `Exemplo: uma carta de ${EXAMPLE_PRICE.toLocaleString("pt-BR")} gold vende por ${Math.floor((EXAMPLE_PRICE * value) / 100).toLocaleString("pt-BR")} gold.`
          : `Use um número inteiro de ${MIN_SALE_PERCENT} a ${MAX_SALE_PERCENT}.`}
      </p>

      {feedback && (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {feedback.text}
        </p>
      )}
    </section>
  );
}
