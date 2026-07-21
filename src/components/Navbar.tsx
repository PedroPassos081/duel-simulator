import Link from "next/link";
import { CircleDollarSign, Gem } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function Navbar() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  const wallet = userId
    ? await prisma.wallet.upsert({ where: { userId }, update: {}, create: { userId } })
    : null;

  return (
    <header className="border-b border-edison-border bg-edison-panel">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white hover:opacity-90">
            Duel Simulator
          </Link>
          <Link href="/deck-builder" className="text-sm text-gray-300 hover:text-white transition-colors">
            Deck
          </Link>
          <Link href="/shop" className="text-sm text-gray-300 hover:text-white transition-colors">
            Loja
          </Link>
        </nav>

        <div className="flex items-center gap-4 text-sm">
          {session?.user ? (
            <>
              {wallet && (
                <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800">
                  {/* GOLD */}
                  <span className="flex items-center gap-1.5 font-bold text-amber-400">
                    <CircleDollarSign className="w-4 h-4 text-amber-400" />
                    <span>{wallet.gold}</span>
                  </span>

                  <span className="text-zinc-700">|</span>

                  {/* GEM */}
                  <span className="flex items-center gap-1.5 font-bold text-purple-400">
                    <Gem className="w-4 h-4 text-purple-400" />
                    <span>{wallet.cash}</span>
                  </span>
                </div>
              )}

              <span className="text-gray-400">{session.user.email}</span>

              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button className="rounded border border-edison-border px-3 py-1 text-gray-200 hover:bg-zinc-800 transition-colors">
                  Sair
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-white transition-colors">
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded bg-edison-gold px-3 py-1 font-medium text-black hover:opacity-90 transition-opacity"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}