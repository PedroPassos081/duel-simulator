"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Sparkles } from "lucide-react";
import { CreditIcon } from "@/components/theme/CurrencyIcons";
import { Avatar } from "@/components/Avatar";
import { PlaymatView, SleeveView } from "@/components/cosmetics/CosmeticArt";
import { nameEffectClass } from "@/lib/cosmetic-types";
import { CREDIT_LABEL } from "@/lib/shop-rules";

interface ShowcaseItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  imageUrl: string | null;
  effect: string | null;
  priceCash: number;
  shopUnlockAt: string | null;
  locked: boolean;
  owned: boolean;
}

const TYPE_LABEL: Record<string, string> = { sleeve: "Sleeve", playmat: "Playmat", frame: "Moldura", name_style: "Nick" };

function unlockText(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  const date = new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  return days > 1 ? `Desbloqueia em ${date} (faltam ${days} dias)` : `Desbloqueia em ${date}`;
}

/** Vitrine de cosméticos (sleeves, playmats...): o Admin coloca, trancados até a data marcada. */
export function CosmeticShowcase() {
  const router = useRouter();
  const [items, setItems] = useState<ShowcaseItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/cosmetics", { cache: "no-store" });
    if (res.ok) setItems(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function buy(item: ShowcaseItem) {
    if (!confirm(`Comprar "${item.name}" por ${item.priceCash} ${CREDIT_LABEL.toLowerCase()}?`)) return;
    setBusy(item.id);
    setFeedback(null);
    const res = await fetch("/api/shop/cosmetics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cosmeticId: item.id }) });
    const data = await res.json();
    setBusy(null);
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível comprar." });
    if (res.ok) {
      load();
      router.refresh();
    }
  }

  if (!items || items.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-zinc-100">
        <Sparkles className="h-5 w-5 text-amber-300" /> Vitrine de cosméticos
      </h2>
      <p className="mb-3 text-sm text-zinc-400">Sleeves e playmats exclusivos. Os trancados chegam na data marcada.</p>
      {feedback && (
        <p className={`mb-3 rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{feedback.text}</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-amber-500/25 bg-zinc-900/70 p-3">
            <div className={`flex justify-center ${item.locked ? "opacity-60 grayscale-[30%]" : ""}`}>
              {item.type === "playmat" ? (
                <PlaymatView url={item.imageUrl} theme={item.effect} className="w-full" />
              ) : item.type === "sleeve" ? (
                <SleeveView url={item.imageUrl} className="h-44" />
              ) : item.type === "frame" ? (
                <Avatar name="?" size={96} frameUrl={item.imageUrl} />
              ) : (
                <span className={`${nameEffectClass(item.effect)} py-10 text-2xl font-black`}>@Duelista</span>
              )}
            </div>
            {item.locked && (
              <div className="absolute inset-x-3 top-3 flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/50 bg-black/80 px-2 py-1.5 text-xs font-bold text-amber-200 backdrop-blur-sm">
                <Lock className="h-3.5 w-3.5" /> {item.shopUnlockAt ? unlockText(item.shopUnlockAt) : "Em breve"}
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">{TYPE_LABEL[item.type] ?? item.type}</p>
                <p className="font-bold text-zinc-100">{item.name}</p>
                {item.description && <p className="text-xs text-zinc-400">{item.description}</p>}
              </div>
            </div>
            {item.owned ? (
              <span className="flex items-center justify-center gap-1 rounded-lg border border-emerald-500/40 py-2 text-sm font-bold text-emerald-300">
                <Check className="h-4 w-4" /> Você já tem
              </span>
            ) : (
              <button
                disabled={item.locked || busy !== null}
                onClick={() => buy(item)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2 text-sm font-bold text-white hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {item.locked ? <Lock className="h-4 w-4" /> : <CreditIcon className="h-4 w-4" />}
                {item.priceCash} {CREDIT_LABEL.toLowerCase()}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
