/**
 * Arte de fundo fixa atrás da página. Fica em -z-10 no contexto de empilhamento
 * raiz, então passa por baixo da navbar e de todo o conteúdo. As faixas escuras
 * em cima e embaixo fazem a arte "sumir" na navbar e no fim da tela.
 * Quais rotas mostram a arte fica em ConditionalBackdrop.
 */
export function PageBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[url('/backgrounds/egypt-gold.webp')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent via-40% to-black/60" />
    </div>
  );
}

/**
 * Painel de vidro escuro que envolve o conteúdo de uma página com arte de fundo.
 * Já traz o espaçamento da página; passe a largura máxima em `className` (ex.: "max-w-6xl").
 * Atenção: backdrop-filter vira o bloco de contenção de filhos `position: fixed`,
 * então modais e overlays devem ir para o body com createPortal.
 */
export function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative mx-auto rounded-2xl border border-amber-500/20 bg-zinc-950/60 p-4 shadow-2xl shadow-black/70 backdrop-blur-md sm:my-4 sm:p-8 ${className}`}
    >
      {/* filete dourado no topo, o mesmo traço das linhas da arte */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent"
      />
      {children}
    </div>
  );
}
