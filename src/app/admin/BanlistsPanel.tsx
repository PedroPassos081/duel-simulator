"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, Plus, Search, Trash2, X } from "lucide-react";
import { BAN_STATUS_INFO, type BanStatus } from "@/lib/banlist-shared";

interface BanlistRow {
  id: string;
  name: string;
  kind: "room" | "tournament";
  description: string | null;
  counts: Record<BanStatus, number>;
  pendingChanges: number;
}
interface Entry {
  cardId: number;
  status: BanStatus;
  name: string;
  imageUrl: string | null;
}
interface Change {
  id: string;
  name: string;
  from: BanStatus;
  to: BanStatus;
}
interface Announcement {
  title: string;
  summary: string;
  content: string;
  full: boolean;
  pendingCount: number;
}

const LISTED: BanStatus[] = ["forbidden", "limited", "semi-limited"];
const input = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-red-500/50 focus:outline-none";
const Badge = ({ status }: { status: BanStatus }) => (
  <span className={`rounded border px-1.5 py-px text-[10px] font-bold ${BAN_STATUS_INFO[status].className}`}>{BAN_STATUS_INFO[status].label}</span>
);

/** Aba Banlists: salas e torneios. Mudanças valem na hora; o anúncio no Jornal lista o que mudou. */
export function BanlistsPanel() {
  const [lists, setLists] = useState<BanlistRow[]>([]);
  const [selected, setSelected] = useState("slifer");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [pending, setPending] = useState<Change[]>([]);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; imageUrl: string | null }[]>([]);
  const [creating, setCreating] = useState<{ name: string; copyFrom: string } | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const loadLists = useCallback(async () => {
    const res = await fetch("/api/admin/banlists");
    if (res.ok) setLists(await res.json());
  }, []);
  const loadEntries = useCallback(async () => {
    const res = await fetch(`/api/admin/banlists/${selected}`);
    if (!res.ok) return;
    const data = await res.json();
    setEntries(data.entries);
    setPending(data.pending);
  }, [selected]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);
  useEffect(() => {
    setEntries(null);
    setAnnouncement(null);
    setFilter("");
    loadEntries();
  }, [loadEntries]);

  // Busca de cartas para adicionar (espera parar de digitar)
  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/cards?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function setStatus(cardId: number, status: BanStatus) {
    setFeedback(null);
    const res = await fetch(`/api/admin/banlists/${selected}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, status }) });
    const data = await res.json();
    if (!res.ok) return setFeedback({ ok: false, text: data.error ?? "Não foi possível salvar." });
    if (data.changed) setFeedback({ ok: true, text: `${data.name}: ${BAN_STATUS_INFO[status as BanStatus].label}. Já está valendo.` });
    loadEntries();
    loadLists();
  }

  async function createList() {
    if (!creating) return;
    const res = await fetch("/api/admin/banlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: creating.name, copyFrom: creating.copyFrom || null }),
    });
    const data = await res.json();
    if (!res.ok) return setFeedback({ ok: false, text: data.error ?? "Não foi possível criar." });
    setCreating(null);
    setFeedback({ ok: true, text: "Banlist criada. Escolha ela ao lançar o torneio." });
    await loadLists();
    setSelected(data.id);
  }

  async function removeList() {
    const list = lists.find((l) => l.id === selected);
    if (!list || !confirm(`Apagar a banlist "${list.name}"?`)) return;
    const res = await fetch(`/api/admin/banlists/${selected}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setFeedback({ ok: false, text: data.error ?? "Não foi possível apagar." });
    setSelected("slifer");
    loadLists();
  }

  async function openAnnouncement(full: boolean) {
    const res = await fetch(`/api/admin/banlists/${selected}/announce${full ? "?full=1" : ""}`);
    if (res.ok) setAnnouncement(await res.json());
  }

  async function publish() {
    if (!announcement) return;
    const res = await fetch(`/api/admin/banlists/${selected}/announce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: announcement.title, summary: announcement.summary, content: announcement.content }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível publicar." });
    if (res.ok) {
      setAnnouncement(null);
      loadEntries();
      loadLists();
    }
  }

  const current = lists.find((l) => l.id === selected);
  const inList = useMemo(() => new Map((entries ?? []).map((e) => [e.cardId, e.status])), [entries]);
  const visible = (entries ?? []).filter((e) => e.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      {/* QUAL BANLIST */}
      <div className="flex flex-wrap gap-2">
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => setSelected(l.id)}
            className={`rounded-xl border px-3 py-2 text-left ${selected === l.id ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600"}`}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
              {l.name}
              {l.pendingChanges > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-black" title="Mudanças não anunciadas">{l.pendingChanges}</span>}
            </span>
            <span className="text-[11px] text-zinc-500">
              {l.kind === "room" ? "Sala" : "Torneio"} · {l.counts.forbidden} proib. · {l.counts.limited} lim. · {l.counts["semi-limited"]} semi
            </span>
          </button>
        ))}
        <button onClick={() => setCreating({ name: "", copyFrom: "obelisk" })} className="flex items-center gap-1 rounded-xl border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100">
          <Plus className="h-4 w-4" /> Nova banlist
        </button>
      </div>

      {creating && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-zinc-500">
            Nome (ex.: Torneio de Halloween)
            <input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} className={input} autoFocus />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Começar copiando
            <select value={creating.copyFrom} onChange={(e) => setCreating({ ...creating, copyFrom: e.target.value })} className={input}>
              <option value="">Vazia</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={createList} disabled={creating.name.trim().length < 3} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-40">
            Criar
          </button>
          <button onClick={() => setCreating(null)} className="p-2 text-zinc-500 hover:text-zinc-200" aria-label="Cancelar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{feedback.text}</p>
      )}

      {current && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-bold text-zinc-100">{current.name}</h2>
              <p className="text-sm text-zinc-400">{current.description ?? "Mudanças valem na hora para a fila e o Deck Builder."}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openAnnouncement(pending.length === 0)} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-black hover:bg-amber-400">
                <Megaphone className="h-3.5 w-3.5" /> Anunciar no Jornal
              </button>
              {current.kind !== "room" && (
                <button onClick={removeList} className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:text-red-300" aria-label="Apagar banlist">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* MUDANÇAS AINDA NÃO ANUNCIADAS */}
          {pending.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="mb-1.5 text-xs font-bold text-amber-200">
                {pending.length} {pending.length === 1 ? "mudança ainda não anunciada" : "mudanças ainda não anunciadas"}
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-300">
                {pending.map((c) => (
                  <li key={c.id} className="flex items-center gap-1">
                    {c.name}: <Badge status={c.from} /> → <Badge status={c.to} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ANÚNCIO */}
          {announcement && (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-zinc-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-bold text-amber-200">
                  <Megaphone className="h-4 w-4" /> Anúncio para o Jornal
                </p>
                <div className="flex gap-1.5 text-xs">
                  <button onClick={() => openAnnouncement(false)} disabled={pending.length === 0} className={`rounded-md border px-2 py-1 ${!announcement.full ? "border-amber-500 text-amber-200" : "border-zinc-700 text-zinc-400"} disabled:opacity-40`}>
                    Só as mudanças
                  </button>
                  <button onClick={() => openAnnouncement(true)} className={`rounded-md border px-2 py-1 ${announcement.full ? "border-amber-500 text-amber-200" : "border-zinc-700 text-zinc-400"}`}>
                    Lista completa
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">Texto pronto; ajuste do jeito que quiser. Ele fica fixado no topo do Jornal.</p>
              <input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} className={`${input} font-bold`} />
              <input value={announcement.summary} onChange={(e) => setAnnouncement({ ...announcement, summary: e.target.value })} className={input} />
              <textarea value={announcement.content} onChange={(e) => setAnnouncement({ ...announcement, content: e.target.value })} rows={12} className={input} />
              <div className="flex gap-2">
                <button onClick={publish} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400">
                  <Megaphone className="h-4 w-4" /> Publicar no Jornal
                </button>
                <button onClick={() => setAnnouncement(null)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                  Agora não
                </button>
              </div>
            </div>
          )}

          {/* ADICIONAR CARTA */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Adicionar carta: buscar pelo nome em inglês..." className={`${input} pl-8`} />
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl">
                {results.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 border-b border-zinc-800/70 px-2.5 py-1.5 text-sm last:border-0">
                    <span className="min-w-0 flex-1 truncate text-zinc-200">{c.name}</span>
                    {inList.has(c.id) && <Badge status={inList.get(c.id)!} />}
                    {LISTED.map((s) => (
                      <button key={s} onClick={() => setStatus(c.id, s)} className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${BAN_STATUS_INFO[s].className}`}>
                        {BAN_STATUS_INFO[s].label}
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar nesta lista..." className={`${input} mb-3 sm:w-64`} />

          {entries === null ? (
            <p className="text-sm text-zinc-400">Carregando...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {LISTED.map((status) => {
                const cards = visible.filter((e) => e.status === status);
                return (
                  <div key={status}>
                    <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                      <Badge status={status} /> {cards.length}
                    </p>
                    {cards.length === 0 ? (
                      <p className="text-xs text-zinc-600">Nenhuma.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {cards.map((e) => (
                          <li key={e.cardId} className="group flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1">
                            {e.imageUrl && <img src={e.imageUrl} alt="" className="h-8 w-6 shrink-0 rounded-sm object-cover" loading="lazy" />}
                            <span className="min-w-0 flex-1 truncate text-xs text-zinc-200" title={e.name}>
                              {e.name}
                            </span>
                            <select
                              value={e.status}
                              onChange={(ev) => setStatus(e.cardId, ev.target.value as BanStatus)}
                              className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300"
                              aria-label={`Status de ${e.name}`}
                            >
                              {(Object.keys(BAN_STATUS_INFO) as BanStatus[]).map((s) => (
                                <option key={s} value={s}>
                                  {BAN_STATUS_INFO[s].label}
                                </option>
                              ))}
                            </select>
                            <button onClick={() => setStatus(e.cardId, "unlimited")} className="text-zinc-600 hover:text-red-300" aria-label={`Liberar ${e.name}`} title="Liberar (tirar da lista)">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
