"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

/** Aviso de advertência do Admin, no topo de todas as páginas, até o jogador clicar em "Entendi". */
export function WarningsBanner({ warnings }: { warnings: { id: string; reason: string }[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = warnings.filter((w) => !hidden.includes(w.id));
  if (visible.length === 0) return null;

  async function acknowledge(id: string) {
    setHidden((h) => [...h, id]);
    await fetch(`/api/account/warnings/${id}`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="border-b border-red-500/40 bg-red-950/60">
      {visible.map((w) => (
        <div key={w.id} className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="min-w-0 flex-1 text-red-100">
            <strong>Você recebeu uma advertência da equipe:</strong> {w.reason}
          </span>
          <button onClick={() => acknowledge(w.id)} className="rounded-md border border-red-400/50 px-3 py-1 text-xs font-semibold text-red-100 hover:bg-red-500/20">
            Entendi
          </button>
        </div>
      ))}
    </div>
  );
}
