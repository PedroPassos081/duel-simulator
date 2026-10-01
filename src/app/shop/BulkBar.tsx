"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { GoldIcon } from "@/components/theme/CurrencyIcons";

/**
 * Barra fixa no rodapé durante a compra em massa: quantas cópias foram escolhidas,
 * o total e os botões para concluir. Vai para o body (o painel de vidro prenderia o `fixed`).
 */
export function BulkBar({
  count,
  summary,
  children,
  onClear,
}: {
  count: number;
  summary: React.ReactNode;
  children: React.ReactNode;
  onClear: () => void;
}) {
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-amber-500/50 bg-zinc-950/95 px-4 py-3 shadow-[0_-8px_30px_rgba(245,158,11,0.15)] backdrop-blur sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <GoldIcon className="h-7 w-7 shrink-0 text-amber-300" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-100">
              {count} {count === 1 ? "cópia escolhida" : "cópias escolhidas"}
            </p>
            <div className="text-xs text-zinc-400">{summary}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <button
            onClick={onClear}
            disabled={count === 0}
            className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
