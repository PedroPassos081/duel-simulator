import type { CSSProperties } from "react";

/**
 * Visual dos cosméticos de duelo. O banco guarda só a URL da arte (imageUrl);
 * o acabamento (borda do sleeve, zonas do playmat) é desenhado aqui.
 */

/**
 * Arte de um cosmético. "split:urlA|urlB" = duas artes divididas na diagonal com um
 * "VS" no meio (ex.: Dark Magician vs Blue-Eyes); senão, uma imagem só.
 */
export function CosmeticArtImage({ url, className = "", position = "center 25%" }: { url: string; className?: string; position?: string }) {
  if (url.startsWith("split:")) {
    const [left, right] = url.slice(6).split("|");
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
        <img src={left} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position, clipPath: "polygon(0 0, 58% 0, 42% 100%, 0 100%)" }} loading="lazy" />
        <img src={right} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position, clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)" }} loading="lazy" />
        {/* risco dourado na diagonal e o selo VS */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <line x1="58" y1="0" x2="42" y2="100" stroke="#fbbf24" strokeWidth="1.4" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 3px rgba(251,191,36,0.9))" }} />
        </svg>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300 bg-black/80 px-1.5 text-[clamp(8px,2.2vw,14px)] font-black italic text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.7)]">
          VS
        </span>
      </div>
    );
  }
  return <img src={url} alt="" aria-hidden className={`absolute inset-0 h-full w-full object-cover ${className}`} style={{ objectPosition: position }} loading="lazy" />;
}

/** Verso de carta com a arte do sleeve: proporção 59:86, moldura dourada e brilho. */
export function SleeveView({ url, className = "h-full" }: { url?: string | null; className?: string }) {
  return (
    <div
      className={`relative aspect-[59/86] overflow-hidden rounded-[5%] border-2 border-amber-400/70 bg-zinc-950 shadow-[0_4px_14px_rgba(0,0,0,0.6)] ${className}`}
    >
      {url && <CosmeticArtImage url={url} />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/60" />
      <span className="pointer-events-none absolute inset-[6%] rounded-[4%] border border-amber-200/40" />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/15 to-transparent" />
    </div>
  );
}

// Cores por tema de playmat (campo `effect` do cosmético): linhas das zonas e tinta sobre a arte.
const PLAYMAT_THEMES: Record<string, { line: string; tint: string }> = {
  brasil: {
    line: "#ffdf00",
    tint: "linear-gradient(180deg, rgba(0,80,40,0.55), rgba(0,30,90,0.55))",
  },
  // Dragão Arco-Íris: linhas brancas cristalinas sobre um brilho de arco-íris
  arcoiris: {
    line: "#f0f9ff",
    tint: "linear-gradient(135deg, rgba(239,68,68,0.35), rgba(250,204,21,0.3), rgba(34,197,94,0.3), rgba(59,130,246,0.35), rgba(168,85,247,0.4))",
  },
  // Roid do Syrus: linhas azul-aço sobre um azul de oficina
  roid: {
    line: "#7dd3fc",
    tint: "linear-gradient(180deg, rgba(12,74,110,0.55), rgba(15,23,42,0.6))",
  },
  // Passe de Batalha "O Despertar do Faraó": ouro sobre um roxo de templo
  farao: {
    line: "#fbbf24",
    tint: "linear-gradient(180deg, rgba(59,7,100,0.5), rgba(20,10,30,0.6))",
  },
  // Dark Magician: linhas magenta sobre roxo
  darkmagician: {
    line: "#f0abfc",
    tint: "linear-gradient(180deg, rgba(76,29,149,0.45), rgba(20,8,40,0.6))",
  },
  // Blue-Eyes: linhas de gelo sobre azul profundo
  blueeyes: {
    line: "#bae6fd",
    tint: "linear-gradient(180deg, rgba(30,64,175,0.4), rgba(8,15,35,0.6))",
  },
  // Dark Magician vs Blue-Eyes: roxo de um lado, azul do outro
  versus: {
    line: "#fde68a",
    tint: "linear-gradient(115deg, rgba(76,29,149,0.45), rgba(10,10,20,0.35) 50%, rgba(30,64,175,0.45))",
  },
  default: {
    line: "#e0b23c",
    tint: "linear-gradient(180deg, rgba(10,10,20,0.5), rgba(10,10,20,0.6))",
  },
};

/** Zonas de um tapete de duelo (visão de um lado): 5 monstros, 5 mágicas/armadilhas, campo, cemitério, deck e extra. */
function PlaymatZones({ color }: { color: string }) {
  const zone = (x: number, y: number, w = 15, h = 21) => (
    <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={1.2} />
  );
  return (
    <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full" fill="none" stroke={color} strokeWidth={0.5} aria-hidden>
      <g opacity={0.85}>
        {/* monstros */}
        {[0, 1, 2, 3, 4].map((i) => zone(42 + i * 17.5, 26, 15, 21))}
        {/* mágicas e armadilhas */}
        {[0, 1, 2, 3, 4].map((i) => zone(42 + i * 17.5, 50, 15, 21))}
        {/* campo, cemitério, deck, extra */}
        {zone(20, 50, 16, 21)}
        {zone(128, 50, 16, 21)}
        {zone(128, 26, 16, 21)}
        {zone(20, 26, 16, 21)}
      </g>
      <line x1={8} y1={45} x2={152} y2={45} strokeOpacity={0.35} strokeDasharray="1.5 2" />
      {/* cantos */}
      <path d="M4 12 V4 H12 M148 4 H156 V12 M156 78 V86 H148 M12 86 H4 V78" strokeWidth={0.9} />
    </svg>
  );
}

/** Tapete de duelo: arte + tinta do tema + zonas, no estilo dos tapetes oficiais de campeonato. */
export function PlaymatView({
  url,
  theme,
  zones = true,
  className = "w-full",
  style,
}: {
  url?: string | null;
  theme?: string | null;
  /** Desenha as zonas por cima (desligue no tabuleiro do duelo, que já tem as suas). */
  zones?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const t = PLAYMAT_THEMES[theme ?? ""] ?? PLAYMAT_THEMES.default;
  return (
    <div className={`relative aspect-video overflow-hidden rounded-lg border border-amber-500/40 bg-zinc-950 ${className}`} style={style}>
      {url && <CosmeticArtImage url={url} position="center 20%" />}
      <div className="absolute inset-0" style={{ background: t.tint }} />
      {zones && <PlaymatZones color={t.line} />}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

/** Estilo (background) para usar a arte de um playmat como fundo de outra área, como o tabuleiro. */
export function playmatTint(theme?: string | null) {
  return (PLAYMAT_THEMES[theme ?? ""] ?? PLAYMAT_THEMES.default).tint;
}
