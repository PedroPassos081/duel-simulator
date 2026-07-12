import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-start gap-6 py-16">
      <h1 className="text-4xl font-bold">Edison Duel Simulator</h1>
      <p className="max-w-2xl text-gray-400">
        Monte decks do formato Edison, valide contra a banlist, e (em breve) jogue partidas
        automáticas 1v1 no navegador. Projeto de fã, sem afiliação com a Konami.
      </p>
      <div className="flex gap-4">
        <Link
          href="/deck-builder"
          className="rounded bg-edison-gold px-5 py-2 font-medium text-black hover:opacity-90"
        >
          Abrir Deck Builder
        </Link>
        <Link
          href="/shop"
          className="rounded border border-edison-border px-5 py-2 hover:bg-edison-panel"
        >
          Ver Loja
        </Link>
      </div>
    </div>
  );
}
