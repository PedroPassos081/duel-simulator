"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Dices,
  Layers,
  Menu,
  Newspaper,
  Shield,
  Store,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";

const NAV_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/jornal", label: "Jornal", icon: Newspaper },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/random", label: "Random", icon: Dices },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/cla", label: "Clã", icon: Shield },
  { href: "/deck-builder", label: "Deck", icon: Layers },
  { href: "/shop", label: "Loja", icon: Store },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Pedidos do clã esperando a resposta deste jogador (líder/vice). */
function ClanBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 tracking-normal text-white"
      title="Pedidos aguardando sua resposta"
    >
      {count}
    </span>
  );
}

/** Links do header em telas largas. A seção atual ganha um losango dourado em cima do filete do header. */
export function DesktopNavLinks({ clanApprovals }: { clanApprovals: number }) {
  const isActive = useIsActive();
  return (
    <nav className="hidden items-center gap-6 xl:flex">
      {NAV_LINKS.map(({ href, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-16 items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              active ? "text-amber-300" : "text-zinc-400 hover:text-amber-100"
            }`}
          >
            {label}
            {href === "/cla" && <ClanBadge count={clanApprovals} />}
            {active && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-x-3 bottom-0 h-10 bg-[radial-gradient(ellipse_at_bottom,rgba(245,158,11,0.22),transparent_70%)]"
                />
                <span
                  aria-hidden
                  className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rotate-45 bg-amber-300 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]"
                />
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Menu recolhível para telas estreitas: o botão fica no header e a lista abre logo abaixo dele.
 * `footer` aparece depois dos links (o Navbar põe o "Sair" ali no celular).
 */
export function MobileNavMenu({ clanApprovals, footer }: { clanApprovals: number; footer?: React.ReactNode }) {
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition-colors hover:border-amber-500/40 hover:text-amber-200"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          {/* Posicionados pelo header (e não `fixed`): o backdrop-filter dele prenderia um `fixed` na própria caixa. */}
          <div aria-hidden onClick={close} className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] bg-black/50" />
          <nav className="absolute inset-x-0 top-full border-b border-amber-500/20 bg-black shadow-2xl shadow-black/70">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-1 p-3 sm:grid-cols-4">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                      active ? "bg-amber-500/10 text-amber-300" : "text-zinc-300 hover:bg-white/5 hover:text-amber-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                    {href === "/cla" && <ClanBadge count={clanApprovals} />}
                  </Link>
                );
              })}
            </div>
            {footer}
          </nav>
        </>
      )}
    </div>
  );
}
