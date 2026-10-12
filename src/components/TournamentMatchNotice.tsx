"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hourglass, Swords } from "lucide-react";
import { alertMatchFound } from "@/lib/duel-alerts";

type MyMatch =
  | {
      kind: "match";
      matchId: string;
      tournament: string;
      stage: string;
      gameNumber: number;
      score: string;
      status: string;
      opensAt: string | null;
      woAt: string | null;
      joined: boolean;
    }
  | { kind: "waiting"; tournament: string; stage: string }
  | null;

const POLL_MS = 20_000;
const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Aviso no topo: o seu duelo de torneio (chaves) abriu, está rolando ou você espera o próximo adversário. */
export function TournamentMatchNotice() {
  const pathname = usePathname();
  const [match, setMatch] = useState<MyMatch>(null);
  const [now, setNow] = useState(Date.now());
  const lastMatch = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      // Consulta mesmo com a aba escondida (o navegador espaça os pedidos sozinho)
      const res = await fetch("/api/tournaments/my-match", { cache: "no-store" }).catch(() => null);
      if (res?.ok && alive) {
        const next: MyMatch = await res.json();
        // Abriu um duelo novo do torneio: apito e notificação
        if (next?.kind === "match" && next.matchId !== lastMatch.current) {
          if (lastMatch.current !== undefined) alertMatchFound(`/duel/play?room=${next.matchId}`);
          lastMatch.current = next.matchId;
        } else if (lastMatch.current === undefined) lastMatch.current = next?.kind === "match" ? next.matchId : null;
        setMatch(next);
      }
    };
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  // Na tela do duelo o aviso não precisa aparecer
  if (!match || pathname.startsWith("/duel/play")) return null;

  if (match.kind === "waiting") {
    return (
      <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100">
        <Hourglass className="mr-1 inline h-3.5 w-3.5" /> Você avançou no <strong>{match.tournament}</strong> ({match.stage}). Aguardando o resultado do outro confronto: quando sair,
        abre uma tela de 5 minutos para o seu próximo duelo.
      </div>
    );
  }

  const opensIn = match.opensAt ? new Date(match.opensAt).getTime() - now : 0;
  const woIn = match.woAt ? new Date(match.woAt).getTime() - now : 0;
  const text =
    match.status !== "waiting"
      ? "Seu duelo está rolando!"
      : opensIn > 0
        ? `Seu duelo começa em ${mmss(opensIn)} (ou na hora, se os dois entrarem).`
        : match.joined
          ? "Você está na sala. Aguardando o adversário."
          : `Entre agora! Seu tempo acaba em ${mmss(woIn)} (W.O.).`;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs text-emerald-50">
      <span className="flex items-center gap-1.5">
        <Swords className="h-3.5 w-3.5 text-emerald-300" />
        <strong>{match.tournament}</strong> · {match.stage} · Duelo {match.gameNumber} · placar {match.score} — {text}
      </span>
      <Link href={`/duel/play?room=${match.matchId}`} className="rounded-md bg-emerald-400 px-3 py-1 font-black text-black hover:bg-emerald-300">
        {match.status === "waiting" ? "Entrar no duelo" : "Voltar ao duelo"}
      </Link>
    </div>
  );
}
