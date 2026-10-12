// Ícones das moedas do jogo, com referência a Yu-Gi-Oh!. Usam currentColor:
// a cor vem da classe de texto de quem usa (âmbar para gold, roxo para crédito).

type IconProps = { className?: string };

/** Gold: moeda antiga com o Olho de Hórus (Wedjat) gravado no centro. */
export function GoldIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="16" cy="16" r="13.5" fill="currentColor" fillOpacity={0.14} />
      <circle cx="16" cy="16" r="10.5" strokeOpacity={0.55} strokeDasharray="1.6 2.4" strokeWidth={1.2} />
      {/* olho */}
      <path d="M7.5 15.5 C11 10.8 21 10.8 24.5 15.5 C21 20.2 11 20.2 7.5 15.5 Z" />
      <circle cx="16" cy="15.5" r="2.6" fill="currentColor" />
      {/* lágrima e espiral do Wedjat */}
      <path d="M13.2 19.6 L11.6 23.4" />
      <path d="M18.6 19.4 C21 20.4 21.6 22.8 19.6 23.6" />
    </svg>
  );
}

/** Crédito: pingente em pirâmide invertida, como o Enigma do Milênio, com o olho no centro. */
export function CreditIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {/* argola da corrente */}
      <circle cx="16" cy="3.6" r="2" strokeWidth={1.5} />
      {/* corpo */}
      <path d="M3.5 7.5 H28.5 L16 29.5 Z" fill="currentColor" fillOpacity={0.18} />
      <path d="M8.2 15.6 H23.8" strokeOpacity={0.45} strokeWidth={1.2} />
      {/* olho */}
      <path d="M10.8 11.2 C13.8 7.8 18.2 7.8 21.2 11.2 C18.2 14.6 13.8 14.6 10.8 11.2 Z" strokeWidth={1.5} />
      <circle cx="16" cy="11.2" r="1.7" fill="currentColor" />
    </svg>
  );
}
