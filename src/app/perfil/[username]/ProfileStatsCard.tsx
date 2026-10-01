"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProfileStats } from "@/lib/rankings";

const TABS = { all: "Geral", season: "Season", week: "Semana" } as const;

/** Ficha resumida do perfil: uma aba por período, os mesmos 5 números em cada. */
export function ProfileStatsCard({ stats }: { stats: ProfileStats[] }) {
  const [period, setPeriod] = useState<ProfileStats["period"]>("all");
  const s = stats.find((x) => x.period === period) ?? stats[0];
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  return (
    <section className="mb-6 rounded-xl border border-amber-500/20 bg-zinc-900/60 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          {stats.map((x) => (
            <button
              key={x.period}
              onClick={() => setPeriod(x.period)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                period === x.period ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {TABS[x.period]}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">{s.label}</span>
      </div>

      {s.unavailable ? (
        <p className="py-6 text-center text-sm text-zinc-500">Nenhuma season acontecendo agora.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={s.position ? `#${s.position}` : "—"} label="posição" highlight />
            <Stat value={String(s.points)} label="pontos" />
            <Stat value={signed(s.score)} label="score" />
          </div>
          <p className="mt-3 text-center text-sm text-zinc-300">
            <strong className="text-emerald-300">{s.wins}</strong> vitórias <span className="mx-1 text-zinc-600">·</span>
            <strong className="text-red-300">{s.losses}</strong> derrotas
          </p>
          <p className="mt-2 text-center text-[11px] text-zinc-500">
            {s.position ? `Posição no ranking de pontos entre ${s.players} duelistas. ` : "Ainda sem pontos neste período. "}
            <Link href={`/ranking?cat=points&period=${s.period}`} className="text-amber-400 hover:underline">
              Ver ranking
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-3 ${highlight ? "border-amber-500/40 bg-amber-500/10" : "border-zinc-800 bg-zinc-950/60"}`}>
      <p className={`text-2xl font-black tabular-nums ${highlight ? "text-amber-300" : "text-zinc-100"}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );
}
