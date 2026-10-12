"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, GitBranch, Pencil, Plus, Save, X } from "lucide-react";
import { RewardEditor, RewardList, type Reward, type RewardOptions } from "./RewardEditor";
import { BracketManager } from "./BracketManager";
import { fromBrtInput, toBrtInput } from "@/lib/brt";

type Phase = "scheduled" | "running" | "ended" | "finished" | "cancelled";
type StageKey = "A" | "B" | "final";
const STAGE_KEYS: StageKey[] = ["A", "B", "final"];

interface TournamentRow {
  id: string;
  name: string;
  description: string | null;
  type: "official" | "quick";
  format: string; // id da banlist
  startsAt: string;
  endsAt: string;
  phase: Phase;
  prizes: { placement: number; rewards: Reward[] }[];
  structure: "points" | "bracket";
  maxEntrants: number | null;
  clockSeconds: number;
  activatedAt: string | null;
  pausedAt: string | null;
  stages: { key: string; startsAt: string }[];
  _count: { entries: number; matches: number; series: number };
}

interface Form {
  id?: string;
  name: string;
  description: string;
  type: "official" | "quick";
  format: string; // id da banlist
  startsAt: string;
  endsAt: string;
  prizes: { placement: number; rewards: Reward[] }[];
  // Chaves (melhor de 3): vagas, tempo de cada jogador e horários (Brasília)
  structure: "points" | "bracket";
  maxEntrants: number;
  clockMinutes: number;
  stages: Record<StageKey, string>;
}

const PHASE: Record<Phase, { label: string; className: string }> = {
  scheduled: { label: "Agendado", className: "text-sky-300" },
  running: { label: "Acontecendo", className: "text-emerald-300" },
  ended: { label: "Aguardando finalizar", className: "text-amber-300" },
  finished: { label: "Finalizado", className: "text-zinc-400" },
  cancelled: { label: "Cancelado", className: "text-zinc-500" },
};
const input = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none";
const chip = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-xs font-semibold ${active ? "border-amber-500 bg-amber-500/10 text-amber-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"} disabled:opacity-50`;
const when = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const stageLabel = (key: StageKey) => (key === "final" ? "Final" : `Chave ${key}`);

const emptyForm = (): Form => {
  const start = new Date(Date.now() + 3_600_000);
  start.setMinutes(0, 0, 0);
  return {
    name: "",
    description: "",
    type: "quick",
    format: "obelisk",
    startsAt: toBrtInput(start),
    endsAt: toBrtInput(new Date(start.getTime() + 2 * 3_600_000)),
    prizes: [
      { placement: 1, rewards: [] },
      { placement: 2, rewards: [] },
      { placement: 3, rewards: [] },
    ],
    structure: "points",
    maxEntrants: 16,
    clockMinutes: 5,
    stages: { A: "", B: "", final: "" },
  };
};

/** Aba Torneios: criar (pontos ou chaves; oficial ou rápido), premiação, chaves e finalizar. */
export function TournamentsPanel({ cosmetics }: { cosmetics: { id: string; name: string; type: string }[] }) {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [options, setOptions] = useState<RewardOptions>({ cosmetics, structures: [] });
  const [banlists, setBanlists] = useState<{ id: string; name: string; kind: string }[]>([
    { id: "slifer", name: "Sala Slifer", kind: "room" },
    { id: "obelisk", name: "Sala Obelisco", kind: "room" },
  ]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/tournaments");
    if (res.ok) setRows(await res.json());
  }, []);
  useEffect(() => {
    load();
    fetch("/api/admin/options")
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => {
        if (!o) return;
        setOptions({ cosmetics, structures: o.structures });
        if (o.banlists?.length) setBanlists(o.banlists);
      })
      .catch(() => {});
  }, [load, cosmetics]);

  async function save() {
    if (!form) return;
    setBusy(true);
    setFeedback(null);
    const bracket = form.structure === "bracket";
    const stageDates = bracket ? STAGE_KEYS.map((key) => ({ key, startsAt: fromBrtInput(form.stages[key]) })) : [];
    const body = {
      name: form.name,
      description: form.description || null,
      type: form.type,
      format: form.format,
      // Chaves: o período vai da Chave A até um dia depois da Final
      startsAt: bracket ? stageDates[0].startsAt : fromBrtInput(form.startsAt),
      endsAt: bracket ? new Date(stageDates[2].startsAt.getTime() + 86_400_000) : fromBrtInput(form.endsAt),
      prizes: form.prizes.filter((p) => p.rewards.length > 0),
      structure: form.structure,
      ...(bracket ? { maxEntrants: form.maxEntrants, clockSeconds: Math.max(1, form.clockMinutes) * 60, stages: stageDates } : {}),
    };
    const res = await fetch(form.id ? `/api/admin/tournaments/${form.id}` : "/api/admin/tournaments", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setFeedback({ ok: false, text: data.error ?? "Não foi possível salvar." });
    setFeedback({ ok: true, text: form.id ? "Torneio atualizado." : "Torneio criado! Os jogadores já podem se inscrever em Torneios." });
    setForm(null);
    load();
  }

  async function finalize(t: TournamentRow) {
    if (!confirm(`Finalizar "${t.name}"? As colocações, os troféus e os prêmios serão entregues e o resultado vai para o Jornal.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/tournaments/${t.id}`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível finalizar." });
    load();
  }

  async function cancel(t: TournamentRow) {
    if (!confirm(`Cancelar "${t.name}"? Ninguém recebe troféu ou prêmio.`)) return;
    const res = await fetch(`/api/admin/tournaments/${t.id}`, { method: "DELETE" });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível cancelar." });
    load();
  }

  const stageInput = (t: TournamentRow, key: StageKey) => {
    const st = t.stages.find((x) => x.key === key);
    return st ? toBrtInput(st.startsAt) : "";
  };
  const edit = (t: TournamentRow) =>
    setForm({
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      type: t.type,
      format: t.format,
      startsAt: toBrtInput(t.startsAt),
      endsAt: toBrtInput(t.endsAt),
      prizes: t.prizes.length > 0 ? t.prizes : emptyForm().prizes,
      structure: t.structure,
      maxEntrants: t.maxEntrants ?? 16,
      clockMinutes: Math.round(t.clockSeconds / 60),
      stages: { A: stageInput(t, "A"), B: stageInput(t, "B"), final: stageInput(t, "final") },
    });

  const setPrize = (i: number, rewards: Reward[]) => form && setForm({ ...form, prizes: form.prizes.map((p, j) => (j === i ? { ...p, rewards } : p)) });
  const missingStages = form?.structure === "bracket" && STAGE_KEYS.some((k) => !form.stages[k]);

  return (
    <div className="flex flex-col gap-5">
      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {feedback.text}
        </p>
      )}

      {!form ? (
        <button onClick={() => setForm(emptyForm())} className="flex w-fit items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400">
          <Plus className="h-4 w-4" /> Lançar torneio
        </button>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-zinc-100">{form.id ? "Editar torneio" : "Novo torneio"}</h2>
            <button onClick={() => setForm(null)} className="text-zinc-400 hover:text-zinc-200" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome (ex.: Copa do Faraó · Outubro)" className={input} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição curta (opcional)" rows={2} className={input} />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500">Formato:</span>
            <button disabled={Boolean(form.id)} onClick={() => setForm({ ...form, structure: "points" })} className={chip(form.structure === "points")}>
              Pontos (sala do torneio)
            </button>
            <button disabled={Boolean(form.id)} onClick={() => setForm({ ...form, structure: "bracket" })} className={chip(form.structure === "bracket")}>
              Chaves (melhor de 3)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500">Tipo:</span>
            <button onClick={() => setForm({ ...form, type: "official" })} className={chip(form.type === "official")}>
              Oficial
            </button>
            <button onClick={() => setForm({ ...form, type: "quick" })} className={chip(form.type === "quick")}>
              Rápido
            </button>
            <span className="ml-3 text-xs font-semibold uppercase text-zinc-500">Banlist:</span>
            {/* Banlist de uma sala ou a própria do torneio (crie na aba Banlists) */}
            {banlists.map((b) => (
              <button key={b.id} onClick={() => setForm({ ...form, format: b.id })} className={chip(form.format === b.id)}>
                {b.kind === "room" ? b.name.replace(/^Sala /, "") : b.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">A pontuação de cada tipo (oficial ou rápido) é definida na aba Season.</p>

          {form.structure === "bracket" ? (
            <>
              <p className="text-xs text-zinc-500">
                Inscrição até encher as vagas. Depois você sorteia as chaves e ativa (em &quot;Chaves&quot;, na lista abaixo). A Chave A e a Chave B rodam cada uma no seu horário; os campeões se
                enfrentam na Final. Horário de Brasília.
              </p>
              <div className="grid gap-2 sm:grid-cols-5">
                {STAGE_KEYS.map((key) => (
                  <label key={key} className="flex flex-col gap-1 text-xs text-zinc-500">
                    {stageLabel(key)}
                    <input type="datetime-local" value={form.stages[key]} onChange={(e) => setForm({ ...form, stages: { ...form.stages, [key]: e.target.value } })} className={input} />
                  </label>
                ))}
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Vagas
                  <input type="number" min={2} value={form.maxEntrants} onChange={(e) => setForm({ ...form, maxEntrants: Number(e.target.value) })} className={input} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Tempo do jogador (min)
                  <input type="number" min={1} max={60} value={form.clockMinutes} onChange={(e) => setForm({ ...form, clockMinutes: Number(e.target.value) })} className={input} />
                </label>
              </div>
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                Início dos duelos (Brasília)
                <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={input} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                Fim dos duelos (Brasília)
                <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={input} />
              </label>
            </div>
          )}

          <h3 className="mt-2 text-sm font-bold text-zinc-200">Premiação</h3>
          {form.structure === "bracket" && <p className="-mt-2 text-xs text-zinc-500">Nas chaves: 1º = campeão da Final, 2º = vice, 3º = quem perdeu a decisão de cada chave (os dois recebem).</p>}
          {form.prizes.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between">
                <strong className="text-sm text-amber-200">{p.placement}º lugar</strong>
                {form.prizes.length > 1 && (
                  <button onClick={() => setForm({ ...form, prizes: form.prizes.filter((_, j) => j !== i) })} className="text-xs text-zinc-500 hover:text-red-300">
                    remover colocação
                  </button>
                )}
              </div>
              <RewardList rewards={p.rewards} options={options} onRemove={(r) => setPrize(i, p.rewards.filter((_, j) => j !== r))} />
              <RewardEditor options={options} onAdd={(r) => setPrize(i, [...p.rewards, r])} />
            </div>
          ))}
          <button
            onClick={() => setForm({ ...form, prizes: [...form.prizes, { placement: form.prizes.length + 1, rewards: [] }] })}
            className="w-fit text-xs font-semibold text-amber-300 hover:underline"
          >
            + mais uma colocação
          </button>

          <button onClick={save} disabled={busy || form.name.trim().length < 3 || missingStages} className="flex w-fit items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40">
            <Save className="h-4 w-4" /> {form.id ? "Salvar alterações" : "Criar torneio"}
          </button>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 font-bold text-zinc-100">Torneios</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum torneio ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-800/70">
            {rows.map((t) => {
              const open = t.phase !== "finished" && t.phase !== "cancelled";
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-100">
                      {t.name}{" "}
                      <span className="ml-1 text-xs text-zinc-500">
                        {t.type === "official" ? "Oficial" : "Rápido"} · {t.structure === "bracket" ? "Chaves" : "Pontos"}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      <span className={PHASE[t.phase].className}>{PHASE[t.phase].label}</span> · {when(t.startsAt)} → {when(t.endsAt)} · {t._count.entries}
                      {t.structure === "bracket" && t.maxEntrants ? `/${t.maxEntrants}` : ""} inscritos · {t._count.matches} duelos
                    </p>
                  </div>
                  {open && (
                    <button onClick={() => edit(t)} className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                  )}
                  {t.structure === "bracket" && open && (
                    <button onClick={() => setManaging(managing === t.id ? null : t.id)} className="flex items-center gap-1 rounded-md border border-amber-500/50 px-2 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/10">
                      <GitBranch className="h-3 w-3" /> {managing === t.id ? "Fechar chaves" : "Chaves"}
                    </button>
                  )}
                  {t.phase === "ended" && t.structure !== "bracket" && (
                    <button onClick={() => finalize(t)} disabled={busy} className="flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-40">
                      <Flag className="h-3 w-3" /> Finalizar e premiar
                    </button>
                  )}
                  {(t.phase === "scheduled" || t.phase === "running") && (
                    <button onClick={() => cancel(t)} className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">
                      Cancelar
                    </button>
                  )}
                  {managing === t.id && (
                    <div className="w-full">
                      <BracketManager tournament={t} onChanged={load} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
