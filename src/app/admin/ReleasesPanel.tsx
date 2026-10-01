"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, DoorClosed, DoorOpen, Lock, Plus, Rocket, Save, Search, Trash2 } from "lucide-react";
import { addDays, formatBrt, fromBrtInput, toBrtInput } from "@/lib/brt";

interface RoomRow {
  id: string;
  name: string;
  manualOpen: boolean;
  opensAt: string | null;
  open: boolean;
}
interface Release {
  id: string;
  name: string;
  description: string | null;
  releaseAt: string | null;
  releasedAt: string | null;
  promoPercent: number;
  promoHours: number;
  cards: number;
}
interface UnreleasedCard {
  id: number;
  name: string;
  type: string;
  imageUrl: string | null;
  releaseDate: string | null;
  releaseId: string | null;
}
type ReleaseForm = { id?: string; name: string; description: string; releaseAt: string; promoPercent: number; promoHours: number };

const input = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none";
const chip = (active: boolean) =>
  `flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${active ? "border-amber-500 bg-amber-500/10 text-amber-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`;
const toForm = (r?: Release): ReleaseForm => ({
  id: r?.id,
  name: r?.name ?? "",
  description: r?.description ?? "",
  releaseAt: r?.releaseAt ? toBrtInput(r.releaseAt) : "",
  promoPercent: r?.promoPercent ?? 0,
  promoHours: r?.promoHours ?? 0,
});

/** Aba Lançamentos: abrir as salas, programar lançamentos de cartas (com promoção) e lançar cartas bloqueadas. */
export function ReleasesPanel() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomEdits, setRoomEdits] = useState<Record<string, { mode: "open" | "closed" | "date"; opensAt: string }>>({});
  const [releases, setReleases] = useState<Release[]>([]);
  const [forms, setForms] = useState<Record<string, ReleaseForm>>({});
  const [newForm, setNewForm] = useState<ReleaseForm | null>(null);
  const [cards, setCards] = useState<UnreleasedCard[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [moveTo, setMoveTo] = useState<string>("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/releases");
    if (!res.ok) return;
    const data = await res.json();
    setRooms(data.rooms);
    setReleases(data.releases);
    setCards(data.cards);
    setForms(Object.fromEntries(data.releases.map((r: Release) => [r.id, toForm(r)])));
    setRoomEdits(
      Object.fromEntries(
        data.rooms.map((r: RoomRow) => [r.id, { mode: r.manualOpen ? "open" : r.opensAt ? "date" : "closed", opensAt: r.opensAt ? toBrtInput(r.opensAt) : "" }])
      )
    );
    setSelected(new Set());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(body: object, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setFeedback(null);
    const res = await fetch("/api/admin/releases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível salvar." });
    if (res.ok) await load();
    return res.ok;
  }

  const releaseBody = (f: ReleaseForm) => ({
    name: f.name,
    description: f.description || null,
    releaseAt: f.releaseAt ? fromBrtInput(f.releaseAt) : null,
    promoPercent: Number(f.promoPercent) || 0,
    promoHours: Number(f.promoHours) || 0,
  });

  const obelisk = rooms.find((r) => r.id === "obelisk");
  const obeliskOpensAt = obelisk?.opensAt ? new Date(obelisk.opensAt) : null;
  const visibleCards = useMemo(() => (cards ?? []).filter((c) => c.name.toLowerCase().includes(filter.trim().toLowerCase())), [cards, filter]);
  const groups = useMemo(() => {
    const byRelease = new Map<string, UnreleasedCard[]>();
    for (const c of visibleCards) byRelease.set(c.releaseId ?? "", [...(byRelease.get(c.releaseId ?? "") ?? []), c]);
    return [...byRelease.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
  }, [visibleCards]);
  const toggle = (ids: number[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) (on ? next.add(id) : next.delete(id));
      return next;
    });

  // Função (e não componente): assim os campos não perdem o foco a cada letra
  const releaseEditor = (form: ReleaseForm, onChange: (f: ReleaseForm) => void) => (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Nome do lançamento
        <input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Dia e hora (Brasília)
        <input type="datetime-local" value={form.releaseAt} onChange={(e) => onChange({ ...form, releaseAt: e.target.value })} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-2">
        Descrição (vai para o calendário e para o anúncio)
        <textarea value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} rows={2} className={input} />
      </label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Promoção (% de desconto)
          <input type="number" min={0} max={50} value={form.promoPercent} onChange={(e) => onChange({ ...form, promoPercent: Number(e.target.value) })} className={`${input} w-28`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Nas primeiras (horas, até 24)
          <input type="number" min={0} max={24} value={form.promoHours} onChange={(e) => onChange({ ...form, promoHours: Number(e.target.value) })} className={`${input} w-28`} />
        </label>
        {obeliskOpensAt && (
          <button type="button" onClick={() => onChange({ ...form, releaseAt: toBrtInput(addDays(obeliskOpensAt, 7)) })} className={chip(false)}>
            <CalendarPlus className="h-3.5 w-3.5" /> 7 dias depois da abertura da Obelisco
          </button>
        )}
      </div>
      <p className="text-[11px] text-zinc-500 sm:col-span-2">
        {form.promoPercent > 0 && form.promoHours > 0
          ? `As cartas deste lançamento saem ${form.promoPercent}% mais baratas nas primeiras ${form.promoHours}h.`
          : "Sem promoção (coloque % e horas para ativar)."}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{feedback.text}</p>
      )}

      {/* SALAS */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="font-bold text-zinc-100">Abertura das salas</h2>
        <p className="mb-4 text-sm text-zinc-400">Sala fechada aparece no Random com um cadeado e a data. A data de abertura vai para o calendário. Horário de Brasília.</p>
        <ul className="flex flex-col gap-3">
          {rooms.map((room) => {
            const edit = roomEdits[room.id] ?? { mode: "open", opensAt: "" };
            const setEdit = (patch: Partial<typeof edit>) => setRoomEdits({ ...roomEdits, [room.id]: { ...edit, ...patch } });
            return (
              <li key={room.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 p-3">
                <span className="w-32 font-bold text-zinc-100">{room.name}</span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${room.open ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                  {room.open ? "Aberta agora" : room.opensAt ? `Abre ${formatBrt(new Date(room.opensAt), true)}` : "Fechada"}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button onClick={() => setEdit({ mode: "open" })} className={chip(edit.mode === "open")}>
                    <DoorOpen className="h-3.5 w-3.5" /> Aberta
                  </button>
                  <button onClick={() => setEdit({ mode: "closed" })} className={chip(edit.mode === "closed")}>
                    <DoorClosed className="h-3.5 w-3.5" /> Fechada
                  </button>
                  <button onClick={() => setEdit({ mode: "date" })} className={chip(edit.mode === "date")}>
                    <Lock className="h-3.5 w-3.5" /> Abrir em
                  </button>
                  {edit.mode === "date" && <input type="datetime-local" value={edit.opensAt} onChange={(e) => setEdit({ opensAt: e.target.value })} className={`${input} !w-52`} />}
                  <button
                    disabled={busy || (edit.mode === "date" && !edit.opensAt)}
                    onClick={() => act({ action: "room", roomId: room.id, open: edit.mode === "open", opensAt: edit.mode === "date" ? fromBrtInput(edit.opensAt) : null })}
                    className="rounded-lg bg-amber-500 p-2 text-black hover:bg-amber-400 disabled:opacity-40"
                    aria-label="Salvar"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* LANÇAMENTOS PROGRAMADOS */}
      <section className="rounded-xl border border-amber-500/30 bg-zinc-900/60 p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold text-zinc-100">
            <Rocket className="h-4 w-4 text-amber-300" /> Lançamentos
          </h2>
          {!newForm && (
            <button onClick={() => setNewForm(toForm())} className={chip(false)}>
              <Plus className="h-3.5 w-3.5" /> Novo lançamento
            </button>
          )}
        </div>
        <p className="mb-4 text-sm text-zinc-400">Na data, as cartas entram na loja sozinhas e sai um anúncio fixado no Jornal. O lançamento aparece no calendário.</p>

        {newForm && (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-dashed border-amber-500/40 p-3">
            {releaseEditor(newForm, setNewForm)}
            <div className="flex gap-2">
              <button disabled={busy || newForm.name.trim().length < 3} onClick={async () => (await act({ action: "create", ...releaseBody(newForm) })) && setNewForm(null)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40">
                Criar
              </button>
              <button onClick={() => setNewForm(null)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {releases.length === 0 && <li className="text-sm text-zinc-500">Nenhum lançamento.</li>}
          {releases.map((r) => {
            const form = forms[r.id] ?? toForm(r);
            const done = Boolean(r.releasedAt);
            return (
              <li key={r.id} className={`rounded-lg border p-3 ${done ? "border-zinc-800 opacity-80" : "border-zinc-700"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-zinc-100">{r.name}</span>
                  <span className="text-xs text-zinc-500">{r.cards} cartas</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${done ? "bg-emerald-500/15 text-emerald-300" : r.releaseAt ? "bg-sky-500/15 text-sky-300" : "bg-zinc-700/60 text-zinc-300"}`}>
                    {done ? `Lançado ${formatBrt(new Date(r.releasedAt!), true)}` : r.releaseAt ? `Programado ${formatBrt(new Date(r.releaseAt), true)}` : "Sem data"}
                  </span>
                </div>
                {!done && (
                  <>
                    {releaseEditor(form, (f) => setForms({ ...forms, [r.id]: f }))}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={busy} onClick={() => act({ action: "update", id: r.id, ...releaseBody(form) })} className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-40">
                        <Save className="h-3.5 w-3.5" /> Salvar
                      </button>
                      <button disabled={busy || r.cards === 0} onClick={() => act({ action: "release_now", id: r.id }, `Lançar "${r.name}" agora? As ${r.cards} cartas entram na loja e sai o anúncio no Jornal.`)} className="flex items-center gap-1 rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40">
                        <Rocket className="h-3.5 w-3.5" /> Lançar agora
                      </button>
                      <button disabled={busy} onClick={() => act({ action: "delete", id: r.id }, `Apagar o lançamento "${r.name}"? As cartas continuam bloqueadas, sem data.`)} className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:text-red-300" aria-label="Apagar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* CARTAS EXISTENTES NÃO LANÇADAS */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="font-bold text-zinc-100">Cartas existentes não lançadas</h2>
        <p className="mb-3 text-sm text-zinc-400">Estas cartas já existem no jogo, mas ficam fora da loja e dos decks. Selecione e lance na hora ou coloque num lançamento.</p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-zinc-500" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar pelo nome..." className={`${input} pl-8`} />
          </div>
          <span className="text-xs text-zinc-400">{selected.size} selecionada(s)</span>
          <button disabled={busy || selected.size === 0} onClick={() => act({ action: "release_cards", cardIds: [...selected] }, `Lançar ${selected.size} carta(s) agora? Elas entram na loja na hora.`)} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-40">
            <Rocket className="h-3.5 w-3.5" /> Lançar agora
          </button>
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={`${input} !w-auto`}>
            <option value="">Sem lançamento</option>
            {releases.filter((r) => !r.releasedAt).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button disabled={busy || selected.size === 0} onClick={() => act({ action: "assign_cards", cardIds: [...selected], releaseId: moveTo || null })} className={chip(false)}>
            Mover
          </button>
        </div>

        {cards === null ? (
          <p className="text-sm text-zinc-400">Carregando...</p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-zinc-500">Todas as cartas já foram lançadas.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(([releaseId, list]) => {
              const title = releaseId ? releases.find((r) => r.id === releaseId)?.name ?? "Lançamento" : "Bloqueadas (sem lançamento)";
              const all = list.every((c) => selected.has(c.id));
              return (
                <div key={releaseId || "none"}>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      {title} <span className="text-zinc-600">({list.length})</span>
                    </p>
                    <button onClick={() => toggle(list.map((c) => c.id), !all)} className="text-[11px] text-amber-300 hover:underline">
                      {all ? "Desmarcar todas" : "Marcar todas"}
                    </button>
                  </div>
                  <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-9">
                    {list.map((c) => {
                      const on = selected.has(c.id);
                      return (
                        <li key={c.id}>
                          <button onClick={() => toggle([c.id], !on)} title={c.name} className={`block w-full overflow-hidden rounded-md ring-2 transition ${on ? "ring-amber-400" : "ring-transparent opacity-80 hover:opacity-100"}`}>
                            {c.imageUrl ? <img src={c.imageUrl} alt={c.name} loading="lazy" className="aspect-[59/86] w-full object-cover" /> : <span className="flex aspect-[59/86] items-center justify-center bg-zinc-800 p-1 text-[10px]">{c.name}</span>}
                          </button>
                          <p className="mt-0.5 truncate text-[10px] text-zinc-400" title={c.name}>
                            {c.name}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
