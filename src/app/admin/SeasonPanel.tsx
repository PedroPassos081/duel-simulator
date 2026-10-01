"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, Save, Trash2 } from "lucide-react";
import { GoldIcon } from "@/components/theme/CurrencyIcons";
import { MATCH_KIND_LABELS, type MatchKind, type MatchScoring } from "@/lib/match-scoring";
import { brtDate, brtParts, formatBrt, monthRange, WEEKDAYS, type WeekSchedule } from "@/lib/brt";
import { RewardEditor, RewardList, type Reward, type RewardOptions } from "./RewardEditor";

const OUTCOMES = [
  ["win", "Vitória"],
  ["loss", "Derrota"],
  ["draw", "Empate"],
] as const;
const KINDS: MatchKind[] = ["random", "official", "quick"];
const PLACES = [1, 2, 3];
const input = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm font-semibold text-zinc-100 focus:border-sky-500/60 focus:outline-none";
const chip = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-xs font-semibold ${active ? "border-sky-500 bg-sky-500/10 text-sky-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`;
const pad = (n: number) => String(n).padStart(2, "0");

// Datas do Admin sempre no horário de Brasília (o mesmo em que a semana e a season viram)
function toBrtInput(value: string | Date) {
  const p = brtParts(new Date(value));
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
const fromBrtInput = (value: string) => new Date(`${value}:00-03:00`);

type PeriodKind = "week" | "season";
type Tier = { placement: number; rewards: Reward[] };
type Prizes = Record<PeriodKind, Tier[]>;

interface Season {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  closed: boolean;
}

function nextMonthSeason() {
  const now = brtParts(new Date());
  const range = monthRange(brtDate(now.year, now.month + 1, 1));
  return { name: `Season ${range.name}`, startsAt: toBrtInput(range.start), endsAt: toBrtInput(range.end) };
}

function Feedback({ value }: { value: { ok: boolean; text: string } | null }) {
  if (!value) return null;
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${value.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{value.text}</p>
  );
}

/** Aba Season: pontos por duelo, gold do Random, virada da semana, seasons e prêmios de quem vence. */
export function SeasonPanel({ cosmetics = [] }: { cosmetics?: { id: string; name: string; type: string }[] }) {
  const [scoring, setScoring] = useState<MatchScoring | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [week, setWeek] = useState<WeekSchedule>({ weekday: 1, hour: 0, minute: 0 });
  const [currentWeek, setCurrentWeek] = useState<{ start: string; end: string } | null>(null);
  const [prizes, setPrizes] = useState<Prizes>({ week: [], season: [] });
  const [prizeTab, setPrizeTab] = useState<PeriodKind>("week");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [edits, setEdits] = useState<Record<string, { name: string; startsAt: string; endsAt: string }>>({});
  const [draft, setDraft] = useState(nextMonthSeason);
  const [options, setOptions] = useState<RewardOptions>({ cosmetics, structures: [] });
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/season");
    if (!res.ok) return;
    const data = await res.json();
    setScoring(data.scoring);
    setEnabled(data.enabled);
    setWeek(data.week);
    setCurrentWeek(data.currentWeek);
    setSeasons(data.seasons);
    setEdits({});
    const byPlace = (tiers: Tier[]) => PLACES.map((placement) => tiers.find((t) => t.placement === placement) ?? { placement, rewards: [] });
    setPrizes({ week: byPlace(data.prizes.week), season: byPlace(data.prizes.season) });
  }, []);
  useEffect(() => {
    load();
    fetch("/api/admin/options")
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => o && setOptions({ cosmetics, structures: o.structures }))
      .catch(() => {});
  }, [load, cosmetics]);

  async function save(body: object, ok: string) {
    setFeedback(null);
    const res = await fetch("/api/admin/season", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: res.ok ? ok : data.error ?? "Não foi possível salvar." });
    // Só atualiza a semana atual (sem perder o que ainda não foi salvo nas outras partes)
    if (res.ok && "week" in body) {
      const fresh = await fetch("/api/admin/season").then((r) => (r.ok ? r.json() : null));
      if (fresh) setCurrentWeek(fresh.currentWeek);
    }
    return res.ok;
  }

  async function seasonRequest(url: string, method: string, body: object | null, ok: string) {
    setFeedback(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: res.ok ? ok : data.error ?? "Não foi possível salvar." });
    if (res.ok) load();
    return res.ok;
  }

  async function createSeason() {
    const ok = await seasonRequest("/api/admin/season", "POST", { name: draft.name, startsAt: fromBrtInput(draft.startsAt), endsAt: fromBrtInput(draft.endsAt) }, `Season "${draft.name}" criada.`);
    if (ok) setDraft(nextMonthSeason());
  }

  if (!scoring) return <p className="text-sm text-zinc-400">Carregando...</p>;

  const setPoint = (kind: MatchKind, outcome: "win" | "loss" | "draw", value: string) =>
    setScoring({ ...scoring, points: { ...scoring.points, [kind]: { ...scoring.points[kind], [outcome]: Number(value) } } });
  const setTier = (placement: number, rewards: Reward[]) =>
    setPrizes({ ...prizes, [prizeTab]: prizes[prizeTab].map((t) => (t.placement === placement ? { ...t, rewards } : t)) });
  const now = Date.now();

  return (
    <div className="flex flex-col gap-5">
      <Feedback value={feedback} />

      {/* Season e Semanal */}
      <section className="rounded-xl border border-sky-500/30 bg-zinc-900/60 p-5">
        <h2 className="flex items-center gap-2 font-bold text-zinc-100">
          <CalendarClock className="h-5 w-5 text-sky-300" /> Season e Semanal
        </h2>
        <div className={`my-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${enabled ? "border-emerald-500/40 bg-emerald-500/10" : "border-zinc-700 bg-zinc-950/60"}`}>
          <div>
            <p className={`text-sm font-bold ${enabled ? "text-emerald-300" : "text-zinc-300"}`}>{enabled ? "Ativada" : "Desativada"}</p>
            <p className="text-xs text-zinc-500">
              {enabled ? "No fim de cada semana e season, os vencedores recebem troféu e prêmio." : "Ninguém recebe troféu ou prêmio. Ative no lançamento do jogo."}
            </p>
          </div>
          <button
            onClick={() => {
              const next = !enabled;
              if (next && !confirm("Ativar a Season e o Semanal? A partir de agora, quem vencer recebe troféu e prêmio.")) return;
              save({ enabled: next }, next ? "Season e Semanal ativadas." : "Season e Semanal desativadas.").then((ok) => ok && setEnabled(next));
            }}
            role="switch"
            aria-checked={enabled}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        <p className="mb-4 text-sm text-zinc-400">
          Quem fizer mais pontos vence. Ao terminar, o top 3 ganha troféu, os prêmios abaixo são entregues e o resultado sai no Jornal. Horário de Brasília.
        </p>

        <h3 className="text-sm font-bold text-zinc-200">Semanal</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          Começa e termina toda
          <select value={week.weekday} onChange={(e) => setWeek({ ...week, weekday: Number(e.target.value) })} className={`${input} w-auto`}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          às
          <input
            type="time"
            value={`${pad(week.hour)}:${pad(week.minute)}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (Number.isInteger(h) && Number.isInteger(m)) setWeek({ ...week, hour: h, minute: m });
            }}
            className={`${input} w-auto`}
          />
          <button onClick={() => save({ week }, "Virada da semana salva.")} className="flex items-center gap-1.5 rounded-lg border border-sky-500/50 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/10">
            <Save className="h-3.5 w-3.5" /> Salvar
          </button>
        </div>
        {currentWeek && (
          <p className="mt-1.5 text-xs text-zinc-500">
            Semana atual: {formatBrt(new Date(currentWeek.start), true)} → {formatBrt(new Date(currentWeek.end), true)}
          </p>
        )}

        <h3 className="mt-5 text-sm font-bold text-zinc-200">Prêmios de quem vence</h3>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setPrizeTab("week")} className={chip(prizeTab === "week")}>
            Semanal
          </button>
          <button onClick={() => setPrizeTab("season")} className={chip(prizeTab === "season")}>
            Season
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {prizes[prizeTab].map((tier) => (
            <div key={tier.placement} className="flex flex-col gap-2">
              <p className="text-xs font-bold text-amber-200">{tier.placement}º lugar</p>
              <RewardList rewards={tier.rewards} options={options} onRemove={(i) => setTier(tier.placement, tier.rewards.filter((_, j) => j !== i))} />
              <RewardEditor options={options} onAdd={(r) => setTier(tier.placement, [...tier.rewards, r])} />
            </div>
          ))}
        </div>
        <button
          onClick={() => save({ prizes: { week: prizes.week.filter((t) => t.rewards.length), season: prizes.season.filter((t) => t.rewards.length) } }, "Prêmios salvos.")}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-black hover:bg-sky-400"
        >
          <Save className="h-4 w-4" /> Salvar prêmios
        </button>
      </section>

      {/* Seasons */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="font-bold text-zinc-100">Seasons</h2>
        <p className="mb-4 text-sm text-zinc-400">Todo mês uma season começa sozinha (dia 1 às 00:00 até o fim do mês). Ajuste o dia e o horário quando quiser.</p>
        <ul className="flex flex-col gap-2">
          {seasons.map((s) => {
            const running = new Date(s.startsAt).getTime() <= now && now < new Date(s.endsAt).getTime();
            const future = new Date(s.startsAt).getTime() > now;
            const edit = edits[s.id] ?? { name: s.name, startsAt: toBrtInput(s.startsAt), endsAt: toBrtInput(s.endsAt) };
            const setEdit = (patch: Partial<typeof edit>) => setEdits({ ...edits, [s.id]: { ...edit, ...patch } });
            const locked = s.closed || (!running && !future);
            return (
              <li key={s.id} className="grid items-center gap-2 rounded-lg border border-zinc-800 p-2 sm:grid-cols-[1fr_180px_180px_auto]">
                <div className="flex items-center gap-2">
                  <input value={edit.name} disabled={locked} onChange={(e) => setEdit({ name: e.target.value })} className={input} />
                  {running && <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 text-[11px] font-bold text-emerald-300">agora</span>}
                  {future && <span className="shrink-0 rounded bg-sky-500/20 px-1.5 text-[11px] font-bold text-sky-300">próxima</span>}
                  {locked && <span className="shrink-0 rounded bg-zinc-700/60 px-1.5 text-[11px] font-bold text-zinc-300">encerrada</span>}
                </div>
                <input type="datetime-local" value={edit.startsAt} disabled={locked || running} onChange={(e) => setEdit({ startsAt: e.target.value })} className={input} title="Início" />
                <input type="datetime-local" value={edit.endsAt} disabled={locked} onChange={(e) => setEdit({ endsAt: e.target.value })} className={input} title="Fim" />
                <div className="flex gap-1.5">
                  {!locked && (
                    <button
                      onClick={() => seasonRequest(`/api/admin/season/${s.id}`, "PUT", { name: edit.name, startsAt: fromBrtInput(edit.startsAt), endsAt: fromBrtInput(edit.endsAt) }, "Season atualizada.")}
                      disabled={!edits[s.id]}
                      className="rounded-lg border border-sky-500/50 p-1.5 text-sky-300 hover:bg-sky-500/10 disabled:opacity-30"
                      aria-label="Salvar"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  )}
                  {future && (
                    <button
                      onClick={() => confirm(`Apagar "${s.name}"?`) && seasonRequest(`/api/admin/season/${s.id}`, "DELETE", null, "Season apagada.")}
                      className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:text-red-300"
                      aria-label="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Agendar próxima season</p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-[1fr_180px_180px_auto]">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome" className={input} />
          <input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} className={input} title="Início" />
          <input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} className={input} title="Fim" />
          <button
            onClick={createSeason}
            disabled={!draft.name || !draft.startsAt || !draft.endsAt}
            className="flex items-center justify-center gap-1 rounded-lg border border-sky-500/50 px-3 py-1.5 text-sm font-bold text-sky-300 hover:bg-sky-500/10 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Criar
          </button>
        </div>
      </section>

      {/* Pontos por duelo */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="font-bold text-zinc-100">Pontos por duelo</h2>
        <p className="mb-4 text-sm text-zinc-400">Quanto cada resultado vale no ranking de Pontos. Use número negativo para tirar pontos (ex.: -2).</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="pb-2 font-semibold">Tipo de duelo</th>
                {OUTCOMES.map(([, label]) => (
                  <th key={label} className="pb-2 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KINDS.map((kind) => (
                <tr key={kind}>
                  <td className="py-1 pr-3 text-zinc-300">{MATCH_KIND_LABELS[kind]}</td>
                  {OUTCOMES.map(([outcome]) => (
                    <td key={outcome} className="py-1 pr-2">
                      <input type="number" value={scoring.points[kind][outcome]} onChange={(e) => setPoint(kind, outcome, e.target.value)} className={input} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-5 flex items-center gap-1.5 text-sm font-bold text-zinc-200">
          <GoldIcon className="h-4 w-4 text-amber-400" /> Gold por duelo no Random
        </h3>
        <p className="mb-2 text-xs text-zinc-500">Os eventos de gold somam um bônus em cima destes valores. VIP ganha +30% (aqui e nos torneios).</p>
        <div className="grid grid-cols-3 gap-2">
          {OUTCOMES.map(([outcome, label]) => (
            <label key={outcome} className="flex flex-col gap-1 text-xs text-zinc-500">
              {label}
              <input
                type="number"
                min={0}
                value={scoring.gold[outcome]}
                onChange={(e) => setScoring({ ...scoring, gold: { ...scoring.gold, [outcome]: Number(e.target.value) } })}
                className={input}
              />
            </label>
          ))}
        </div>

        <h3 className="mt-5 flex items-center gap-1.5 text-sm font-bold text-zinc-200">
          <GoldIcon className="h-4 w-4 text-amber-400" /> Gold por duelo de torneio
        </h3>
        <p className="mb-2 text-xs text-zinc-500">Vale para torneios oficiais e rápidos (pontos e chaves), além dos prêmios do torneio.</p>
        <div className="grid grid-cols-3 gap-2">
          {OUTCOMES.map(([outcome, label]) => (
            <label key={outcome} className="flex flex-col gap-1 text-xs text-zinc-500">
              {label}
              <input
                type="number"
                min={0}
                value={scoring.tournamentGold[outcome]}
                onChange={(e) => setScoring({ ...scoring, tournamentGold: { ...scoring.tournamentGold, [outcome]: Number(e.target.value) } })}
                className={input}
              />
            </label>
          ))}
        </div>
        <button onClick={() => save({ scoring }, "Pontuação salva. Vale para os próximos duelos.")} className="mt-4 flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-black hover:bg-sky-400">
          <Save className="h-4 w-4" /> Salvar pontuação
        </button>
      </section>
    </div>
  );
}
