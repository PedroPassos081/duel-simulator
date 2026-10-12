/**
 * Caixa de Structure Deck em 3D (CSS puro): frente com a arte da carta de capa,
 * lombada com o nome e um reflexo que passa no hover. Gira um pouco ao passar o mouse.
 */
export function StructureBox({
  name,
  coverImageUrl,
  cardCount,
  className = "",
}: {
  name: string;
  coverImageUrl: string | null;
  cardCount: number;
  className?: string;
}) {
  // "Elemental HERO: Chama Alada" → título grande "Chama Alada", série "Elemental HERO"
  // A capa vem da carta inteira; a janela da caixa mostra só a ilustração
  const artUrl = coverImageUrl?.replace("/images/cards/", "/images/cards_cropped/") ?? null;
  const [series, title] = name.includes(":") ? name.split(":").map((s) => s.trim()) : ["", name];

  return (
    <div className={`group/box relative mx-auto h-64 w-48 [perspective:1000px] ${className}`}>
      {/* sombra no chão */}
      <div className="absolute -bottom-3 left-2 right-0 h-4 rounded-[50%] bg-black/60 blur-md transition-all duration-700 group-hover/box:scale-x-90" />

      <div className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] [transform:rotateY(-26deg)_rotateX(4deg)] group-hover/box:[transform:rotateY(-10deg)_rotateX(2deg)]">
        {/* TAMPA (fica atrás, dá espessura) */}
        <div className="absolute inset-0 rounded-[3px] bg-red-950 [transform:translateZ(-18px)]" />

        {/* LOMBADA */}
        <div className="absolute left-0 top-0 flex h-full w-[36px] origin-left items-center justify-center overflow-hidden rounded-l-[3px] border-y border-l border-amber-300/50 bg-gradient-to-b from-red-800 via-red-900 to-red-950 [transform:rotateY(90deg)_translateX(-36px)] [transform-origin:left]">
          <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.25em] text-amber-200 [writing-mode:vertical-rl]">
            {title}
          </span>
        </div>

        {/* FRENTE */}
        <div className="absolute inset-0 overflow-hidden rounded-[3px] border-2 border-amber-300/70 bg-gradient-to-b from-red-700 via-red-900 to-zinc-950 shadow-[0_18px_40px_rgba(0,0,0,0.6)] [transform:translateZ(0)]">
          {/* faixa de série */}
          <div className="relative z-10 flex items-center justify-between bg-gradient-to-r from-black/70 via-black/40 to-black/70 px-3 py-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Structure Deck</span>
            <span className="rounded bg-amber-400 px-1 text-[8px] font-black text-black">{cardCount} cartas</span>
          </div>

          {/* janela de arte */}
          <div className="relative mx-2 mt-2 h-[58%] overflow-hidden rounded-sm border border-amber-200/60 bg-zinc-900">
            {artUrl && (
              <img src={artUrl} alt={name} className="h-full w-full object-cover object-[center_15%] transition-transform duration-700 group-hover/box:scale-110" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-red-950/70 via-transparent to-transparent" />
          </div>

          {/* título */}
          <div className="relative z-10 px-3 pt-2 text-center [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">
            {series && <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-200/90">{series}</p>}
            <p className="text-xl font-black uppercase leading-tight tracking-tight text-white">{title}</p>
          </div>

          {/* reflexo */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-1000 group-hover/box:translate-x-full" />
        </div>
      </div>
    </div>
  );
}
