/** Caixinha de Structure Deck: caixa de papelão aberta com uma carta saindo. Usa currentColor. */
export function BoxIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" className={className} aria-hidden>
      {/* carta saindo da caixa */}
      <path d="M17 17 L20 4 L32 7 L29 20" strokeOpacity={0.9} />
      <path d="M22 8 L28 9.5" strokeOpacity={0.5} />
      {/* frente e laterais */}
      <path d="M6 20 L24 26 L42 20 L42 37 L24 44 L6 37 Z" />
      <path d="M24 26 V44" />
      {/* abas abertas */}
      <path d="M6 20 L2 15 L20 10 L24 16 Z" strokeOpacity={0.75} />
      <path d="M42 20 L46 15 L28 10 L24 16 Z" strokeOpacity={0.75} />
      {/* etiqueta */}
      <path d="M10 30 L18 33" strokeOpacity={0.55} />
    </svg>
  );
}
