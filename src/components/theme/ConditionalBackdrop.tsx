"use client";

import { usePathname } from "next/navigation";
import { PageBackdrop } from "@/components/theme/PageBackdrop";

// Seções que ficam sobre a arte de fundo. O conteúdo delas vai num GlassPanel.
// Deck builder e duelo ficam de fora: ali a arte atrapalharia a leitura.
const BACKDROP_ROUTES = ["/jornal", "/calendario", "/random", "/ranking", "/cla", "/shop", "/account", "/admin", "/perfil", "/torneios", "/mensagens", "/desafios"];

export function ConditionalBackdrop() {
  const pathname = usePathname();
  const show = BACKDROP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  return show ? <PageBackdrop /> : null;
}
