import type { ReactNode } from "react";
import { cardArt } from "@/lib/card-art";

export type ArtTone = "gold" | "purple" | "blue" | "emerald" | "red";

// Classes estáticas (o Tailwind não enxerga classes montadas dinamicamente).
const TONES: Record<ArtTone, { border: string; overlay: string; emblem: string; eyebrow: string; title: string }> = {
  gold: {
    border: "border-amber-500/40",
    overlay: "from-amber-950/70 via-zinc-950/75",
    emblem: "border-amber-400/60 shadow-[0_0_30px_rgba(245,158,11,0.4)]",
    eyebrow: "text-amber-300",
    title: "text-amber-100",
  },
  purple: {
    border: "border-purple-500/40",
    overlay: "from-purple-950/70 via-zinc-950/75",
    emblem: "border-purple-400/60 shadow-[0_0_30px_rgba(168,85,247,0.4)]",
    eyebrow: "text-purple-300",
    title: "text-purple-100",
  },
  blue: {
    border: "border-blue-500/40",
    overlay: "from-blue-950/70 via-zinc-950/75",
    emblem: "border-blue-400/60 shadow-[0_0_30px_rgba(59,130,246,0.4)]",
    eyebrow: "text-blue-300",
    title: "text-blue-100",
  },
  emerald: {
    border: "border-emerald-500/40",
    overlay: "from-emerald-950/70 via-zinc-950/75",
    emblem: "border-emerald-400/60 shadow-[0_0_30px_rgba(16,185,129,0.4)]",
    eyebrow: "text-emerald-300",
    title: "text-emerald-100",
  },
  red: {
    border: "border-red-500/40",
    overlay: "from-red-950/70 via-zinc-950/75",
    emblem: "border-red-400/60 shadow-[0_0_30px_rgba(239,68,68,0.4)]",
    eyebrow: "text-red-300",
    title: "text-red-100",
  },
};

/**
 * Cabeçalho de página com arte de carta ao fundo, no mesmo estilo das salas do Random:
 * arte escurecida por um degradê da cor do tema, emblema redondo com a ilustração e
 * um zoom lento na arte. `art` é o passcode da carta; `position` ajusta o recorte.
 */
export function ArtBanner({
  art,
  emblemArt,
  eyebrow,
  title,
  subtitle,
  tone = "gold",
  position = "center 25%",
  children,
  className = "",
}: {
  art: number;
  /** Carta do emblema redondo; por padrão a mesma do fundo. */
  emblemArt?: number;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  tone?: ArtTone;
  position?: string;
  /** Conteúdo à direita (botões, cofre, deck equipado...). */
  children?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <header className={`group relative mb-6 overflow-hidden rounded-2xl border ${t.border} bg-zinc-950 ${className}`}>
      <img
        src={cardArt(art)}
        alt=""
        aria-hidden
        style={{ objectPosition: position }}
        className="pointer-events-none absolute inset-0 h-full w-full animate-banner-drift object-cover opacity-70"
      />
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${t.overlay} to-zinc-950/30`} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
      {/* filete dourado embaixo, o mesmo traço do GlassPanel */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent"
      />

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div
          className={`hidden h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 bg-zinc-950 sm:block ${t.emblem}`}
          role="img"
          aria-label=""
          style={{
            backgroundImage: `url(${cardArt(emblemArt ?? art)})`,
            backgroundSize: "cover",
            backgroundPosition: "center 20%",
          }}
        />
        <div className="min-w-0 flex-1 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
          {eyebrow && <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${t.eyebrow}`}>{eyebrow}</p>}
          <h1 className={`text-3xl font-black tracking-tight ${t.title}`}>{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-300">{subtitle}</p>}
        </div>
        {children && <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>}
      </div>
    </header>
  );
}
