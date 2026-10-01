"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { BAN_STATUS_INFO, type BanStatus } from "@/lib/banlist-shared";

export interface BanlistCard {
  cardId: number;
  name: string;
  imageUrl: string | null;
  status: string;
}

const SECTIONS: { status: BanStatus; title: string; ring: string }[] = [
  { status: "forbidden", title: "Proibidas", ring: "ring-red-500/70" },
  { status: "limited", title: "Limitadas · 1 cópia", ring: "ring-orange-500/70" },
  { status: "semi-limited", title: "Semi-limitadas · 2 cópias", ring: "ring-yellow-400/70" },
];

/** Banlist em imagens: as cartas de cada status, com a marca de quantas cópias valem. Clique para ampliar. */
export function BanlistGallery({ title, cards, onClose }: { title: string; cards: BanlistCard[]; onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const [zoom, setZoom] = useState<BanlistCard | null>(null);

  // Esc fecha (primeiro a carta ampliada, depois a banlist) e a página não rola por trás
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoom) setZoom(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [zoom, onClose]);

  const visible = cards.filter((c) => c.name.toLowerCase().includes(filter.trim().toLowerCase()));

  // Portal: o blur dos painéis prenderia um modal "fixed" dentro deles
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-950 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <h2 className="text-lg font-black text-amber-200">{title}</h2>
          <span className="text-xs text-zinc-500">{cards.length} cartas com restrição · as demais são livres (3 cópias)</span>
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-zinc-500" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Procurar carta..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-col gap-6 overflow-y-auto p-4">
          {cards.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">Esta sala ainda não tem restrições: todas as cartas são livres.</p>}
          {SECTIONS.map(({ status, title: sectionTitle, ring }) => {
            const list = visible.filter((c) => c.status === status);
            if (list.length === 0) return null;
            const info = BAN_STATUS_INFO[status];
            return (
              <section key={status}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-300">
                  <span className={`rounded border px-1.5 py-px text-[11px] ${info.className}`}>{status === "forbidden" ? "✕" : info.short}</span>
                  {sectionTitle} <span className="text-zinc-600">({list.length})</span>
                </h3>
                <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  {list.map((c) => (
                    <li key={c.cardId}>
                      <button onClick={() => setZoom(c)} title={c.name} className={`group relative block w-full overflow-hidden rounded-md ring-2 ${ring} transition hover:scale-105 hover:ring-4`}>
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.name} loading="lazy" className={`aspect-[59/86] w-full object-cover ${status === "forbidden" ? "grayscale-[35%]" : ""}`} />
                        ) : (
                          <span className="flex aspect-[59/86] w-full items-center justify-center bg-zinc-800 p-1 text-center text-[10px] text-zinc-300">{c.name}</span>
                        )}
                        {/* Marca de cópias no canto, como no jogo */}
                        <span className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-black shadow-lg ${info.className} bg-black/85`}>
                          {status === "forbidden" ? "✕" : info.short}
                        </span>
                      </button>
                      <p className="mt-1 truncate text-[10px] text-zinc-400" title={c.name}>
                        {c.name}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {cards.length > 0 && visible.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Nenhuma carta com esse nome na banlist.</p>}
        </div>
      </div>

      {/* Carta ampliada */}
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6" onClick={(e) => (e.stopPropagation(), setZoom(null))}>
          <div className="flex flex-col items-center gap-3">
            {zoom.imageUrl && <img src={zoom.imageUrl} alt={zoom.name} className="max-h-[75vh] w-auto rounded-xl shadow-2xl" />}
            <p className="flex items-center gap-2 text-sm font-bold text-zinc-100">
              {zoom.name}
              <span className={`rounded border px-1.5 py-px text-[11px] ${BAN_STATUS_INFO[(zoom.status as BanStatus) ?? "unlimited"]?.className ?? ""}`}>
                {BAN_STATUS_INFO[zoom.status as BanStatus]?.label ?? zoom.status}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
