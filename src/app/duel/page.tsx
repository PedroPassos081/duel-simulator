"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, CirclePlay, Layers3, Swords } from "lucide-react";
import type { Card, DeckSection } from "@/types/card";

type EquippedDeck = {
  id: string;
  name: string;
  isEquipped: boolean;
  cards: { section: DeckSection; quantity: number; card: Card }[];
};

const PHASES = ["Draw", "Standby", "Main 1", "Battle", "Main 2", "End"];

function Zone({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center rounded-lg border border-white/10 bg-black/20 text-center text-[10px] uppercase tracking-wider text-white/30 ${compact ? "aspect-[421/614]" : "aspect-[421/614]"}`}>
      {label}
    </div>
  );
}

function PlayerField({ opponent = false }: { opponent?: boolean }) {
  return (
    <div className={`space-y-2 ${opponent ? "rotate-180" : ""}`}>
      <div className="grid grid-cols-[0.8fr_repeat(5,1fr)_0.8fr] gap-2">
        <Zone label="Campo" /><Zone label="Spell" /><Zone label="Spell" /><Zone label="Spell" /><Zone label="Spell" /><Zone label="Spell" /><Zone label="Cemitério" />
      </div>
      <div className="grid grid-cols-[0.8fr_repeat(5,1fr)_0.8fr] gap-2">
        <Zone label="Extra" /><Zone label="Monstro" /><Zone label="Monstro" /><Zone label="Monstro" /><Zone label="Monstro" /><Zone label="Monstro" /><Zone label="Deck" />
      </div>
    </div>
  );
}

export default function DuelPage() {
  const [deck, setDeck] = useState<EquippedDeck>();
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    fetch("/api/decks").then((response) => response.json()).then((decks: EquippedDeck[]) => {
      if (Array.isArray(decks)) setDeck(decks.find((item) => item.isEquipped));
      setLoading(false);
    });
  }, []);

  const mainCount = deck?.cards.filter((item) => item.section === "main").reduce((total, item) => total + item.quantity, 0) ?? 0;

  return (
    <div className="space-y-5 py-3">
      <header className="flex flex-col gap-4 rounded-2xl border border-edison-border bg-edison-panel p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-edison-gold">Duelo automático</p><h1 className="mt-1 text-2xl font-bold">Arena Edison</h1><p className="mt-1 text-sm text-gray-400">{deck ? `Deck equipado: ${deck.name}` : "Equipe um deck válido para entrar na arena."}</p></div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1.5 text-xs text-purple-300">Motor automático em preparação</span>
          {deck ? <button onClick={() => setStarted(true)} className="flex h-10 items-center gap-2 rounded-lg bg-edison-gold px-4 text-sm font-bold text-black"><CirclePlay className="h-4 w-4" /> Preparar duelo</button> : <Link href="/deck-builder" className="rounded-lg bg-edison-gold px-4 py-2 text-sm font-bold text-black">Equipar deck</Link>}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_260px]">
        <main className="overflow-x-auto rounded-2xl border border-edison-border bg-[radial-gradient(circle_at_center,_#25443b,_#101b19_70%)] p-4 shadow-inner sm:p-6">
          <div className="mx-auto min-w-[680px] max-w-4xl space-y-3">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-red-300" /><span className="text-sm font-semibold">Oponente</span></div><span className="rounded-lg bg-black/40 px-4 py-2 font-mono text-xl font-bold text-red-300">8000 LP</span></div>
            <PlayerField opponent />
            <div className="flex items-center gap-2 border-y border-white/10 py-2">
              {PHASES.map((phase, index) => <span key={phase} className={`flex-1 rounded py-1 text-center text-[10px] font-semibold uppercase ${index === 0 ? "bg-edison-gold text-black" : "bg-black/20 text-white/40"}`}>{phase}</span>)}
            </div>
            <PlayerField />
            <div className="flex items-center justify-between"><span className="rounded-lg bg-black/40 px-4 py-2 font-mono text-xl font-bold text-green-300">8000 LP</span><div className="flex items-center gap-2"><span className="text-sm font-semibold">Você</span><Swords className="h-5 w-5 text-edison-gold" /></div></div>
            <div className="flex h-28 items-end justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/10 p-2">{Array.from({ length: started ? 5 : 0 }, (_, index) => <div key={index} className="h-24 w-16 rounded border border-edison-gold/30 bg-gradient-to-br from-amber-950 to-black shadow-lg" />)}{!started && <p className="m-auto text-sm text-white/30">Sua mão inicial aparecerá aqui</p>}</div>
          </div>
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-edison-border bg-edison-panel p-4"><h2 className="flex items-center gap-2 font-semibold"><Layers3 className="h-4 w-4 text-edison-gold" /> Deck equipado</h2>{loading ? <p className="mt-3 text-sm text-gray-500">Carregando...</p> : deck ? <div className="mt-3"><p className="font-medium">{deck.name}</p><p className="mt-1 text-xs text-gray-500">{mainCount} cartas no Main Deck</p></div> : <p className="mt-3 text-sm text-gray-500">Nenhum deck equipado.</p>}</section>
          <section className="rounded-2xl border border-edison-border bg-edison-panel p-4"><h2 className="font-semibold">Registro do duelo</h2><div className="mt-3 rounded-lg bg-black/20 p-3 text-xs leading-5 text-gray-500">{started ? "Campo preparado. Aguardando conexão com o motor automático." : "As ações, correntes e mudanças de fase aparecerão aqui."}</div></section>
          <section className="rounded-2xl border border-purple-400/20 bg-purple-950/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-purple-300">Próxima etapa</p><p className="mt-2 text-sm leading-6 text-gray-400">Integrar o ocgcore, os scripts de efeitos e a comunicação entre o motor e esta interface.</p></section>
        </aside>
      </div>
    </div>
  );
}
