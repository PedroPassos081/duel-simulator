"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, GitBranch, Swords, Trophy, Users } from "lucide-react";
import { BracketView, type BracketData } from "@/components/BracketView";
import { alertMatchFound, askNotificationPermission, unlockAlerts } from "@/lib/duel-alerts";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { ArtBanner } from "@/components/theme/ArtBanner";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { MillenniumPyramid } from "@/components/theme/EgyptIcons";
import { ART } from "@/lib/card-art";

type Phase = "scheduled" | "running" | "ended" | "finished" | "cancelled";

interface TournamentCard {
  id: string;
  name: string;
  description: string | null;
  type: "official" | "quick";
  format: string;
  banlistName?: string;
  startsAt: string;
  endsAt: string;
  phase: Phase;
  entrants: number;
  joined: boolean;
  prizes: { placement: number; labels: string[] }[];
  // Chaves (melhor de 3)
  structure: "points" | "bracket";
  maxEntrants: number | null;
  stages: { key: string; name: string; startsAt: string }[];
  drawn: boolean;
  activated: boolean;
  paused: boolean;
}

interface Standing {
  userId: string;
  position: number;
  points: number;
  wins: number;
  losses: number;
  avatar: { image: string | null; name: string | null; frameUrl: string | null };
  playerName: { name: string | null; effect: string | null; profile: string | null };
}

type Queue = { status: "idle" } | { status: "waiting"; since: string } | { status: "matched"; matchId: string };

const TYPE = {
  official: { label: "Oficial", badge: "border-amber-400/50 bg-amber-500/15 text-amber-200" },
  quick: { label: "Rápido", badge: "border-sky-400/50 bg-sky-500/15 text-sky-200" },
};
const PHASE: Record<Phase, string> = {
  scheduled: "Em breve",
  running: "Acontecendo agora",
  ended: "Aguardando resultado",
  finished: "Finalizado",
  cancelled: "Cancelado",
};
const when = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function TournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentCard[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [queue, setQueue] = useState<Queue>({ status: "idle" });
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/tournaments");
    if (res.ok) setTournaments(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Classificação do torneio aberto (atualiza sozinha)
  useEffect(() => {
    if (!open) return;
    const fetchStandings = async () => {
      const res = await fetch(`/api/tournaments/${open}`);
      if (!res.ok) return;
      const data = await res.json();
      setStandings(data.standings);
      setBracket(data.bracket ?? null);
    };
    fetchStandings();
    const poll = setInterval(fetchStandings, 15_000);
    return () => clearInterval(poll);
  }, [open]);

  // Aguardando na sala: consulta a fila até achar o oponente
  useEffect(() => {
    if (queue.status !== "waiting" || !open) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/tournaments/${open}/queue`);
      if (res.ok) setQueue(await res.json());
    }, 3_000);
    return () => clearInterval(poll);
  }, [queue.status, open]);
  useEffect(() => {
    if (queue.status !== "matched") return;
    alertMatchFound(`/duel/play?room=${queue.matchId}`);
    router.push(`/duel/play?room=${queue.matchId}`);
  }, [queue, router]);

  async function act(id: string, action: "join" | "leave") {
    setBusy(true);
    setFeedback(null);
    const res = await fetch(`/api/tournaments/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json();
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível." });
    if (res.ok) load();
  }

  async function enterRoom(id: string) {
    unlockAlerts();
    void askNotificationPermission();
    setOpen(id);
    setFeedback(null);
    const res = await fetch(`/api/tournaments/${id}/queue`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setFeedback({ ok: false, text: data.error ?? "Não foi possível entrar na sala." });
    setQueue(data);
  }

  async function leaveRoom() {
    if (open) await fetch(`/api/tournaments/${open}/queue`, { method: "DELETE" });
    setQueue({ status: "idle" });
  }

  return (
    <GlassPanel className="max-w-5xl">
      {/* Exodia: o campeão definitivo */}
      <ArtBanner
        art={ART.exodia}
        eyebrow="Arena dos campeões"
        title={
          <span className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-300" />
            Torneios
          </span>
        }
        subtitle="Torneios por pontos (duele na sala do torneio) e em chaves (melhor de 3, com dia e hora marcados). Até o 3º lugar ganha troféu."
        tone="gold"
        position="center 20%"
      />

      {feedback && (
        <p className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {feedback.text}
        </p>
      )}

      {!tournaments ? (
        <p className="text-sm text-zinc-500">Carregando torneios...</p>
      ) : tournaments.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-12 text-center text-sm text-zinc-500">
          Nenhum torneio marcado ainda. Fique de olho no Jornal!
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {tournaments.map((t) => {
            const isOpen = open === t.id;
            return (
              <article key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${TYPE[t.type].badge}`}>{TYPE[t.type].label}</span>
                      <span className={`text-xs font-semibold ${t.phase === "running" ? "text-emerald-300" : "text-zinc-400"}`}>{PHASE[t.phase]}</span>
                    </p>
                    <h2 className="mt-1 text-lg font-black text-zinc-100">{t.name}</h2>
                    {t.description && <p className="text-sm text-zinc-400">{t.description}</p>}
                    {t.structure === "bracket" && t.stages.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {t.stages.map((st) => (
                          <span key={st.key} className="rounded-md border border-zinc-700 bg-zinc-950/60 px-2 py-0.5 text-[11px] text-zinc-300">
                            <strong className="text-zinc-100">{st.name}</strong> · {when(st.startsAt)}
                          </span>
                        ))}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" /> {when(t.startsAt)} → {when(t.endsAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {t.entrants}
                        {t.structure === "bracket" && t.maxEntrants ? `/${t.maxEntrants} vagas` : " inscritos"}
                      </span>
                      {t.structure === "bracket" && (
                        <span className="flex items-center gap-1 font-semibold text-amber-200/90">
                          <GitBranch className="h-3.5 w-3.5" /> Chaves · melhor de 3{t.paused ? " · pausado" : ""}
                        </span>
                      )}
                      <span>banlist: {t.banlistName ?? t.format}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {t.structure === "bracket" ? (
                      !t.drawn && t.phase !== "finished" ? (
                        t.joined ? (
                          <button disabled={busy} onClick={() => act(t.id, "leave")} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                            Sair da inscrição
                          </button>
                        ) : t.maxEntrants && t.entrants >= t.maxEntrants ? (
                          <span className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-500">Vagas esgotadas</span>
                        ) : (
                          <button disabled={busy} onClick={() => act(t.id, "join")} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40">
                            Inscrever-se
                          </button>
                        )
                      ) : t.joined ? (
                        <span className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-300">Você está nas chaves: o aviso do seu duelo aparece no topo</span>
                      ) : null
                    ) : (
                    <>
                    {(t.phase === "scheduled" || t.phase === "running") && !t.joined && (
                      <button disabled={busy} onClick={() => act(t.id, "join")} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40">
                        Inscrever-se
                      </button>
                    )}
                    {t.phase === "scheduled" && t.joined && (
                      <button disabled={busy} onClick={() => act(t.id, "leave")} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                        Sair da inscrição
                      </button>
                    )}
                    {t.phase === "running" && t.joined && (
                      isOpen && queue.status === "waiting" ? (
                        <button onClick={leaveRoom} className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/10">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Procurando oponente... (sair)
                        </button>
                      ) : (
                        <button onClick={() => enterRoom(t.id)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400">
                          <Swords className="h-4 w-4" /> Entrar na sala
                        </button>
                      )
                    )}
                    </>
                    )}
                    <button onClick={() => setOpen(isOpen ? null : t.id)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">
                      {isOpen ? "Fechar" : t.structure === "bracket" ? "Ver chaves" : "Classificação"}
                    </button>
                  </div>
                </div>

                {/* PRÊMIOS */}
                {t.prizes.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {t.prizes.map((p) => (
                      <li key={p.placement} className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-xs text-zinc-300">
                        <MillenniumPyramid className={`h-3.5 w-3.5 ${p.placement === 1 ? "text-amber-300" : p.placement === 2 ? "text-zinc-300" : "text-orange-400"}`} />
                        <strong className="text-zinc-100">{p.placement}º</strong> {p.labels.join(" + ")}
                      </li>
                    ))}
                  </ul>
                )}

                {/* CHAVES (melhor de 3), com "assistir" nos confrontos ao vivo */}
                {isOpen && t.structure === "bracket" && (
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                    {bracket ? (
                      <BracketView data={bracket} onWatch={(matchId) => router.push(`/random?assistir=${matchId}`)} />
                    ) : (
                      <p className="text-sm text-zinc-500">Carregando as chaves...</p>
                    )}
                  </div>
                )}

                {/* CLASSIFICAÇÃO */}
                {isOpen && t.structure !== "bracket" && (
                  <ol className="mt-3 overflow-hidden rounded-lg border border-zinc-800">
                    {standings.length === 0 ? (
                      <li className="px-3 py-6 text-center text-sm text-zinc-500">Ninguém inscrito ainda.</li>
                    ) : (
                      standings.map((s) => (
                        <li key={s.userId} className="flex items-center gap-3 border-b border-zinc-800/60 px-3 py-2 last:border-b-0">
                          <span className="w-7 text-center text-sm font-bold text-zinc-500">{s.position}º</span>
                          <Avatar {...s.avatar} size={30} />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <PlayerName {...s.playerName} className="font-semibold text-zinc-200" />
                          </span>
                          <span className="text-xs text-zinc-400">
                            {s.wins}V · {s.losses}D
                          </span>
                          <span className="w-16 text-right text-sm font-bold tabular-nums text-zinc-100">{s.points} pts</span>
                        </li>
                      ))
                    )}
                  </ol>
                )}
              </article>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}
