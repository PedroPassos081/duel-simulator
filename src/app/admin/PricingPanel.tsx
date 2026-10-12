"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Save, Search } from "lucide-react";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { MillenniumPouch } from "@/components/theme/EgyptIcons";
import { ITEMS, type FinishPercents } from "@/lib/card-finish";
import { CREDIT_LABEL } from "@/lib/shop-rules";

type TierKey = "top" | "strong" | "high" | "mid" | "low";
type ItemKey = "po_milenio_raro" | "po_milenio_ultra" | "po_milenio_secret";

interface Pricing {
  finishPercents: FinishPercents;
  tiers: Record<TierKey, { gold: number; cash: number }>;
  items: { prices: Record<ItemKey, { cash: number; moneyCents: number }>; moneyDiscountPercent: number };
  tierLabels: Record<TierKey, string>;
}

interface CardPrice {
  card: { id: number; name: string; imageUrl: string | null };
  priceGold: number | null;
  priceCash: number | null;
  customPrice: boolean;
  tierLabel: string;
  tierPrice: { gold: number; cash: number };
}

const TIER_ORDER: TierKey[] = ["top", "strong", "high", "mid", "low"];
const input =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm font-semibold text-zinc-100 focus:border-amber-500/60 focus:outline-none";
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

function Box({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="font-bold text-zinc-100">{title}</h2>
      <p className="mb-4 text-sm text-zinc-400">{hint}</p>
      {children}
    </section>
  );
}

/** Aba Preços do painel do Admin. */
export function PricingPanel() {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/pricing");
    if (res.ok) setPricing(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(body: Partial<Pricing>, okText: string) {
    setBusy(true);
    setFeedback(null);
    const res = await fetch("/api/admin/pricing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setFeedback({ ok: false, text: data.error ?? "Não foi possível salvar." });
    setFeedback({ ok: true, text: okText });
    await load();
  }

  async function applyTiers() {
    if (!confirm("Aplicar o preço das categorias em todas as cartas da loja? Cartas com preço manual não mudam.")) return;
    setBusy(true);
    setFeedback(null);
    const res = await fetch("/api/admin/pricing/apply", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível aplicar." });
  }

  if (!pricing) return <p className="text-sm text-zinc-400">Carregando preços...</p>;

  return (
    <div className="flex flex-col gap-5">
      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {feedback.text}
        </p>
      )}
      <FinishSection pricing={pricing} busy={busy} onSave={save} />
      <TierSection pricing={pricing} busy={busy} onSave={save} onApply={applyTiers} />
      <CardPriceSection />
      <ItemSection pricing={pricing} busy={busy} onSave={save} />
    </div>
  );
}

// ---------------------------------------------------------------- RARIDADES
function FinishSection({ pricing, busy, onSave }: { pricing: Pricing; busy: boolean; onSave: (b: Partial<Pricing>, t: string) => void }) {
  const [values, setValues] = useState({
    rara: String(pricing.finishPercents.rara),
    ultra: String(pricing.finishPercents.ultra),
    secreta: String(pricing.finishPercents.secreta),
  });
  const example = pricing.tiers.top.gold;
  const valid = Object.values(values).every((v) => Number.isInteger(num(v)) && num(v) >= 100);

  return (
    <Box
      title="Raridades"
      hint="Preço de cada raridade em % do preço base da carta. Quando o preço base muda, as raridades acompanham na mesma proporção. Subir de raridade custa a diferença."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {(["rara", "ultra", "secreta"] as const).map((f) => (
          <label key={f} className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {f === "rara" ? "Rara" : f === "ultra" ? "Ultra" : "Secreta"} (%)
            <input type="number" min={100} value={values[f]} onChange={(e) => setValues({ ...values, [f]: e.target.value })} className={input} />
            <span className="text-[11px] normal-case tracking-normal text-zinc-500">
              Carta de {example.toLocaleString("pt-BR")} → {Number.isFinite(num(values[f])) ? Math.round((example * num(values[f])) / 100).toLocaleString("pt-BR") : "?"} gold
            </span>
          </label>
        ))}
      </div>
      <button
        disabled={!valid || busy}
        onClick={() => onSave({ finishPercents: { rara: num(values.rara), ultra: num(values.ultra), secreta: num(values.secreta) } }, "Porcentagens das raridades salvas.")}
        className="mt-4 flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40"
      >
        <Save className="h-4 w-4" /> Salvar raridades
      </button>
    </Box>
  );
}

// ---------------------------------------------------------------- CATEGORIAS
function TierSection({
  pricing,
  busy,
  onSave,
  onApply,
}: {
  pricing: Pricing;
  busy: boolean;
  onSave: (b: Partial<Pricing>, t: string) => void;
  onApply: () => void;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(TIER_ORDER.map((t) => [t, { gold: String(pricing.tiers[t].gold), cash: String(pricing.tiers[t].cash) }])) as Record<
      TierKey,
      { gold: string; cash: string }
    >
  );
  const valid = TIER_ORDER.every((t) => Number.isInteger(num(values[t].gold)) && Number.isInteger(num(values[t].cash)));

  return (
    <Box title="Preço por categoria" hint="Preço base (Normal) de cada categoria. Salve e depois aplique nas cartas da loja.">
      <div className="flex flex-col gap-2">
        {TIER_ORDER.map((t) => (
          <div key={t} className="grid grid-cols-[1fr_110px_110px] items-center gap-2">
            <span className="text-sm text-zinc-300">{pricing.tierLabels[t]}</span>
            <label className="flex items-center gap-1.5">
              <GoldIcon className="h-4 w-4 shrink-0 text-amber-400" />
              <input type="number" min={0} value={values[t].gold} onChange={(e) => setValues({ ...values, [t]: { ...values[t], gold: e.target.value } })} className={input} />
            </label>
            <label className="flex items-center gap-1.5">
              <CreditIcon className="h-4 w-4 shrink-0 text-purple-400" />
              <input type="number" min={0} value={values[t].cash} onChange={(e) => setValues({ ...values, [t]: { ...values[t], cash: e.target.value } })} className={input} />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          disabled={!valid || busy}
          onClick={() =>
            onSave(
              { tiers: Object.fromEntries(TIER_ORDER.map((t) => [t, { gold: num(values[t].gold), cash: num(values[t].cash) }])) as Pricing["tiers"] },
              "Preços das categorias salvos. Clique em \"Aplicar nas cartas\" para atualizar a loja."
            )
          }
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40"
        >
          <Save className="h-4 w-4" /> Salvar categorias
        </button>
        <button disabled={busy} onClick={onApply} className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm font-bold text-amber-300 hover:bg-amber-500/10 disabled:opacity-40">
          Aplicar nas cartas
        </button>
      </div>
    </Box>
  );
}

// ---------------------------------------------------------------- CARTA ESPECÍFICA
function CardPriceSection() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string }[]>([]);
  const [current, setCurrent] = useState<CardPrice | null>(null);
  const [gold, setGold] = useState("");
  const [cash, setCash] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function search() {
    const res = await fetch(`/api/admin/cards?q=${encodeURIComponent(query)}`);
    if (res.ok) setResults(await res.json());
  }
  function show(data: CardPrice) {
    setCurrent(data);
    setGold(data.priceGold == null ? "" : String(data.priceGold));
    setCash(data.priceCash == null ? "" : String(data.priceCash));
  }
  async function open(cardId: number) {
    setMsg(null);
    const res = await fetch(`/api/admin/card-price?cardId=${cardId}`);
    const data = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Carta não encontrada na loja." });
    show(data);
    setResults([]);
  }
  async function save() {
    if (!current) return;
    const res = await fetch("/api/admin/card-price", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: current.card.id, priceGold: gold === "" ? null : Number(gold), priceCash: cash === "" ? null : Number(cash) }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Não foi possível salvar." });
    show(data);
    setMsg({ ok: true, text: "Preço manual salvo. As raridades desta carta acompanham o novo preço." });
  }
  async function reset() {
    if (!current) return;
    const res = await fetch(`/api/admin/card-price?cardId=${current.card.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Não foi possível voltar." });
    show(data);
    setMsg({ ok: true, text: "A carta voltou ao preço da categoria." });
  }

  return (
    <Box title="Preço de uma carta" hint="Mude o preço base de uma carta só. Ela fica fora do &quot;Aplicar nas cartas&quot; até você voltar ao preço da categoria.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) search();
        }}
        className="flex gap-2"
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome da carta (inglês)..." className={input} />
        <button className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:bg-zinc-800">
          <Search className="h-4 w-4" /> Buscar
        </button>
      </form>
      {results.length > 0 && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-800">
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => open(r.id)} className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800">
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
      {current && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-zinc-100">{current.card.name}</p>
            <p className="text-xs text-zinc-500">
              Categoria: {current.tierLabel} ({current.tierPrice.gold} gold / {current.tierPrice.cash} {CREDIT_LABEL.toLowerCase()})
              {current.customPrice && <span className="ml-1 rounded bg-amber-500/20 px-1.5 text-amber-200">preço manual</span>}
            </p>
          </div>
          <label className="flex items-center gap-1.5">
            <GoldIcon className="h-4 w-4 shrink-0 text-amber-400" />
            <input type="number" min={0} value={gold} onChange={(e) => setGold(e.target.value)} className={`${input} w-28`} />
          </label>
          <label className="flex items-center gap-1.5">
            <CreditIcon className="h-4 w-4 shrink-0 text-purple-400" />
            <input type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} className={`${input} w-24`} />
          </label>
          <button onClick={save} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-black hover:bg-amber-400">
            <Save className="h-4 w-4" /> Salvar
          </button>
          {current.customPrice && (
            <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
              <RotateCcw className="h-4 w-4" /> Preço da categoria
            </button>
          )}
        </div>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------- PÓ DO MILÊNIO
function ItemSection({ pricing, busy, onSave }: { pricing: Pricing; busy: boolean; onSave: (b: Partial<Pricing>, t: string) => void }) {
  const keys = Object.keys(pricing.items.prices) as ItemKey[];
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(keys.map((k) => [k, { cash: String(pricing.items.prices[k].cash), money: (pricing.items.prices[k].moneyCents / 100).toFixed(2) }])) as Record<
      ItemKey,
      { cash: string; money: string }
    >
  );
  const [discount, setDiscount] = useState(String(pricing.items.moneyDiscountPercent));
  const toCents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);
  const valid = keys.every((k) => Number.isInteger(num(prices[k].cash)) && Number.isFinite(toCents(prices[k].money))) && Number.isInteger(num(discount));

  return (
    <Box title="Pó do Milênio (aba Cosméticos)" hint="Preço em crédito e em dinheiro (R$, preço cheio). O desconto vale para o pagamento em dinheiro.">
      <div className="flex flex-col gap-2">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[1fr_110px_120px] items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm text-zinc-300">
              <MillenniumPouch className={`h-4 w-4 ${ITEMS[k].color}`} /> {ITEMS[k].name}
            </span>
            <label className="flex items-center gap-1.5">
              <CreditIcon className="h-4 w-4 shrink-0 text-purple-400" />
              <input type="number" min={0} value={prices[k].cash} onChange={(e) => setPrices({ ...prices, [k]: { ...prices[k], cash: e.target.value } })} className={input} />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-zinc-400">
              R$
              <input value={prices[k].money} onChange={(e) => setPrices({ ...prices, [k]: { ...prices[k], money: e.target.value } })} className={input} />
            </label>
          </div>
        ))}
        <label className="mt-1 flex items-center gap-2 text-sm text-zinc-300">
          Desconto no dinheiro
          <input type="number" min={0} max={90} value={discount} onChange={(e) => setDiscount(e.target.value)} className={`${input} w-20`} />%
        </label>
      </div>
      <button
        disabled={!valid || busy}
        onClick={() =>
          onSave(
            {
              items: {
                prices: Object.fromEntries(keys.map((k) => [k, { cash: num(prices[k].cash), moneyCents: toCents(prices[k].money) }])) as Pricing["items"]["prices"],
                moneyDiscountPercent: num(discount),
              },
            },
            "Preços do Pó do Milênio salvos."
          )
        }
        className="mt-4 flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40"
      >
        <Save className="h-4 w-4" /> Salvar Pó do Milênio
      </button>
    </Box>
  );
}
