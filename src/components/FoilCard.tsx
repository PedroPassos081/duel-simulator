"use client";

import { useRef } from "react";
import type { Border, Finish } from "@/lib/card-finish";

/**
 * Carta com o brilho da raridade e a borda (efeitos em .foil-* no globals.css).
 * interactive: a carta inclina e o reflexo segue o mouse. Desligue em listas
 * dentro de botões (Deck Builder), onde só o brilho animado basta.
 */
export function FoilCard({
  src,
  alt = "",
  finish = "normal",
  border = "none",
  interactive = true,
  className = "",
}: {
  src: string | null;
  alt?: string;
  finish?: Finish;
  border?: Border;
  interactive?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
    el.classList.add("is-active");
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.classList.remove("is-active");
  }

  return (
    <div className={`foil-wrap ${className}`}>
      <div
        ref={ref}
        className={`foil-card foil-${finish} border-${border}`}
        onPointerMove={interactive ? onMove : undefined}
        onPointerLeave={interactive ? onLeave : undefined}
      >
        {src ? (
          <img src={src} alt={alt} draggable={false} loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-800 p-2 text-center text-xs text-zinc-500">{alt}</div>
        )}
        {finish !== "normal" && <div className="foil-holo" />}
        {finish === "ultra" && <div className="foil-art" />}
        {finish === "secreta" && <div className="foil-sparkle" />}
        {interactive && <div className="foil-glare" />}
        {border !== "none" && <div className="foil-border" />}
      </div>
    </div>
  );
}
