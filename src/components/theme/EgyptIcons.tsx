// Ícones temáticos (Yu-Gi-Oh clássico / Egito), desenhados à mão em SVG simples.
// Usam currentColor: a cor vem da classe de texto de quem usa.

type IconProps = { className?: string };

/** Olho de Hórus (Wedjat). */
export function EyeOfHorus({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 64 40" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 16 C16 4, 40 2, 60 12" />
      <path d="M8 20 C18 10, 38 9, 52 18 C40 28, 20 28, 8 20 Z" />
      <circle cx="30" cy="19" r="5" fill="currentColor" />
      <path d="M26 27 L22 38" />
      <path d="M36 26 C42 30, 44 36, 38 38 C34 39, 33 35, 36 34" />
    </svg>
  );
}

/** Pirâmide invertida com o olho (item do milênio). */
export function MillenniumPyramid({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 8 H44 L24 44 Z" />
      <path d="M10 18 H38 M16 29 H32" strokeOpacity={0.5} />
      <path d="M15 14 C20 9, 28 9, 33 14 C28 19, 20 19, 15 14 Z" />
      <circle cx="24" cy="14" r="2.2" fill="currentColor" />
    </svg>
  );
}

/** Ankh. */
export function Ankh({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 32 48" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" className={className} aria-hidden>
      <ellipse cx="16" cy="11" rx="7" ry="9" />
      <path d="M16 20 V46 M4 24 H28" />
    </svg>
  );
}

/** Obelisco (Sala Obelisco). */
export function ObeliskIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 40 64" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 2 L27 12 L25 56 H15 L13 12 Z" />
      <path d="M13 12 H27" />
      <path d="M8 56 H32 V62 H8 Z" />
      <path d="M17 22 H23 M17 30 H23 M17 38 H23 M17 46 H23" strokeOpacity={0.55} />
    </svg>
  );
}

/** Dragão serpente enrolado (Sala Slifer). */
export function SkyDragonIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {/* corpo em espiral */}
      <path d="M50 44 C58 30, 50 12, 32 12 C16 12, 8 26, 14 38 C20 50, 38 50, 42 38 C45 29, 38 22, 31 24 C25 26, 25 34, 31 35" />
      {/* cabeça e mandíbulas */}
      <path d="M50 44 L58 50 M50 44 L54 54" />
      <path d="M44 20 L52 6 L50 16" />
      <circle cx="47" cy="40" r="1.8" fill="currentColor" />
    </svg>
  );
}
