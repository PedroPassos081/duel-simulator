"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CirclePlay,
  Cpu,
  Layers3,
  Radio,
  ShieldCheck,
  Swords,
  Users,
} from "lucide-react";
import type { Card, DeckSection } from "@/types/card";

type EquippedDeck = {
  id: string;
  name: string;
  isEquipped: boolean;
  cards: { section: DeckSection; quantity: number; card: Card }[];
};

type EngineStatus = {
  available: boolean;
  version: string | null;
  cardDatabaseConfigured: boolean;
  scriptsConfigured: boolean;
  readyForDuels: boolean;
};

export default function DuelPage() {
  const router = useRouter();
  const [deck, setDeck] = useState<EquippedDeck>();
  const [engine, setEngine] = useState<EngineStatus>();
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string>();

  useEffect(() => {
    Promise.all([
      fetch("/api/decks").then((response) => response.json()),
      fetch("/api/duel/engine/status").then((response) => response.json()),
    ])
      .then(([decks, engineStatus]: [EquippedDeck[], EngineStatus]) => {
        if (Array.isArray(decks)) {
          setDeck(decks.find((item) => item.isEquipped));
        }
        setEngine(engineStatus);
      })
      .finally(() => setLoading(false));
  }, []);

  const mainCount =
    deck?.cards
      .filter((item) => item.section === "main")
      .reduce((total, item) => total + item.quantity, 0) ?? 0;
  const extraCount =
    deck?.cards
      .filter((item) => item.section === "extra")
      .reduce((total, item) => total + item.quantity, 0) ?? 0;

  async function findDuel() {
    setMatching(true);
    setMatchError(undefined);
    const response = await fetch("/api/duel/rooms", { method: "POST" });
    const result = await response.json();
    if (!response.ok) {
      setMatching(false);
      setMatchError(
        result.issues?.[0]?.message ?? result.error ?? "Não foi possível criar a sala."
      );
      return;
    }
    router.push(`/duel/play?room=${result.roomId}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <section className="relative overflow-hidden rounded-3xl border border-edison-border bg-edison-panel px-6 py-10 text-center shadow-2xl sm:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(234,179,8,0.15),transparent_45%)]" />
        <div className="relative mx-auto max-w-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-edison-gold/30 bg-edison-gold/10">
            <Swords className="h-8 w-8 text-edison-gold" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-edison-gold">
            Arena Edison
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Preparar duelo
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-400">
            Confira o deck equipado. Ao começar, o duelo abrirá em uma tela
            separada e ocupará toda a janela.
          </p>
        </div>

        <div className="relative mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-left">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Layers3 className="h-4 w-4" /> Deck equipado
            </p>
            <p className="mt-2 text-lg font-bold">
              {loading ? "Carregando..." : deck?.name ?? "Nenhum deck equipado"}
            </p>
            {deck && (
              <p className="mt-1 text-xs text-gray-500">
                {mainCount} no Main Deck · {extraCount} no Extra Deck
              </p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-left">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Users className="h-4 w-4" /> Adversário
            </p>
            <p className="mt-2 text-lg font-bold">Jogador online</p>
            <p className="mt-1 text-xs text-gray-500">
              A sala aguardará o segundo duelista
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-3 flex max-w-xl items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              engine?.available
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-amber-500/10 text-amber-300"
            }`}
          >
            {engine?.available ? (
              <Cpu className="h-4 w-4" />
            ) : (
              <Radio className="h-4 w-4" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-white/85">
              {loading
                ? "Verificando motor..."
                : engine?.available
                  ? `OCGCore ${engine.version} conectado`
                  : "Motor de duelo indisponível"}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {engine?.readyForDuels
                ? "Base de cartas e scripts de efeitos prontos"
                : "Falta configurar a base de cartas e os scripts de efeitos"}
            </p>
          </div>
        </div>

        <div className="relative mt-7 flex flex-col items-center gap-3">
          {deck ? (
            <button
              type="button"
              onClick={findDuel}
              disabled={matching}
              className="flex h-12 items-center gap-2 rounded-xl bg-edison-gold px-7 text-sm font-black text-black transition hover:brightness-110 disabled:opacity-50"
            >
              <CirclePlay className="h-5 w-5" />
              {matching ? "Procurando duelista..." : "Procurar duelo"}
            </button>
          ) : (
            <Link
              href="/deck-builder"
              className="rounded-xl bg-edison-gold px-7 py-3 text-sm font-black text-black"
            >
              Equipar um deck
            </Link>
          )}
          {matchError && (
            <span className="max-w-lg text-center text-xs text-red-400">
              {matchError}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Esta etapa não altera suas cartas nem o banco de dados
          </span>
        </div>
      </section>
    </div>
  );
}
