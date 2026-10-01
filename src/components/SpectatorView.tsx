"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Heart, Layers, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";

interface ZoneCard {
  zone: number;
  position: string;
  cardId: number | null; // null = virada para baixo (escondida)
}
interface SpectatorPlayer {
  userId: string;
  avatar: { image: string | null; name: string | null; frameUrl: string | null };
  playerName: { name: string | null; effect: string | null; profile: string | null };
  lifePoints: number;
  handCount: number;
  deckCount: number;
  extraCount: number;
  monsters: ZoneCard[];
  spellTraps: ZoneCard[];
  graveyard: number[];
  banished: number[];
}
interface SpectatorState {
  id: string;
  kind: "random" | "tournament";
  text: string;
  status: string;
  phase: string;
  turn: number;
  turnPlayerId: string | null;
  winnerId: string | null;
  score: { a: string | null; winsA: number; winsB: number } | null;
  players: SpectatorPlayer[];
  cards: Record<number, { name: string; imageUrl: string | null; type: string }>;
}

const POLL_MS = 2_000;
const CARD_BACK = "https://images.ygoprodeck.com/images/cards/back_high.jpg";

/** Assistir a um duelo ao vivo: campo, cemitérios e banidas dos dois (sem ver a mão). */
export function SpectatorView({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [state, setState] = useState<SpectatorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pile, setPile] = useState<{ title: string; ids: number[] } | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch(`/api/watch/${matchId}`, { cache: "no-store" }).catch(() => null);
      if (!alive || !res) return;
      if (res.ok) setState(await res.json());
      else setError("Esse duelo não está mais disponível.");
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [matchId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoom != null) setZoom(null);
      else if (pile) setPile(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, pile, onClose]);

  const card = (id: number | null) => (id != null ? state?.cards[id] : undefined);

  // Funções (e não componentes): o tabuleiro atualiza a cada 2 s sem piscar as imagens
  const zone = (c?: ZoneCard, horizontal?: boolean) => (
    <div className="flex aspect-[59/86] w-full items-center justify-center rounded-md border border-amber-500/15 bg-black/30">
      {c && (
        <button
          onClick={() => c.cardId != null && setZoom(c.cardId)}
          className={`block h-full w-full overflow-hidden rounded-md ${horizontal ? "rotate-90 scale-[0.72]" : ""}`}
          title={card(c.cardId)?.name ?? "Carta virada para baixo"}
        >
          <img src={card(c.cardId)?.imageUrl ?? CARD_BACK} alt={card(c.cardId)?.name ?? "Virada para baixo"} className="h-full w-full object-cover" />
        </button>
      )}
    </div>
  );

  const pileOf = (title: string, ids: number[]) => {
    const top = ids.at(-1);
    return (
      <button onClick={() => ids.length && setPile({ title, ids })} className="flex flex-col items-center gap-0.5" title={`${title} (${ids.length})`}>
        <div className="relative flex aspect-[59/86] w-full items-center justify-center overflow-hidden rounded-md border border-zinc-700 bg-black/40">
          {top != null && <img src={card(top)?.imageUrl ?? CARD_BACK} alt="" className="h-full w-full object-cover opacity-90" />}
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[10px] font-black text-white">{ids.length}</span>
        </div>
        <span className="text-[9px] uppercase tracking-wider text-zinc-400">{title}</span>
      </button>
    );
  };

  const half = (p: SpectatorPlayer, top: boolean) => {
    const monsters = Array.from({ length: 5 }, (_, z) => p.monsters.find((c) => c.zone === z));
    const spells = Array.from({ length: 5 }, (_, z) => p.spellTraps.find((c) => c.zone === z));
    const fieldSpell = p.spellTraps.find((c) => c.zone === 5);
    const isTurn = state?.turnPlayerId === p.userId;
    const winner = state?.winnerId === p.userId;
    const info = (
      <div className={`flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 ${isTurn ? "bg-amber-500/15 ring-1 ring-amber-400/40" : "bg-zinc-900/70"}`}>
        <Avatar {...p.avatar} size={30} />
        <PlayerName {...p.playerName} className="font-bold" />
        {winner && <span className="rounded bg-amber-400 px-1.5 text-[10px] font-black text-black">VENCEU</span>}
        {isTurn && !state?.winnerId && <span className="text-[10px] font-bold uppercase text-amber-300">na vez</span>}
        <span className="ml-auto flex items-center gap-1 font-mono text-lg font-black text-rose-300">
          <Heart className="h-4 w-4" /> {p.lifePoints}
        </span>
        <span className="flex items-center gap-1 text-xs text-zinc-400" title="Cartas na mão (escondidas)">
          <Layers className="h-3.5 w-3.5" /> mão {p.handCount} · deck {p.deckCount} · extra {p.extraCount}
        </span>
      </div>
    );
    // Linhas do campo: monstros perto do centro, magias/armadilhas perto do jogador
    const monsterRow = (
      <div className="grid grid-cols-7 gap-1.5">
        {zone(fieldSpell)}
        {monsters.map((c, i) => (
          <div key={i}>{zone(c, Boolean(c && c.position.includes("defense")))}</div>
        ))}
        {pileOf("Cemitério", p.graveyard)}
      </div>
    );
    const spellRow = (
      <div className="grid grid-cols-7 gap-1.5">
        <div />
        {spells.map((c, i) => (
          <div key={i}>{zone(c)}</div>
        ))}
        {pileOf("Banidas", p.banished)}
      </div>
    );
    return (
      <div className="flex flex-col gap-1.5">
        {top ? (
          <>
            {info}
            {spellRow}
            {monsterRow}
          </>
        ) : (
          <>
            {monsterRow}
            {spellRow}
            {info}
          </>
        )}
      </div>
    );
  };

  const [bottom, topPlayer] = state?.players ?? [];

  // Portal: o blur dos painéis prenderia um modal "fixed" dentro deles
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-5" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Assistir duelo" className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-[radial-gradient(ellipse_at_center,#1b1a24,#09090b)] shadow-2xl">
        <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
          <Eye className="h-4 w-4 text-emerald-300" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-100">{state?.text ?? "Carregando duelo..."}</p>
            {state && (
              <p className="text-[11px] text-zinc-400">
                {state.status === "active" ? `Turno ${state.turn}` : state.status === "finished" ? "Duelo encerrado" : "Começando (pedra-papel-tesoura / ordem)"}
                {state.score && ` · placar do confronto ${state.score.winsA}-${state.score.winsB}`}
              </p>
            )}
          </div>
          <span className="ml-auto flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-black text-rose-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> AO VIVO
          </span>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-col gap-3 overflow-y-auto p-3">
          {error && <p className="py-10 text-center text-sm text-zinc-400">{error}</p>}
          {!error && !state && <p className="py-10 text-center text-sm text-zinc-500">Carregando...</p>}
          {state && topPlayer && half(topPlayer, true)}
          {state && <div className="h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />}
          {state && bottom && half(bottom, false)}
          <p className="text-center text-[10px] text-zinc-500">Você vê o campo, os cemitérios e as banidas. A mão dos duelistas fica escondida.</p>
        </div>
      </div>

      {/* Cemitério / banidas abertos */}
      {pile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={(e) => (e.stopPropagation(), setPile(null))}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-4">
            <p className="mb-3 font-bold text-zinc-100">
              {pile.title} ({pile.ids.length})
            </p>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {pile.ids.map((id, i) => (
                <li key={`${id}-${i}`}>
                  <button onClick={() => setZoom(id)} title={card(id)?.name}>
                    <img src={card(id)?.imageUrl ?? CARD_BACK} alt={card(id)?.name ?? ""} className="aspect-[59/86] w-full rounded object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Carta ampliada */}
      {zoom != null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6" onClick={(e) => (e.stopPropagation(), setZoom(null))}>
          <div className="flex flex-col items-center gap-2">
            <img src={card(zoom)?.imageUrl ?? CARD_BACK} alt={card(zoom)?.name ?? ""} className="max-h-[75vh] rounded-xl shadow-2xl" />
            <p className="text-sm font-bold text-zinc-100">{card(zoom)?.name}</p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
