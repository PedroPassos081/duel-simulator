import Link from "next/link";
import { nameEffectClass } from "@/lib/cosmetic-types";

interface PlayerNameProps {
  name?: string | null;
  // Efeito do item "Estilo do nick" equipado (gold, rainbow...)
  effect?: string | null;
  className?: string;
  // @usuário: o nome vira link para o perfil público
  profile?: string | null;
  // false quando o nome já está dentro de outro link (ex.: a barra do topo)
  link?: boolean;
}

/** Nome do jogador com o estilo de nick equipado. Use sempre que exibir um jogador. */
export function PlayerName({ name, effect, className = "", profile, link = true }: PlayerNameProps) {
  const text = name ? `@${name}` : "Duelista";
  const classes = `${nameEffectClass(effect)} ${className}`.trim();
  if (profile && link) {
    return (
      <Link href={`/perfil/${encodeURIComponent(profile)}`} className={`${classes} hover:underline`} title={`Ver perfil de @${profile}`}>
        {text}
      </Link>
    );
  }
  return <span className={classes}>{text}</span>;
}
