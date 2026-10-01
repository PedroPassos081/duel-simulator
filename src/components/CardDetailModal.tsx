"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { FoilCard } from "@/components/FoilCard";
import { EyeOfHorus } from "@/components/theme/EgyptIcons";
import { FINISHES } from "@/lib/card-finish";
import { SPELL_TRAP_LABELS, copyLimit, monsterTypeLabel } from "@/lib/card-filters";
import { RoomBanlistStatus } from "@/components/RoomBanlistStatus";
import type { Card } from "@/types/card";

const ATTRIBUTE_STYLES: Record<string, string> = {
  LIGHT: "border-yellow-300/40 bg-yellow-300/10 text-yellow-200",
  DARK: "border-purple-400/40 bg-purple-400/10 text-purple-300",
  WATER: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  FIRE: "border-red-400/40 bg-red-400/10 text-red-300",
  EARTH: "border-amber-700/50 bg-amber-700/10 text-amber-500",
  WIND: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  DIVINE: "border-amber-300/50 bg-amber-300/10 text-amber-200",
};

/** Botão do olho (Olho de Hórus) que abre os detalhes da carta. */
export function CardInfoButton({ onClick, name }: { onClick: () => void; name: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={`Ver efeito de ${name}`}
      aria-label={`Ver efeito de ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      className="absolute left-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/60 bg-black/80 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)] transition hover:scale-110 hover:bg-amber-500 hover:text-black"
    >
      <EyeOfHorus className="h-2 w-3.5" />
    </span>
  );
}

/**
 * Detalhes da carta: imagem com o brilho da melhor cópia, características e o texto do efeito.
 * `actions` são os botões do rodapé (ex.: adicionar ao Main/Side, remover do deck).
 */
export function CardDetailModal({ card, onClose, actions }: { card: Card; onClose: () => void; actions?: React.ReactNode }) {
  // Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isMonster = card.type.includes("Monster");
  const isXyz = card.type.includes("XYZ");
  const isLink = card.type.includes("Link");
  const kind = card.type.includes("Spell") ? "Mágica" : card.type.includes("Trap") ? "Armadilha" : null;
  const limit = copyLimit({ card, ownedQuantity: card.ownedQuantity ?? 0, maxTotal: card.maxTotal });
  const variant = card.bestVariant;

  // Vai para o body: dentro de um painel com backdrop-filter o `fixed` ficaria preso
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label={card.name}>
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-900 shadow-[0_0_40px_rgba(245,158,11,0.12)] md:flex-row">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* CARTA */}
        <div className="flex shrink-0 items-center justify-center border-b border-zinc-800 bg-zinc-950/60 p-6 md:w-[45%] md:border-b-0 md:border-r">
          <FoilCard src={card.imageUrl} alt={card.name} finish={variant?.finish} border={variant?.border} className="w-full max-w-[240px]" />
        </div>

        {/* DETALHES */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div>
            <h2 className="pr-8 text-2xl font-bold leading-tight text-zinc-100">{card.name}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{card.type}</p>
          </div>

          {/* CARACTERÍSTICAS */}
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {card.attribute && (
              <span className={`rounded-md border px-2 py-1 ${ATTRIBUTE_STYLES[card.attribute] ?? "border-zinc-700 text-zinc-300"}`}>{card.attribute}</span>
            )}
            {isMonster && card.race && (
              <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300">Tipo: {monsterTypeLabel(card.race)}</span>
            )}
            {kind && (
              <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300">
                {kind}
                {card.race && ` ${SPELL_TRAP_LABELS[card.race] ?? card.race}`}
              </span>
            )}
            {isMonster && !isLink && card.level != null && (
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300">
                {isXyz ? `☆ Rank ${card.level}` : `★ Nível ${card.level}`}
              </span>
            )}
            {variant && variant.finish !== "normal" && (
              <span className={`rounded-md px-2 py-1 ${FINISHES[variant.finish].badge}`}>Sua melhor: {FINISHES[variant.finish].label}</span>
            )}
          </div>

          {isMonster && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="ATK" value={card.atk} />
              <Stat label={isLink ? "LINK" : "DEF"} value={isLink ? card.level : card.def} />
            </div>
          )}

          {/* EFEITO */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400/80">
              <EyeOfHorus className="h-2.5 w-4" />
              {isMonster && card.type.includes("Normal") ? "Descrição" : "Efeito"}
            </p>
            <p className="whitespace-pre-line rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm leading-relaxed text-zinc-300">
              {card.description || "Sem texto."}
            </p>
          </div>

          <RoomBanlistStatus entries={card.banlistEntries} rooms={card.rooms} />

          <p className="text-xs text-zinc-500">
            Você tem <strong className="text-zinc-300">{card.ownedQuantity ?? 0}</strong> · Máximo por deck:{" "}
            <strong className="text-zinc-300">{limit}</strong>
          </p>

          {actions && <div className="mt-auto flex flex-wrap gap-2 border-t border-zinc-800 pt-4">{actions}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-lg font-black tabular-nums text-zinc-100">{value ?? "?"}</p>
    </div>
  );
}
