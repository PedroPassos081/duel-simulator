"use client";

import { useState } from "react";
import { ArrowDownUp, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import {
  ATTRIBUTES,
  CATEGORIES,
  COPY_LIMITS,
  DEFAULT_FILTERS,
  LEVELS,
  LEVEL_PRESETS,
  MONSTER_KINDS,
  OWNERSHIP,
  PRICE_SORTS,
  SORTS,
  SPELL_TRAP_LABELS,
  SPELL_TYPES,
  TRAP_TYPES,
  countActiveFilters,
  monsterTypeLabel,
  type Category,
  type FilterMode,
  type Filters,
  type MonsterKind,
  type Ownership,
  type Range,
  type Sort,
} from "@/lib/card-filters";
import { CREDIT_LABEL } from "@/lib/shop-rules";

const ATTRIBUTE_COLORS: Record<string, string> = {
  LIGHT: "text-yellow-200",
  DARK: "text-purple-300",
  WATER: "text-sky-300",
  FIRE: "text-red-300",
  EARTH: "text-amber-600",
  WIND: "text-emerald-300",
  DIVINE: "text-amber-200",
};

const SPELL_LABELS = SPELL_TRAP_LABELS;

const LIMIT_LABELS: Record<number, string> = { 1: "1 (limitada)", 2: "2 (semilimitada)", 3: "3 (livre)" };

const chip = (active: boolean) =>
  `rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
    active ? "border-amber-500 bg-amber-500/15 text-amber-200" : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
  }`;

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * Busca, ordem e filtros avançados de cartas.
 * mode="shop": mostra preço (gold e crédito) e coleção. mode="deck": só o que importa para montar o deck.
 * compact: uma coluna só (para a lateral estreita do Deck Builder).
 */
export function CardFilters({
  filters,
  onChange,
  races,
  total,
  shown,
  mode = "shop",
  compact = false,
  placeholder = "Buscar carta pelo nome (inglês)...",
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  races: string[];
  total: number;
  shown: number;
  mode?: FilterMode;
  compact?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  const active = countActiveFilters(filters);
  const shop = mode === "shop";
  const sorts = (Object.keys(SORTS) as Sort[]).filter((s) => shop || !PRICE_SORTS.includes(s));
  const grid = compact ? "grid gap-4" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex flex-col gap-3">
      {/* BUSCA + ORDEM + BOTÃO DE FILTROS */}
      <div className={`flex flex-col gap-2 ${compact ? "" : "md:flex-row"}`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-8 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
          />
          {filters.search && (
            <button onClick={() => set("search", "")} className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300" aria-label="Limpar busca">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300">
            <ArrowDownUp className="h-4 w-4 shrink-0 text-zinc-500" />
            <select
              value={filters.sort}
              onChange={(e) => set("sort", e.target.value as Sort)}
              className={`w-full min-w-0 bg-transparent py-2 text-sm text-zinc-200 focus:outline-none ${compact ? "" : "md:w-auto"}`}
              aria-label="Ordenar"
            >
              {sorts.map((s) => (
                <option key={s} value={s} className="bg-zinc-900">
                  {SORTS[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex shrink-0 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-semibold transition-colors ${compact ? "px-3" : "px-4"} ${
              open || active > 0 ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-zinc-100"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {active > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-black">{active}</span>}
          </button>
        </div>
      </div>

      {/* CATEGORIA */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          {(Object.keys(CATEGORIES) as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => set("category", c)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all ${
                filters.category === c ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              {CATEGORIES[c]}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          {shown} de {total} cartas
        </span>
      </div>

      {/* FILTROS AVANÇADOS */}
      {open && (
        <div className={`${grid} rounded-xl border border-zinc-800 bg-zinc-950/40 p-4`}>
          <Section title="Classe do monstro" wide={!compact}>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => set("extraOnly", !filters.extraOnly)} className={chip(filters.extraOnly)}>
                Extra Deck
              </button>
              {(Object.keys(MONSTER_KINDS) as MonsterKind[]).map((k) => (
                <button key={k} onClick={() => set("kinds", toggle(filters.kinds, k))} className={chip(filters.kinds.includes(k))}>
                  {MONSTER_KINDS[k].label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Atributo">
            <div className="flex flex-wrap gap-1.5">
              {ATTRIBUTES.map((a) => (
                <button key={a} onClick={() => set("attributes", toggle(filters.attributes, a))} className={chip(filters.attributes.includes(a))}>
                  <span className={filters.attributes.includes(a) ? "" : ATTRIBUTE_COLORS[a]}>{a}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Tipo">
            <select
              value={filters.race}
              onChange={(e) => set("race", e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
            >
              <option value="">Todos</option>
              {races.map((r) => (
                <option key={r} value={r}>
                  {monsterTypeLabel(r)}
                </option>
              ))}
            </select>
          </Section>

          <LevelSection filters={filters} onChange={onChange} />

          <Section title="ATK">
            <RangeInput range={filters.atk} onChange={(r) => set("atk", r)} step={100} />
          </Section>

          <Section title="DEF">
            <RangeInput range={filters.def} onChange={(r) => set("def", r)} step={100} />
          </Section>

          <Section title="Mágicas">
            <div className="flex flex-wrap gap-1.5">
              {SPELL_TYPES.map((t) => (
                <button key={t} onClick={() => set("spellTypes", toggle(filters.spellTypes, t))} className={chip(filters.spellTypes.includes(t))}>
                  {SPELL_LABELS[t]}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Armadilhas">
            <div className="flex flex-wrap gap-1.5">
              {TRAP_TYPES.map((t) => (
                <button key={t} onClick={() => set("trapTypes", toggle(filters.trapTypes, t))} className={chip(filters.trapTypes.includes(t))}>
                  {SPELL_LABELS[t]}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Limite de cópias">
            <div className="flex flex-wrap gap-1.5">
              {COPY_LIMITS.map((n) => (
                <button key={n} onClick={() => set("limits", toggle(filters.limits, n))} className={chip(filters.limits.includes(n))}>
                  {LIMIT_LABELS[n]}
                </button>
              ))}
            </div>
          </Section>

          {shop && (
            <>
              <Section title="Preço base (gold)">
                <RangeInput range={filters.price} onChange={(r) => set("price", r)} step={100} />
              </Section>

              <Section title={`Preço base (${CREDIT_LABEL.toLowerCase()})`}>
                <RangeInput range={filters.priceCash} onChange={(r) => set("priceCash", r)} step={1} />
              </Section>

              <Section title="Maleta">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(OWNERSHIP) as Ownership[]).map((o) => (
                    <button key={o} onClick={() => set("ownership", o)} className={chip(filters.ownership === o)}>
                      {OWNERSHIP[o]}
                    </button>
                  ))}
                </div>
              </Section>
            </>
          )}

          <div className={`flex items-end ${compact ? "" : "sm:col-span-2 lg:col-span-3"}`}>
            <button
              onClick={() => onChange({ ...DEFAULT_FILTERS, search: filters.search, sort: filters.sort, category: filters.category })}
              disabled={active === 0}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nível/Rank: "Exato" marca os níveis que você quer; "Faixa" pega de um nível até outro. */
function LevelSection({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const exact = filters.levelMode === "exact";
  const setMode = (levelMode: Filters["levelMode"]) => onChange({ ...filters, levelMode });
  const tab = (active: boolean) =>
    `rounded px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Nível / Rank</p>
        <div className="flex gap-0.5 rounded-md border border-zinc-800 bg-zinc-950 p-0.5">
          <button onClick={() => setMode("exact")} className={tab(exact)}>
            Exato
          </button>
          <button onClick={() => setMode("range")} className={tab(!exact)}>
            Faixa
          </button>
        </div>
      </div>

      {exact ? (
        <div className="flex flex-wrap gap-1">
          {LEVELS.map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...filters, levels: toggle(filters.levels, n) })}
              className={`${chip(filters.levels.includes(n))} w-8 px-0 text-center`}
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {LEVEL_PRESETS.map((p) => {
              const on = filters.level.min === p.min && filters.level.max === p.max;
              return (
                <button
                  key={p.label}
                  onClick={() => onChange({ ...filters, level: on ? { min: "", max: "" } : { min: p.min, max: p.max } })}
                  className={chip(on)}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <RangeInput range={filters.level} onChange={(level) => onChange({ ...filters, level })} max={12} labels={["de", "até"]} />
        </div>
      )}
      <p className="mt-1 text-[10px] text-zinc-600">Nos monstros XYZ vale o Rank.</p>
    </div>
  );
}

function Section({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

function RangeInput({
  range,
  onChange,
  step = 1,
  max,
  labels = ["mín.", "máx."],
}: {
  range: Range;
  onChange: (r: Range) => void;
  step?: number;
  max?: number;
  labels?: [string, string];
}) {
  const input = "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none";
  return (
    <div className="flex items-center gap-2">
      <input type="number" min={0} max={max} step={step} value={range.min} onChange={(e) => onChange({ ...range, min: e.target.value })} placeholder={labels[0]} className={input} />
      <span className="text-zinc-600">–</span>
      <input type="number" min={0} max={max} step={step} value={range.max} onChange={(e) => onChange({ ...range, max: e.target.value })} placeholder={labels[1]} className={input} />
    </div>
  );
}
