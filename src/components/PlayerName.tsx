import { nameEffectClass } from "@/lib/cosmetic-types";

interface PlayerNameProps {
  name?: string | null;
  // Efeito do item "Estilo do nick" equipado (gold, rainbow...)
  effect?: string | null;
  className?: string;
}

/** Nome do jogador com o estilo de nick equipado. Use sempre que exibir um jogador. */
export function PlayerName({ name, effect, className = "" }: PlayerNameProps) {
  return (
    <span className={`${nameEffectClass(effect)} ${className}`.trim()}>
      {name ? `@${name}` : "Duelista"}
    </span>
  );
}
