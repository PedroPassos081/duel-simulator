"use client";

import { useCallback, useEffect, useState } from "react";
import { Pause, Play, Rocket, Save, Shuffle } from "lucide-react";
import { BracketView, type BracketData } from "@/components/BracketView";
import { fromBrtInput, toBrtInput } from "@/lib/brt";

export interface BracketTournament {
  id: string;
  name: string;
  maxEntrants: number | null;
  clockSeconds: number;
  activatedAt: string | null;
  pausedAt: string | null;
  stages: { key: string; startsAt: string }[];
  _count: { entries: number; series: number };
}

const input = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none";
const STAGES = [
  { key: "A", label: "Chave A" },
  { key: "B", label: "Chave B" },
  { key: "final", label: "Final" },
];

/** Torneio em chaves: vagas, horários, sorteio, ativar e pausar, e as chaves ao vivo. */
export function BracketManager({ tournament, onChanged }: { tournament: BracketTournament; onChanged: () => void }) {
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [settings, setSettings] = useState(() => ({
    maxEntrants: tournament.maxEntrants ?? 16,
    clockMinutes: Math.round(tournament.clockSeconds / 60),
    stages: Object.fromEntries(STAGES.map((s) => [s.key, tournament.stages.find((x) => x.key === s.key)?.startsAt ? toBrtInput(tournament.stages.find((x) => x.key === s.key)!.startsAt) : ""])) as Record<string, string>,
  }));
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/tournaments/${tournament.id}/bracket`);
    if (res.ok) setBracket(await res.json());
  }, [tournament.id]);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(body: object, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setFeedback(null);
    const res = await fetch(`/api/admin/tournaments/${tournament.id}/bracket`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível salvar." });
    if (res.ok) {
      load();
      onChanged();
    }
  }

  const drawn = tournament._count.series > 0 || (bracket?.series.length ?? 0) > 0;
  const status = tournament.pausedAt ? "Pausado" : tournament.activatedAt ? "Ativo" : drawn ? "Chaves sorteadas (falta ativar)" : "Inscrições abertas";

  return (
    <div className="mt-3 flex flex-col gap-4 rounded-xl border border-amber-500/30 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold text-zinc-100">{tournament.name}</span>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] font-bold text-zinc-300">{status}</span>
        <span className="text-xs text-zinc-400">
          {tournament._count.entries}/{tournament.maxEntrants ?? "∞"} inscritos
        </span>
      </div>

      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{feedback.text}</p>
      )}

      {/* HORÁRIOS, VAGAS E TEMPO */}
      <div className="grid gap-2 sm:grid-cols-5">
        {STAGES.map((s) => (
          <label key={s.key} className="flex flex-col gap-1 text-xs text-zinc-500">
            {s.label} (Brasília)
            <input type="datetime-local" value={settings.stages[s.key]} onChange={(e) => setSettings({ ...settings, stages: { ...settings.stages, [s.key]: e.target.value } })} className={input} />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Vagas
          <input type="number" min={2} value={settings.maxEntrants} onChange={(e) => setSettings({ ...settings, maxEntrants: Number(e.target.value) })} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Tempo do jogador (min)
          <input type="number" min={1} max={60} value={settings.clockMinutes} onChange={(e) => setSettings({ ...settings, clockMinutes: Number(e.target.value) })} className={input} />
        </label>
      </div>
      <p className="text-[11px] text-zinc-500">
        Tempo do jogador: quanto ele tem para entrar em cada duelo depois da tela de espera de 5 min; ao zerar, perde aquele duelo por W.O. Para pular um dia, pause e mude o horário.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy || STAGES.some((s) => !settings.stages[s.key])}
          onClick={() =>
            act({
              action: "settings",
              maxEntrants: settings.maxEntrants,
              clockSeconds: Math.max(1, settings.clockMinutes) * 60,
              stages: STAGES.map((s) => ({ key: s.key, startsAt: fromBrtInput(settings.stages[s.key]) })),
            })
          }
          className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" /> Salvar horários e vagas
        </button>
        {!tournament.activatedAt && (
          <button
            disabled={busy || tournament._count.entries < 2}
            onClick={() => act({ action: "generate" }, drawn ? "Sortear as chaves de novo? O sorteio atual é descartado." : "Sortear as chaves agora? As inscrições fecham.")}
            className="flex items-center gap-1 rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/10 disabled:opacity-40"
          >
            <Shuffle className="h-3.5 w-3.5" /> {drawn ? "Sortear de novo" : "Sortear chaves"}
          </button>
        )}
        {drawn && !tournament.activatedAt && (
          <button
            disabled={busy}
            onClick={() => act({ action: "activate" }, "Ativar o torneio? Cada chave começa sozinha no horário marcado.")}
            className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-40"
          >
            <Rocket className="h-3.5 w-3.5" /> Ativar torneio
          </button>
        )}
        {tournament.activatedAt &&
          (tournament.pausedAt ? (
            <button disabled={busy} onClick={() => act({ action: "resume" })} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-40">
              <Play className="h-3.5 w-3.5" /> Retomar
            </button>
          ) : (
            <button disabled={busy} onClick={() => act({ action: "pause" }, "Pausar? Nenhum confronto novo começa até você retomar.")} className="flex items-center gap-1 rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">
              <Pause className="h-3.5 w-3.5" /> Pausar
            </button>
          ))}
      </div>

      {bracket && <BracketView data={bracket} />}
    </div>
  );
}
