import Link from "next/link";
import { CircleDollarSign, Gem } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CREDIT_LABEL_PLURAL } from "@/lib/shop-rules";
import { Avatar } from "@/components/Avatar";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { PlayerName } from "@/components/PlayerName";
import { countPendingApprovals } from "@/lib/clans/service";

export async function Navbar() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  // Uma sessão JWT pode sobreviver a um reset/troca do banco. Antes de criar
  // a carteira, confirme que o usuário da sessão ainda existe para não violar
  // a chave estrangeira Wallet_userId_fkey.
  const currentUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, ...userAvatarSelect },
      })
    : null;

  const wallet = currentUser
    ? await prisma.wallet.upsert({
        where: { userId: currentUser.id },
        update: {},
        create: { userId: currentUser.id },
      })
    : null;

  // Pedidos do clã esperando a resposta deste jogador (líder/vice)
  const clanApprovals = currentUser ? await countPendingApprovals(currentUser.id) : 0;

  return (
    <header className="border-b border-edison-border bg-edison-panel">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <nav className="flex min-w-0 items-center gap-4 overflow-x-auto sm:gap-6">
          <Link href="/" className="shrink-0 whitespace-nowrap text-lg font-semibold tracking-tight text-white hover:opacity-90">
            Duel Simulator
          </Link>
          <Link href="/jornal" className="text-sm text-gray-300 hover:text-white transition-colors">
            Jornal
          </Link>
          <Link href="/calendario" className="text-sm text-gray-300 hover:text-white transition-colors">
            Calendário
          </Link>
          <Link href="/random" className="text-sm text-gray-300 hover:text-white transition-colors">
            Random
          </Link>
          <Link href="/ranking" className="text-sm text-gray-300 hover:text-white transition-colors">
            Ranking
          </Link>
          <Link href="/cla" className="flex shrink-0 items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors">
            Clã
            {clanApprovals > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white" title="Pedidos aguardando sua resposta">
                {clanApprovals}
              </span>
            )}
          </Link>
          <Link href="/deck-builder" className="text-sm text-gray-300 hover:text-white transition-colors">
            Deck
          </Link>
          <Link href="/shop" className="text-sm text-gray-300 hover:text-white transition-colors">
            Loja
          </Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-4 text-sm">
          {session?.user && currentUser ? (
            <>
              {wallet && (
                <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800">
                  {/* GOLD */}
                  <span className="flex items-center gap-1.5 font-bold text-amber-400">
                    <CircleDollarSign className="w-4 h-4 text-amber-400" />
                    <span>{wallet.gold}</span>
                  </span>

                  <span className="text-zinc-700">|</span>

                  {/* CRÉDITO */}
                  <span className="flex items-center gap-1.5 font-bold text-purple-400" title={CREDIT_LABEL_PLURAL}>
                    <Gem className="w-4 h-4 text-purple-400" />
                    <span>{wallet.cash}</span>
                  </span>
                </div>
              )}

              <Link
                href="/account"
                title="Minha conta"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <Avatar {...toAvatarProps(currentUser)} size={28} />
                <span className="hidden sm:inline">
                  <PlayerName {...toPlayerNameProps(currentUser)} className="font-semibold" />
                </span>
              </Link>

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
