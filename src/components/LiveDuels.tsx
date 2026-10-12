"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Heart, Radio, Trophy, Dices } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { SpectatorView } from "@/components/SpectatorView";

interface LiveDuel {
  id: string;
  kind: "random" | "tournament";
  text: string;
  status: string;
  turn: number;
  players: {
    userId: string;
    avatar: { image: string | null; name: string | null; frameUrl: string | null };
    playerName: { name: string | null; effect: string | null; profile: string | null };
    lifePoints: number;
  }[];
}

const POLL_MS = 10_000;

/** Duelos ao vivo (Random e torneios): quem está duelando, e um clique para assistir. */
export function LiveDuels() {
  const [duels, setDuels] = useState<LiveDuel[] | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current || document.visibilityState !== "visible") return;
    busy.current = true;
    try {
      const res = await fetch("/api/watch", { cache: "no-store" });
      if (res.ok) setDuels(await res.json());
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    // Link direto para assistir (ex.: "assistir" nas chaves do torneio)
    const id = new URLSearchParams(window.location.search).get("assistir");
    if (id) setWatching(id);
    return () => clearInterval(t);
  }, [load]);

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-300">
        <Radio className="h-4 w-4 text-rose-400" /> Duelos ao vivo
        {duels && duels.length > 0 && <span className="rounded-full bg-rose-500/20 px-1.5 text-[11px] text-rose-300">{duels.length}</span>}
      </h2>
      {duels === null ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : duels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">Ninguém está duelando agora.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {duels.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setWatching(d.id)}
                className="flex w-full flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-left transition hover:border-emerald-500/50 hover:bg-zinc-900"
              >
                <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${d.kind === "tournament" ? "text-amber-300" : "text-sky-300"}`}>
                  {d.kind === "tournament" ? <Trophy className="h-3.5 w-3.5" /> : <Dices className="h-3.5 w-3.5" />}
                  <span className="truncate">{d.text}</span>
                  <span className="ml-auto shrink-0 font-normal normal-case text-zinc-500">{d.status === "active" ? `turno ${d.turn}` : "começando"}</span>
                </span>
                <span className="flex items-center gap-2">
                  {d.players.map((p, i) => (
                    <span key={p.userId} className={`flex min-w-0 flex-1 items-center gap-1.5 ${i === 1 ? "flex-row-reverse text-right" : ""}`}>
                      <Avatar {...p.avatar} size={26} />
                      <span className="min-w-0">
                        <PlayerName {...p.playerName} link={false} className="block truncate text-xs font-semibold" />
                        <span className="flex items-center gap-0.5 text-[11px] font-mono text-rose-300">
                          <Heart className="h-3 w-3" /> {p.lifePoints}
                        </span>
                      </span>
                    </span>
                  ))}
                </span>
                <span className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 py-1 text-xs font-bold text-emerald-300">
                  <Eye className="h-3.5 w-3.5" /> Assistir
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {watching && <SpectatorView matchId={watching} onClose={() => setWatching(null)} />}
    </section>
  );
}
