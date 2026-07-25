"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, CirclePlay, Layers3, ShieldCheck, Swords } from "lucide-react";
import type { Card, DeckSection } from "@/types/card";

type EquippedDeck = {
  id: string;
  name: string;
  isEquipped: boolean;
  cards: { section: DeckSection; quantity: number; card: Card }[];
};

export default function DuelPage() {
  const [deck, setDeck] = useState<EquippedDeck>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/decks")
      .then((response) => response.json())
      .then((decks: EquippedDeck[]) => {
        if (Array.isArray(decks)) {
          setDeck(decks.find((item) => item.isEquipped));
        }
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
              <Bot className="h-4 w-4" /> Adversário
            </p>
            <p className="mt-2 text-lg font-bold">CPU Edison</p>
            <p className="mt-1 text-xs text-gray-500">
              Partida de teste contra o computador
            </p>
          </div>
        </div>

        <div className="relative mt-7 flex flex-col items-center gap-3">
          {deck ? (
            <Link
              href="/duel/play"
              className="flex h-12 items-center gap-2 rounded-xl bg-edison-gold px-7 text-sm font-black text-black transition hover:brightness-110"
            >
              <CirclePlay className="h-5 w-5" />
              Começar duelo
            </Link>
          ) : (
            <Link
              href="/deck-builder"
              className="rounded-xl bg-edison-gold px-7 py-3 text-sm font-black text-black"
            >
              Equipar um deck
            </Link>
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
