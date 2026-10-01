"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame, Lock, ScrollText, Target, Timer } from "lucide-react";
import { ArtBanner } from "@/components/theme/ArtBanner";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { MillenniumPyramid } from "@/components/theme/EgyptIcons";
import { ART } from "@/lib/card-art";

interface Item {
  key: string;
  title: string;
  goal: number;
  progress: number;
  gold: number;
  cash: number;
  xp: number;
  reward: string;
  claimed: boolean;
}
interface Data {
  resetsAt: string;
  today: { played: number; wins: number };
  daily: Item[];
  extra: Item[];
  missions: Item[];
}

type Tab = "daily" | "missions";

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

/** Desafios diários (renovam à meia-noite) e Missões da conta (uma vez só). */
export default function ChallengesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("daily");
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/challenges", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function claim(item: Item) {
    setBusy(item.key);
    setFeedback(null);
    const res = await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: item.key }) });
    const json = await res.json();
    setBusy(null);
    setFeedback({ ok: res.ok, text: res.ok ? json.message : json.error ?? "Não foi possível resgatar." });
    if (res.ok) {
      load();
      router.refresh(); // saldo no topo
    }
  }

  const row = (item: Item, mission = false) => {
    const done = item.progress >= item.goal;
    const pct = Math.round((item.progress / item.goal) * 100);
    return (
      <li
        key={item.key}
        className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition ${
          item.claimed ? "border-emerald-500/30 bg-emerald-500/5" : done ? "border-amber-400/60 bg-amber-500/10 shadow-[0_0_16px_rgba(251,191,36,0.25)]" : "border-zinc-800 bg-zinc-900/60"
        }`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${mission ? "bg-purple-500/15 text-purple-300" : "bg-amber-500/15 text-amber-300"}`}>
          {mission ? <MillenniumPyramid className="h-5 w-5" /> : <Target className="h-5 w-5" />}
        </span>
        <div className="min-w-[180px] flex-1">
          <p className="flex items-center justify-between gap-2 text-sm font-semibold text-zinc-100">
            {item.title}
            <span className="font-mono text-xs text-zinc-400">
              {item.progress.toLocaleString("pt-BR")}/{item.goal.toLocaleString("pt-BR")}
            </span>
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full rounded-full ${done ? "bg-gradient-to-r from-amber-500 to-yellow-200" : "bg-gradient-to-r from-amber-700 to-amber-400"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 flex items-center gap-2 text-xs text-zinc-300">
            <span className="flex items-center gap-1 font-bold text-amber-300">
              <GoldIcon className="h-3.5 w-3.5" /> {item.gold.toLocaleString("pt-BR")}
            </span>
            {item.cash > 0 && (
              <span className="flex items-center gap-1 font-bold text-purple-300">
                <CreditIcon className="h-3.5 w-3.5" /> {item.cash}
              </span>
            )}
            {item.xp > 0 && <span className="rounded bg-amber-500/15 px-1.5 text-[11px] font-black text-amber-200">+{item.xp} XP do passe</span>}
          </p>
        </div>
        {item.claimed ? (
          <span className="flex w-28 items-center justify-center gap-1 text-sm font-bold text-emerald-400">
            <Check className="h-4 w-4" /> Resgatado
          </span>
        ) : (
          <button
            disabled={!done || busy !== null}
            onClick={() => claim(item)}
            className="flex w-28 items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-2 text-sm font-black text-black hover:brightness-110 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500"
          >
            {done ? (busy === item.key ? "..." : "Resgatar") : (
              <>
                <Lock className="h-3.5 w-3.5" /> {pct}%
              </>
            )}
          </button>
        )}
      </li>
    );
  };

  return (
    <GlassPanel className="max-w-4xl">
      <ArtBanner
        art={ART.timeWizard}
        eyebrow="Provas do Faraó"
        title={
          <span className="flex items-center gap-2">
            <Target className="h-7 w-7 text-amber-300" /> Desafios
          </span>
        }
        subtitle="Desafios do dia renovam à meia-noite (Brasília). As missões acompanham a sua conta: cada uma rende uma vez só."
        tone="gold"
        position="center 30%"
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:w-fit">
        {(
          [
            ["daily", "Desafios diários", Flame],
            ["missions", "Missões", ScrollText],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${
              tab === id ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {feedback && (
        <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{feedback.text}</p>
      )}

      {!data ? (
        <p className="text-sm text-zinc-400">Carregando...</p>
      ) : tab === "daily" ? (
        <div className="flex flex-col gap-5">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
            <span className="flex items-center gap-1">
              <Timer className="h-4 w-4" /> Renovam em {timeLeft(data.resetsAt)}
            </span>
            <span>
              Hoje: <strong className="text-zinc-200">{data.today.played}</strong> duelos · <strong className="text-zinc-200">{data.today.wins}</strong> vitórias
            </span>
          </p>
          <ul className="flex flex-col gap-2">{data.daily.map((i) => row(i))}</ul>
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-rose-300">
              <Flame className="h-4 w-4" /> Missões extras do dia
            </h2>
            <ul className="flex flex-col gap-2">{data.extra.map((i) => row(i))}</ul>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">{data.missions.map((i) => row(i, true))}</ul>
      )}
    </GlassPanel>
  );
}
