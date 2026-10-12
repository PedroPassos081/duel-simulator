import { Crown, Radio } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";

export interface BracketPerson {
  userId: string;
  avatar: { image: string | null; name: string | null; frameUrl: string | null };
  playerName: { name: string | null; effect: string | null; profile: string | null };
}
export interface BracketSeries {
  id: string;
  stageKey: string;
  round: number;
  slot: number;
  a: BracketPerson | null;
  b: BracketPerson | null;
  winsA: number;
  winsB: number;
  winnerId: string | null;
  status: string;
  liveMatchId: string | null;
}
export interface BracketData {
  stages: { key: string; name: string; startsAt: string }[];
  series: BracketSeries[];
}

const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function roundName(stageKey: string, round: number, rounds: number) {
  if (stageKey === "final") return "Final";
  const left = rounds - round;
  if (left === 0) return "Decisão da chave";
  if (left === 1) return "Semifinal da chave";
  return `Rodada ${round}`;
}

function Side({ person, wins, won, lost, meId }: { person: BracketPerson | null; wins: number; won: boolean; lost: boolean; meId?: string | null }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 ${won ? "bg-amber-500/10" : ""} ${lost ? "opacity-50" : ""}`}>
      {person ? (
        <>
          <Avatar {...person.avatar} size={22} />
          <PlayerName {...person.playerName} className={`min-w-0 flex-1 truncate text-xs ${person.userId === meId ? "font-black" : "font-semibold"}`} />
        </>
      ) : (
        <span className="flex-1 text-xs italic text-zinc-600">a definir</span>
      )}
      {won && <Crown className="h-3.5 w-3.5 text-amber-300" />}
      <span className="w-4 text-right font-mono text-xs font-bold text-zinc-300">{person ? wins : ""}</span>
    </div>
  );
}

/** Chaves do torneio: Chave A, Chave B e a Final, rodada por rodada, com o placar de cada confronto (melhor de 3). */
export function BracketView({ data, meId, onWatch }: { data: BracketData; meId?: string | null; onWatch?: (matchId: string) => void }) {
  if (data.series.length === 0) return <p className="text-sm text-zinc-500">As chaves ainda não foram sorteadas.</p>;
  const order = ["A", "B", "final"];
  return (
    <div className="flex flex-col gap-5">
      {order.map((key) => {
        const stage = data.stages.find((s) => s.key === key);
        const list = data.series.filter((s) => s.stageKey === key);
        const rounds = Math.max(0, ...list.map((s) => s.round));
        if (list.length === 0 && key !== "final") return null;
        return (
          <section key={key}>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-200">
              {stage?.name ?? key}
              {stage && <span className="font-normal normal-case tracking-normal text-zinc-500">· {when(stage.startsAt)}</span>}
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
                <div key={round} className="flex min-w-[200px] flex-col justify-around gap-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">{roundName(key, round, rounds)}</p>
                  {list
                    .filter((s) => s.round === round)
                    .sort((a, b) => a.slot - b.slot)
                    .map((s) => {
                      const aWon = Boolean(s.winnerId && s.winnerId === s.a?.userId);
                      const bWon = Boolean(s.winnerId && s.winnerId === s.b?.userId);
                      return (
                        <div key={s.id} className={`overflow-hidden rounded-lg border ${s.status === "live" ? "border-emerald-500/50" : "border-zinc-800"} bg-zinc-950/70`}>
                          <Side person={s.a} wins={s.winsA} won={aWon} lost={bWon} meId={meId} />
                          <div className="h-px bg-zinc-800" />
                          <Side person={s.b} wins={s.winsB} won={bWon} lost={aWon} meId={meId} />
                          {s.status === "live" && (
                            <div className="flex items-center justify-between border-t border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
                              <span className="flex items-center gap-1">
                                <Radio className="h-3 w-3" /> Ao vivo
                              </span>
                              {s.liveMatchId && onWatch && (
                                <button onClick={() => onWatch(s.liveMatchId!)} className="underline hover:text-emerald-200">
                                  assistir
                                </button>
                              )}
                            </div>
                          )}
                          {s.status === "finished" && !s.winnerId && <p className="border-t border-zinc-800 px-2 py-1 text-[10px] text-zinc-500">Ninguém avançou (W.O. duplo)</p>}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
