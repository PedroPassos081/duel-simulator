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

/**
 * Saquinho de couro antigo com o Olho de Hórus, soltando pó mágico.
 * Ícone dos itens de evolução (Pó do Milênio).
 */
export function MillenniumPouch({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {/* boca franzida do saco */}
      <path d="M9 7.2 C9.4 5.2 10.6 4.4 12 5.1 C13.4 4.4 14.6 5.2 15 7.2" />
      {/* corpo do saco */}
      <path d="M8.2 9.3 C4.6 11.4 3.9 16.8 5.9 19.4 C7.6 21.5 16.4 21.5 18.1 19.4 C20.1 16.8 19.4 11.4 15.8 9.3" fill="currentColor" fillOpacity={0.12} />
      {/* cordão amarrado e a ponta solta */}
      <path d="M8 9.2 C10.5 10.4 13.5 10.4 16 9.2 M16 9.2 L17.6 11.6 M16 9.2 L18.3 10.1" />
      {/* Olho de Hórus gravado */}
      <path d="M9 15 C10.8 13.3 13.2 13.3 15 15 C13.2 16.6 10.8 16.6 9 15 Z" strokeWidth={1.3} />
      <circle cx="12" cy="15" r="0.95" fill="currentColor" stroke="none" />
      <path d="M11.2 16.4 L10.5 18.1" strokeWidth={1.2} />
      {/* pó brilhando */}
      <circle cx="18.6" cy="4.3" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="20.4" cy="7" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="5.6" cy="5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
