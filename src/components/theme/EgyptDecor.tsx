import { Ankh, EyeOfHorus, MillenniumPyramid } from "@/components/theme/EgyptIcons";

/** Faixa decorativa com símbolos egípcios repetidos (ankh · olho · pirâmide). */
export function EgyptBand({ className = "" }: { className?: string }) {
  const symbols = Array.from({ length: 12 }, (_, i) => i % 3);
  return (
    <div className={`flex items-center justify-between overflow-hidden text-amber-500/35 ${className}`} aria-hidden>
      {symbols.map((s, i) =>
        s === 0 ? (
          <Ankh key={i} className="h-4 w-3 shrink-0" />
        ) : s === 1 ? (
          <EyeOfHorus key={i} className="h-3 w-5 shrink-0" />
        ) : (
          <MillenniumPyramid key={i} className="h-4 w-4 shrink-0" />
        )
      )}
    </div>
  );
}

/** Cartucho: a moldura oval onde os egípcios escreviam nomes. Usado para o nome do mês. */
export function Cartouche({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full border-2 border-amber-500/60 bg-amber-500/5 px-5 py-1 font-bold text-amber-200 shadow-[inset_0_0_12px_rgba(245,158,11,0.15)] ${className}`}
    >
      {children}
      {/* barra do cartucho */}
      <span className="absolute -right-1.5 top-1/2 h-[70%] w-1 -translate-y-1/2 rounded-full bg-amber-500/60" aria-hidden />
    </span>
  );
}
