"use client";

import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { BORDERS, FINISHES, ITEMS, variantLabel, type Border, type Finish, type ItemKey } from "@/lib/card-finish";
import { CREDIT_LABEL } from "@/lib/shop-rules";

// Prêmio (mesmo formato do envio do Admin e da premiação dos torneios)
export type Reward =
  | { kind: "currency"; currency: "gold" | "cash"; amount: number }
  | { kind: "card"; cardId: number; quantity: number; variant: { finish: Finish; border: Border }; cardName?: string }
  | { kind: "cosmetic"; cosmeticId: string }
  | { kind: "item"; itemKey: ItemKey; quantity: number }
  | { kind: "structure"; structureDeckId: string; edition: "base" | "premium" }
  | { kind: "vip"; days: number };

export interface RewardOptions {
  cosmetics: { id: string; name: string; type: string }[];
  structures: { id: string; name: string }[];
}

const input = "rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none";

/** Texto curto de um prêmio. */
export function rewardLabel(r: Reward, options: RewardOptions) {
  switch (r.kind) {
    case "currency":
      return `${r.amount.toLocaleString("pt-BR")} ${r.currency === "gold" ? "gold" : CREDIT_LABEL.toLowerCase()}`;
    case "card":
      return `${r.quantity}x ${r.cardName ?? `carta #${r.cardId}`} (${variantLabel(r.variant)})`;
    case "cosmetic":
      return options.cosmetics.find((c) => c.id === r.cosmeticId)?.name ?? "Cosmético";
    case "item":
      return `${r.quantity}x ${ITEMS[r.itemKey].name}`;
    case "structure":
      return `Structure ${options.structures.find((d) => d.id === r.structureDeckId)?.name ?? ""} (${r.edition === "premium" ? "Premium" : "Base"})`;
    case "vip":
      return `VIP ${r.days} dia(s)`;
  }
}

/** Monta um prêmio: gold, crédito, carta com raridade, cosmético, item ou Structure Deck. */
export function RewardEditor({ options, onAdd }: { options: RewardOptions; onAdd: (r: Reward) => void }) {
  const [kind, setKind] = useState<Reward["kind"]>("currency");
  const [currency, setCurrency] = useState<"gold" | "cash">("gold");
  const [amount, setAmount] = useState(500);
  const [quantity, setQuantity] = useState(1);
  const [finish, setFinish] = useState<Finish>("rara");
  const [border, setBorder] = useState<Border>("none");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: number; name: string }[]>([]);
  const [card, setCard] = useState<{ id: number; name: string } | null>(null);
  const [cosmeticId, setCosmeticId] = useState("");
  const [itemKey, setItemKey] = useState<ItemKey>("po_milenio_raro");
  const [structureId, setStructureId] = useState("");
  const [edition, setEdition] = useState<"base" | "premium">("premium");
  const [vipDays, setVipDays] = useState(30);

  async function search() {
    if (query.trim().length < 2) return;
    const res = await fetch(`/api/admin/cards?q=${encodeURIComponent(query)}`);
    if (res.ok) setFound(await res.json());
  }

  const reward: Reward | null =
    kind === "currency"
      ? amount > 0
        ? { kind, currency, amount }
        : null
      : kind === "card"
        ? card
          ? { kind, cardId: card.id, cardName: card.name, quantity, variant: { finish, border } }
          : null
        : kind === "cosmetic"
          ? cosmeticId
            ? { kind, cosmeticId }
            : null
          : kind === "item"
            ? { kind, itemKey, quantity }
            : kind === "vip"
              ? vipDays > 0
                ? { kind, days: vipDays }
                : null
              : structureId
              ? { kind, structureDeckId: structureId, edition }
              : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-700 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as Reward["kind"])} className={input}>
          <option value="currency">Gold / {CREDIT_LABEL}</option>
          <option value="card">Carta (com raridade)</option>
          <option value="cosmetic">Cosmético</option>
          <option value="item">Item (Pó do Milênio...)</option>
          <option value="structure">Structure Deck</option>
          <option value="vip">VIP (dias)</option>
        </select>
        {kind === "vip" && <input type="number" min={1} value={vipDays} onChange={(e) => setVipDays(Number(e.target.value))} className={`${input} w-20`} title="Dias de VIP" />}

        {kind === "currency" && (
          <>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as "gold" | "cash")} className={input}>
              <option value="gold">Gold</option>
              <option value="cash">{CREDIT_LABEL}</option>
            </select>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={`${input} w-28`} />
          </>
        )}

        {kind === "card" && (
          <>
            <select value={finish} onChange={(e) => setFinish(e.target.value as Finish)} className={input}>
              {(Object.keys(FINISHES) as Finish[]).map((f) => (
                <option key={f} value={f}>
                  {FINISHES[f].label}
                </option>
              ))}
            </select>
            <select value={border} onChange={(e) => setBorder(e.target.value as Border)} className={input}>
              {(Object.keys(BORDERS) as Border[]).map((b) => (
                <option key={b} value={b}>
                  {BORDERS[b].label}
                </option>
              ))}
            </select>
            <input type="number" min={1} max={99} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={`${input} w-16`} title="Quantidade" />
          </>
        )}

        {kind === "cosmetic" && (
          <select value={cosmeticId} onChange={(e) => setCosmeticId(e.target.value)} className={input}>
            <option value="">Escolha...</option>
            {options.cosmetics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {kind === "item" && (
          <>
            <select value={itemKey} onChange={(e) => setItemKey(e.target.value as ItemKey)} className={input}>
              {(Object.keys(ITEMS) as ItemKey[]).map((k) => (
                <option key={k} value={k}>
                  {ITEMS[k].name}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={`${input} w-16`} />
          </>
        )}

        {kind === "structure" && (
          <>
            <select value={structureId} onChange={(e) => setStructureId(e.target.value)} className={input}>
              <option value="">Escolha...</option>
              {options.structures.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select value={edition} onChange={(e) => setEdition(e.target.value as "base" | "premium")} className={input}>
              <option value="premium">Premium</option>
              <option value="base">Base</option>
            </select>
          </>
        )}

        <button
          type="button"
          disabled={!reward}
          onClick={() => reward && onAdd(reward)}
          className="ml-auto flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>

      {kind === "card" && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())} placeholder="Buscar carta (inglês)..." className={`${input} flex-1`} />
            <button type="button" onClick={search} className="rounded-lg border border-zinc-700 px-2 text-zinc-300 hover:bg-zinc-800" aria-label="Buscar">
              <Search className="h-4 w-4" />
            </button>
          </div>
          {card && <p className="text-xs text-amber-200">Escolhida: {card.name}</p>}
          {found.length > 0 && (
            <ul className="max-h-32 overflow-y-auto rounded border border-zinc-800">
              {found.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => (setCard(c), setFound([]))} className="w-full px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800">
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Lista de prêmios com botão de remover. */
export function RewardList({ rewards, options, onRemove }: { rewards: Reward[]; options: RewardOptions; onRemove: (i: number) => void }) {
  if (rewards.length === 0) return <p className="text-xs text-zinc-500">Sem prêmios nesta colocação.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {rewards.map((r, i) => (
        <li key={i} className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100">
          {rewardLabel(r, options)}
          <button type="button" onClick={() => onRemove(i)} className="text-amber-300/70 hover:text-red-300" aria-label="Remover">
            <Trash2 className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
