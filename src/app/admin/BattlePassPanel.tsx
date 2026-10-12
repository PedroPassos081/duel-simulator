"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { RewardEditor, type Reward, type RewardOptions } from "./RewardEditor";
import { fromBrtInput, toBrtInput } from "@/lib/brt";

interface PassRow {
  id: string;
  name: string;
  description: string | null;
  artCardId: number | null;
  startsAt: string;
  endsAt: string;
  levels: number;
  xpPerLevel: number;
  xpWin: number;
  xpLoss: number;
  premiumPriceCash: number;
  active: boolean;
  _count: { rewards: number; progress: number };
}
interface RewardRow {
  level: number;
  track: "free" | "premium";
  label: string;
}
type Form = Omit<PassRow, "_count" | "id" | "startsAt" | "endsAt"> & { id?: string; startsAt: string; endsAt: string };

const input = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none";
const FINISH_OPTIONS = [
  ["", "Raridade sorteada"],
  ["normal", "Normal"],
  ["rara", "Rara"],
  ["ultra", "Ultra"],
  ["secreta", "Secreta"],
] as const;

const emptyForm = (): Form => ({
  name: "",
  description: "",
  artCardId: 10000010,
  startsAt: toBrtInput(new Date()),
  endsAt: toBrtInput(new Date(Date.now() + 30 * 86_400_000)),
  levels: 50,
  xpPerLevel: 500,
  xpWin: 100,
  xpLoss: 40,
  premiumPriceCash: 300,
  active: true,
});

/** Aba Passe: temporadas do Passe de Batalha e o prêmio de cada nível (grátis e Premium). */
export function BattlePassPanel({ cosmetics }: { cosmetics: { id: string; name: string; type: string }[] }) {
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [editing, setEditing] = useState<{ level: number; track: "free" | "premium" } | null>(null);
  const [mysteryFinish, setMysteryFinish] = useState("");
  const [options, setOptions] = useState<RewardOptions>({ cosmetics, structures: [] });
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/battle-pass");
    if (res.ok) setPasses(await res.json());
  }, []);
  const loadRewards = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/battle-pass?rewards=${id}`);
    if (res.ok) setRewards(await res.json());
  }, []);
  useEffect(() => {
    load();
    fetch("/api/admin/options")
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => o && setOptions({ cosmetics, structures: o.structures }))
      .catch(() => {});
  }, [load, cosmetics]);
  useEffect(() => {
    if (selected) loadRewards(selected);
  }, [selected, loadRewards]);

  async function send(body: object) {
    setFeedback(null);
    const res = await fetch("/api/admin/battle-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível salvar." });
    return res.ok;
  }

  async function savePass() {
    if (!form) return;
    const { id, ...rest } = form;
    const body = { ...rest, description: rest.description || null, startsAt: fromBrtInput(form.startsAt), endsAt: fromBrtInput(form.endsAt) };
    if (await send(id ? { action: "update", id, ...body } : { action: "create", ...body })) {
      setForm(null);
      load();
    }
  }

  async function setReward(reward: Reward | { kind: "mystery_card"; finish?: string } | null) {
    if (!selected || !editing) return;
    const clean = reward && "cardName" in reward ? (({ cardName, ...r }) => (void cardName, r))(reward) : reward;
    if (await send({ action: "reward", passId: selected, level: editing.level, track: editing.track, reward: clean })) {
      setEditing(null);
      loadRewards(selected);
    }
  }

  const current = passes.find((p) => p.id === selected);
  const now = Date.now();

  return (
    <div className="flex flex-col gap-5">
      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{feedback.text}</p>
      )}

      {!form ? (
        <button onClick={() => setForm(emptyForm())} className="flex w-fit items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400">
          <Plus className="h-4 w-4" /> Nova temporada do passe
        </button>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-zinc-100">{form.id ? "Editar passe" : "Novo passe"}</h2>
            <button onClick={() => setForm(null)} className="text-zinc-400 hover:text-zinc-200" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome (ex.: Temporada 2 · A Ira de Obelisco)" className={input} />
          <textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição (aparece no topo do passe)" rows={2} className={input} />
          <div className="grid gap-2 sm:grid-cols-4">
            {(
              [
                ["startsAt", "Início (Brasília)", "datetime-local"],
                ["endsAt", "Fim (Brasília)", "datetime-local"],
                ["artCardId", "Arte do topo (ID da carta)", "number"],
                ["levels", "Níveis", "number"],
                ["xpPerLevel", "XP por nível", "number"],
                ["xpWin", "XP por vitória", "number"],
                ["xpLoss", "XP por duelo (derrota)", "number"],
                ["premiumPriceCash", "Preço do Premium (crédito)", "number"],
              ] as const
            ).map(([key, label, type]) => (
              <label key={key} className="flex flex-col gap-1 text-xs text-zinc-500">
                {label}
                <input
                  type={type}
                  value={(form[key] as string | number | null) ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value })}
                  className={input}
                />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Ativo (aparece na loja entre o início e o fim)
          </label>
          <button onClick={savePass} disabled={form.name.trim().length < 3} className="flex w-fit items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40">
            <Save className="h-4 w-4" /> {form.id ? "Salvar" : "Criar passe"}
          </button>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-zinc-100">
          <Crown className="h-4 w-4 text-amber-300" /> Temporadas do passe
        </h2>
        {passes.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum passe ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-800/70">
            {passes.map((p) => {
              const live = p.active && new Date(p.startsAt).getTime() <= now && now < new Date(p.endsAt).getTime();
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-100">
                      {p.name} {live && <span className="ml-1 rounded bg-emerald-500/20 px-1.5 text-[11px] font-bold text-emerald-300">no ar</span>}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {toBrtInput(p.startsAt).replace("T", " ")} → {toBrtInput(p.endsAt).replace("T", " ")} · {p.levels} níveis · {p._count.progress} jogadores · Premium {p.premiumPriceCash} crédito
                    </p>
                  </div>
                  <button
                    onClick={() => setForm({ ...p, description: p.description ?? "", startsAt: toBrtInput(p.startsAt), endsAt: toBrtInput(p.endsAt) })}
                    className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                  <button onClick={() => setSelected(selected === p.id ? null : p.id)} className="rounded-md border border-amber-500/50 px-2 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/10">
                    {selected === p.id ? "Fechar prêmios" : "Prêmios"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* PRÊMIOS POR NÍVEL */}
      {current && (
        <section className="rounded-xl border border-amber-500/30 bg-zinc-900/60 p-5">
          <h2 className="mb-3 font-bold text-zinc-100">Prêmios · {current.name}</h2>
          <div className="max-h-[520px] overflow-y-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Nível</th>
                  <th className="px-2 py-2">Grátis</th>
                  <th className="px-2 py-2 text-amber-300">Premium</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: current.levels }, (_, i) => i + 1).map((level) => (
                  <tr key={level} className="border-t border-zinc-800/70">
                    <td className="px-2 py-1.5 font-bold text-zinc-400">{level}</td>
                    {(["free", "premium"] as const).map((track) => {
                      const r = rewards.find((x) => x.level === level && x.track === track);
                      return (
                        <td key={track} className="px-2 py-1.5">
                          <button onClick={() => setEditing({ level, track })} className="flex items-center gap-1.5 text-left text-xs text-zinc-200 hover:text-amber-200">
                            <Pencil className="h-3 w-3 shrink-0 text-zinc-500" /> {r?.label ?? <span className="italic text-zinc-600">sem prêmio</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editing && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-zinc-950/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-amber-200">
                  Nível {editing.level} · {editing.track === "premium" ? "Premium" : "Grátis"}
                </p>
                <button onClick={() => setEditing(null)} className="text-zinc-400 hover:text-zinc-200" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-purple-500/40 p-2">
                <span className="text-xs font-bold text-purple-200">Carta surpresa</span>
                <select value={mysteryFinish} onChange={(e) => setMysteryFinish(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100">
                  {FINISH_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button onClick={() => setReward({ kind: "mystery_card", ...(mysteryFinish ? { finish: mysteryFinish } : {}) })} className="ml-auto rounded-lg bg-purple-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-purple-400">
                  Usar carta surpresa
                </button>
              </div>
              <RewardEditor options={options} onAdd={(r) => setReward(r)} />
              <button onClick={() => setReward(null)} className="flex w-fit items-center gap-1 text-xs text-zinc-400 hover:text-red-300">
                <Trash2 className="h-3 w-3" /> Tirar o prêmio deste nível
              </button>
            </div>
          )}
        </section>
      )}

      <ShowcaseAdmin />
    </div>
  );
}

interface ShowcaseRow {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  effect: string | null;
  inShop: boolean;
  priceCash: number | null;
  shopUnlockAt: string | null;
}

/** Cosméticos dos passes na vitrine da aba Cosméticos: na loja ou não, preço e quando destranca. */
function ShowcaseAdmin() {
  const [rows, setRows] = useState<ShowcaseRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, { inShop: boolean; priceCash: number; unlock: string }>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/battle-pass?cosmetics=1");
    if (!res.ok) return;
    const data: ShowcaseRow[] = await res.json();
    setRows(data);
    setEdits(Object.fromEntries(data.map((r) => [r.id, { inShop: r.inShop, priceCash: r.priceCash ?? 150, unlock: r.shopUnlockAt ? toBrtInput(r.shopUnlockAt) : "" }])));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(id: string) {
    const e = edits[id];
    const res = await fetch("/api/admin/battle-pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cosmetic_shop", cosmeticId: id, inShop: e.inShop, priceCash: e.priceCash, shopUnlockAt: e.unlock ? fromBrtInput(e.unlock) : null }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível salvar." });
    if (res.ok) load();
  }

  if (!rows || rows.length === 0) return null;
  return (
    <section className="rounded-xl border border-purple-500/30 bg-zinc-900/60 p-5">
      <h2 className="font-bold text-zinc-100">Vitrine da loja (aba Cosméticos)</h2>
      <p className="mb-3 text-sm text-zinc-400">Cosméticos dos passes que podem ir para a loja. Trancado até a data; o preço é em crédito.</p>
      {feedback && (
        <p className={`mb-3 rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{feedback.text}</p>
      )}
      <ul className="flex flex-col divide-y divide-zinc-800/70">
        {rows.map((r) => {
          const e = edits[r.id];
          if (!e) return null;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="w-56 min-w-0 truncate font-semibold text-zinc-100" title={r.name}>
                {r.name} <span className="text-xs font-normal text-zinc-500">({r.type})</span>
              </span>
              <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                <input type="checkbox" checked={e.inShop} onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, inShop: ev.target.checked } })} /> Na loja
              </label>
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                Preço
                <input type="number" min={1} value={e.priceCash} onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, priceCash: Number(ev.target.value) } })} className={`${input} !w-20`} />
              </label>
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                Destranca em
                <input type="datetime-local" value={e.unlock} onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, unlock: ev.target.value } })} className={`${input} !w-52`} />
              </label>
              <button onClick={() => save(r.id)} className="ml-auto rounded-lg bg-purple-500 p-1.5 text-white hover:bg-purple-400" aria-label="Salvar">
                <Save className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
