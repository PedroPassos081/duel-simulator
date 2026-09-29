import Image from "next/image";
import Link from "next/link";
import { CircleDollarSign, Gem, LogOut } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CREDIT_LABEL_PLURAL } from "@/lib/shop-rules";
import { Avatar } from "@/components/Avatar";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { PlayerName } from "@/components/PlayerName";
import { DesktopNavLinks, MobileNavMenu } from "@/components/NavLinks";
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

  async function logout() {
    "use server";
    await signOut();
  }

  return (
    <header className="sticky top-0 z-40 bg-black/75 backdrop-blur-md">
      {/* filete dourado na base, o mesmo traço do topo do GlassPanel */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 xl:gap-6">
        <MobileNavMenu
          clanApprovals={clanApprovals}
          // No celular não cabe no header, então o "Sair" vai para dentro do menu
          footer={
            currentUser && (
              <form action={logout} className="border-t border-white/10 px-3 py-2 sm:hidden">
                <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-red-300 transition-colors hover:bg-red-500/10">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </form>
            )
          }
        />

        <Link href="/" className="flex shrink-0 items-center gap-2.5 hover:opacity-90">
          <Image
            src="/icon.png"
            alt="Emblema Master Duelist"
            width={36}
            height={36}
            className="h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(224,178,60,0.35)]"
          />
          <span className="hidden leading-none sm:inline">
            <span className="block bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-base font-black uppercase tracking-[0.12em] text-transparent">
              Master
            </span>
            <span className="mt-0.5 block text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-zinc-300">Duelist</span>
          </span>
        </Link>

        <span aria-hidden className="hidden h-7 w-px bg-gradient-to-b from-transparent via-amber-500/50 to-transparent xl:block" />
        <DesktopNavLinks clanApprovals={clanApprovals} />

        <div className="ml-auto flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          {session?.user && currentUser ? (
            <>
              {wallet && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-black/40 px-2 py-1.5 sm:gap-3 sm:px-3">
                  {/* GOLD */}
                  <span className="flex items-center gap-1.5 font-bold text-amber-400">
                    <CircleDollarSign className="w-4 h-4 text-amber-400" />
                    <span>{wallet.gold}</span>
                  </span>

                  <span className="h-4 w-px bg-white/10" />

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
                className="flex items-center gap-2 text-zinc-300 transition-colors hover:text-amber-100"
              >
                <Avatar {...toAvatarProps(currentUser)} size={30} />
                <span className="hidden sm:inline">
                  <PlayerName {...toPlayerNameProps(currentUser)} className="font-semibold" />
                </span>
              </Link>

              <form action={logout} className="hidden sm:block">
                <button
                  title="Sair"
                  aria-label="Sair"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-300 transition-colors hover:text-amber-100"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-2 text-[13px] font-bold uppercase tracking-[0.08em] text-black shadow-[0_0_14px_rgba(245,158,11,0.3)] transition hover:brightness-110 sm:px-4"
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
