import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  Layers3,
  LibraryBig,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user
    ? (session.user as { id?: string }).id
    : undefined;

  const [user, catalogSize] = await Promise.all([
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: {
            name: true,
            username: true,
            wallet: {
              select: { gold: true, cash: true },
            },
            ownerships: {
              select: { quantity: true },
            },
            decks: {
              orderBy: { updatedAt: "desc" },
              take: 3,
              select: {
                id: true,
                name: true,
                format: true,
                updatedAt: true,
                cards: {
                  select: { quantity: true },
                },
              },
            },
            _count: {
              select: { decks: true },
            },
          },
        })
      : null,
    prisma.card.count(),
  ]);

  if (!user) {
    return (
      <div className="relative isolate overflow-hidden py-12 sm:py-20">
        <div className="absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-edison-gold/10 blur-3xl" />

        <section className="mx-auto max-w-4xl text-center">
          <Image
            src="/icon.png"
            alt="Emblema Master Duelist"
            width={192}
            height={192}
            priority
            className="mx-auto mb-5 h-40 w-40 object-contain drop-shadow-[0_0_32px_rgba(212,175,55,0.25)] sm:h-48 sm:w-48"
          />
          <div className="mb-6 leading-none">
            <p className="text-4xl font-black uppercase tracking-[0.14em] text-edison-gold drop-shadow-[0_2px_12px_rgba(212,175,55,0.25)] sm:text-5xl">Master</p>
            <p className="mt-2 text-xl font-semibold uppercase tracking-[0.38em] text-gray-100 sm:text-2xl">Duelist</p>
          </div>
          <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-edison-gold/20 bg-edison-gold/10 px-4 py-2 text-sm font-medium text-edison-gold">
            <Sparkles className="h-4 w-4" />
            Formato Edison
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Construa. Valide.
            <span className="block text-edison-gold">Prepare seu próximo duelo.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-400 sm:text-lg">
            Monte decks, confira a banlist e organize sua coleção em um só
            lugar. O catálogo já possui {catalogSize} cartas disponíveis.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-edison-gold px-6 font-semibold text-black transition hover:brightness-110"
            >
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-edison-border bg-edison-panel px-6 font-medium transition hover:border-gray-600 hover:bg-zinc-800"
            >
              Já tenho uma conta
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-3">
          {[
            {
              icon: Layers3,
              title: "Deck Builder",
              text: "Monte Main, Extra e Side Deck com validação automática.",
            },
            {
              icon: LibraryBig,
              title: "Sua coleção",
              text: "Acompanhe as cartas disponíveis na sua conta.",
            },
            {
              icon: ShoppingBag,
              title: "Loja integrada",
              text: "Use suas moedas para ampliar as possibilidades do deck.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="rounded-2xl border border-edison-border bg-edison-panel/80 p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-edison-gold/10 text-edison-gold">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">{text}</p>
            </article>
          ))}
        </section>
      </div>
    );
  }

  const ownedCards = user.ownerships.reduce(
    (total, ownership) => total + ownership.quantity,
    0
  );
  const firstName = user.name?.trim().split(/\s+/)[0] || user.username || "Duelista";

  return (
    <div className="py-6 sm:py-10">
      <section className="relative isolate overflow-hidden rounded-3xl border border-edison-border bg-edison-panel p-6 sm:p-9">
        <div className="absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-edison-gold/10 blur-3xl" />
        <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-sm font-medium text-edison-gold">
              Painel do duelista
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Bem-vindo, {firstName}
            </h1>
            <p className="mt-3 max-w-xl text-gray-400">
              Continue construindo sua coleção e prepare uma nova estratégia
              para o formato Edison.
            </p>
          </div>
          <Link
            href="/deck-builder"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-edison-gold px-5 font-semibold text-black transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Montar novo deck
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Layers3,
            label: "Meus decks",
            value: user._count.decks,
            color: "text-edison-gold bg-edison-gold/10",
          },
          {
            icon: LibraryBig,
            label: "Cartas na coleção",
            value: ownedCards,
            color: "text-blue-400 bg-blue-400/10",
          },
          {
            icon: CircleDollarSign,
            label: "Gold disponível",
            value: user.wallet?.gold ?? 0,
            color: "text-amber-400 bg-amber-400/10",
          },
          {
            icon: Sparkles,
            label: "Gemas disponíveis",
            value: user.wallet?.cash ?? 0,
            color: "text-purple-400 bg-purple-400/10",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <article
            key={label}
            className="rounded-2xl border border-edison-border bg-edison-panel p-5"
          >
            <div
              className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-gray-400">{label}</p>
          </article>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-edison-border bg-edison-panel p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Decks recentes</h2>
              <p className="mt-1 text-sm text-gray-400">
                Continue de onde você parou
              </p>
            </div>
            <Link
              href="/deck-builder"
              className="text-sm font-medium text-edison-gold hover:underline"
            >
              Abrir builder
            </Link>
          </div>

          {user.decks.length > 0 ? (
            <div className="space-y-3">
              {user.decks.map((deck) => {
                const cardCount = deck.cards.reduce(
                  (total, card) => total + card.quantity,
                  0
                );

                return (
                  <Link
                    key={deck.id}
                    href="/deck-builder"
                    className="flex items-center justify-between gap-4 rounded-xl border border-edison-border bg-black/10 p-4 transition hover:border-edison-gold/40 hover:bg-black/20"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-edison-gold/10 text-edison-gold">
                        <Layers3 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{deck.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {deck.format.toUpperCase()} · {cardCount} cartas
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDate(deck.updatedAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-edison-border px-5 py-10 text-center">
              <Layers3 className="mx-auto h-8 w-8 text-gray-600" />
              <p className="mt-3 font-medium">Nenhum deck criado ainda</p>
              <p className="mt-1 text-sm text-gray-500">
                Monte seu primeiro deck para vê-lo aqui.
              </p>
              <Link
                href="/deck-builder"
                className="mt-4 inline-flex text-sm font-medium text-edison-gold hover:underline"
              >
                Criar primeiro deck
              </Link>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-edison-border bg-edison-panel p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Acesso rápido</h2>
          <p className="mt-1 text-sm text-gray-400">
            Atalhos para continuar jogando
          </p>
          <div className="mt-5 space-y-3">
            <Link
              href="/deck-builder"
              className="group flex items-center gap-3 rounded-xl border border-edison-border p-4 transition hover:border-edison-gold/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-edison-gold/10 text-edison-gold">
                <Layers3 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Deck Builder</p>
                <p className="text-xs text-gray-500">Criar e editar decks</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-600 transition group-hover:translate-x-1 group-hover:text-edison-gold" />
            </Link>
            <Link
              href="/shop"
              className="group flex items-center gap-3 rounded-xl border border-edison-border p-4 transition hover:border-edison-gold/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-400/10 text-purple-400">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Loja</p>
                <p className="text-xs text-gray-500">Encontrar novas cartas</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-600 transition group-hover:translate-x-1 group-hover:text-edison-gold" />
            </Link>
          </div>

          <div className="mt-5 rounded-xl bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Catálogo
            </p>
            <p className="mt-2 text-2xl font-bold">{catalogSize}</p>
            <p className="text-sm text-gray-400">cartas disponíveis</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
