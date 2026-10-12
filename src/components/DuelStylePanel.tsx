"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { PlaymatView, SleeveView } from "@/components/cosmetics/CosmeticArt";

interface Cosmetic {
  id: string;
  type: string;
  name: string;
  imageUrl: string | null;
  effect: string | null;
}

const DEFAULT_SLEEVE = "/assets/master-duelist-card-back.svg";

type Field = "sleeveId" | "playmatId";

/**
 * Sleeve e playmat DESTE deck, escolhidos no Deck Builder.
 * "Da conta" = usa o que está equipado em Minha conta → Personalizar.
 * Só aparecem os itens que o jogador possui (ex.: os que vêm nos Structure Decks Premium).
 */
export function DuelStylePanel({
  sleeveId,
  playmatId,
  onChange,
}: {
  sleeveId: string | null;
  playmatId: string | null;
  onChange: (field: Field, value: string | null) => void;
}) {
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [equipped, setEquipped] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/account");
    if (!res.ok) return;
    const data = await res.json();
    setCosmetics(data.cosmetics ?? []);
    setEquipped(data.equipped ?? {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // O que está equipado na conta (é o que vale quando o deck usa "Da conta")
  const accountSleeve = cosmetics.find((c) => c.id === equipped.sleeve);
  const accountPlaymat = cosmetics.find((c) => c.id === equipped.playmat);

  const sleeves = cosmetics.filter((c) => c.type === "sleeve");
  const playmats = cosmetics.filter((c) => c.type === "playmat");

  const optionClass = (selected: boolean) =>
    `relative flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition-all disabled:cursor-default ${
      selected ? "border-edison-gold bg-edison-gold/10 text-edison-gold" : "border-edison-border bg-black/20 text-gray-400 hover:border-edison-gold/50"
    }`;

  return (
    <section className="rounded-2xl border border-edison-border bg-edison-panel p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Palette className="h-4 w-4 text-edison-gold" /> Estilo do duelo
      </h2>
      <p className="mt-1 text-xs text-gray-500">Sleeve e playmat que aparecem quando você duela com este deck. &quot;Da conta&quot; usa o que está em Minha conta → Personalizar.</p>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Sleeve</p>
          <div className="flex flex-wrap gap-3">
            {[{ id: null as string | null, name: "Da conta", imageUrl: accountSleeve?.imageUrl ?? DEFAULT_SLEEVE }, ...sleeves].map((c) => {
              const selected = sleeveId === c.id;
              return (
                <button key={c.id ?? "default"} onClick={() => onChange("sleeveId", c.id)} disabled={selected} className={optionClass(selected)} title={c.name}>
                  <SleeveView url={c.imageUrl} className="h-20" />
                  <span className="max-w-[80px] truncate">{c.name}</span>
                  {selected && <Check className="absolute right-1 top-1 h-3.5 w-3.5 rounded-full bg-edison-gold p-0.5 text-black" />}
                </button>
              );
            })}
          </div>
          {sleeves.length === 0 && <p className="mt-2 text-[11px] text-gray-500">Nenhum sleeve extra ainda. Eles vêm nos Structure Decks Premium.</p>}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Playmat</p>
          <div className="flex flex-wrap gap-3">
            {[{ id: null as string | null, name: "Da conta", imageUrl: accountPlaymat?.imageUrl ?? null, effect: accountPlaymat?.effect ?? null }, ...playmats].map((c) => {
              const selected = playmatId === c.id;
              return (
                <button key={c.id ?? "default"} onClick={() => onChange("playmatId", c.id)} disabled={selected} className={optionClass(selected)} title={c.name}>
                  <PlaymatView url={c.imageUrl} theme={c.effect} className="w-32" />
                  <span className="max-w-[128px] truncate">{c.name}</span>
                  {selected && <Check className="absolute right-1 top-1 h-3.5 w-3.5 rounded-full bg-edison-gold p-0.5 text-black" />}
                </button>
              );
            })}
          </div>
          {playmats.length === 0 && <p className="mt-2 text-[11px] text-gray-500">Nenhum playmat extra ainda. Eles vêm nos Structure Decks Premium.</p>}
        </div>
      </div>
    </section>
  );
}
