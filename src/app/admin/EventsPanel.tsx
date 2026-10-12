"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { GoldIcon } from "@/components/theme/CurrencyIcons";

interface GoldEventRow {
  id: string;
  name: string;
  bonusGold: number;
  startsAt: string;
  endsAt: string;
  newsPostId: string | null;
  phase: "scheduled" | "running" | "ended";
}

interface Announcement {
  eventId: string;
  title: string;
  summary: string;
  content: string;
}

const input = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-yellow-500/60 focus:outline-none";
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const when = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const PHASE = { scheduled: "Agendado", running: "Acontecendo", ended: "Encerrado" } as const;

/** Aba Eventos: evento de gold (bônus em cada duelo do Random) e o anúncio no Jornal. */
export function EventsPanel() {
  const [events, setEvents] = useState<GoldEventRow[]>([]);
  const [form, setForm] = useState(() => {
    const start = new Date(Date.now() + 3_600_000);
    start.setMinutes(0, 0, 0);
    return { name: "Fim de Semana Dourado", bonusGold: 50, startsAt: toLocalInput(start), endsAt: toLocalInput(new Date(start.getTime() + 2 * 86_400_000)) };
  });
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/gold-events");
    if (res.ok) setEvents(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setBusy(true);
    setFeedback(null);
    const res = await fetch("/api/admin/gold-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt), endsAt: new Date(form.endsAt) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setFeedback({ ok: false, text: data.error ?? "Não foi possível criar." });
    setFeedback({ ok: true, text: "Evento criado! Revise o anúncio abaixo e publique no Jornal." });
    setAnnouncement({ eventId: data.event.id, ...data.announcement });
    load();
  }

  async function openAnnouncement(id: string) {
    const res = await fetch(`/api/admin/gold-events/${id}`);
    if (res.ok) setAnnouncement({ eventId: id, ...(await res.json()) });
  }

  async function publish() {
    if (!announcement) return;
    setBusy(true);
    const { eventId, ...text } = announcement;
    const res = await fetch(`/api/admin/gold-events/${eventId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(text) });
    const data = await res.json();
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível publicar." });
    if (res.ok) {
      setAnnouncement(null);
      load();
    }
  }

  async function remove(e: GoldEventRow) {
    if (!confirm(`Apagar o evento "${e.name}"? O anúncio no Jornal continua (apague por lá, se quiser).`)) return;
    await fetch(`/api/admin/gold-events/${e.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {feedback.text}
        </p>
      )}

      <section className="rounded-xl border border-yellow-500/30 bg-zinc-900/60 p-5">
        <h2 className="flex items-center gap-2 font-bold text-zinc-100">
          <GoldIcon className="h-5 w-5 text-amber-300" /> Novo evento de gold
        </h2>
        <p className="mb-4 text-sm text-zinc-400">Durante o período, cada duelo no Random paga o bônus a mais (para quem vence e para quem perde).</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Nome do evento
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Bônus de gold por duelo
            <input type="number" min={1} value={form.bonusGold} onChange={(e) => setForm({ ...form, bonusGold: Number(e.target.value) })} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Início
            <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Fim
            <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={input} />
          </label>
        </div>
        <button onClick={create} disabled={busy || form.name.trim().length < 3 || form.bonusGold < 1} className="mt-4 flex items-center gap-1.5 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-40">
          <Plus className="h-4 w-4" /> Criar evento
        </button>
      </section>

      {announcement && (
        <section className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
          <h2 className="flex items-center gap-2 font-bold text-zinc-100">
            <Megaphone className="h-4 w-4 text-amber-300" /> Anúncio para o Jornal
          </h2>
          <p className="text-xs text-zinc-500">Texto pronto; ajuste do jeito que quiser. Ele fica fixado no topo do Jornal.</p>
          <input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} className={`${input} font-bold`} />
          <input value={announcement.summary} onChange={(e) => setAnnouncement({ ...announcement, summary: e.target.value })} className={input} />
          <textarea value={announcement.content} onChange={(e) => setAnnouncement({ ...announcement, content: e.target.value })} rows={9} className={input} />
          <div className="flex gap-2">
            <button onClick={publish} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40">
              <Megaphone className="h-4 w-4" /> Publicar no Jornal
            </button>
            <button onClick={() => setAnnouncement(null)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
              Agora não
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 font-bold text-zinc-100">Eventos</h2>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum evento ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-800/70">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-100">
                    {e.name} <span className="ml-1 text-xs text-amber-300">+{e.bonusGold} gold/duelo</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    <span className={e.phase === "running" ? "text-emerald-300" : ""}>{PHASE[e.phase]}</span> · {when(e.startsAt)} → {when(e.endsAt)}
                    {e.newsPostId && " · anúncio publicado"}
                  </p>
                </div>
                {!e.newsPostId && e.phase !== "ended" && (
                  <button onClick={() => openAnnouncement(e.id)} className="flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10">
                    <Megaphone className="h-3 w-3" /> Anunciar
                  </button>
                )}
                <button onClick={() => remove(e)} className="rounded-md border border-zinc-700 p-1.5 text-zinc-400 hover:text-red-300" aria-label="Apagar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
