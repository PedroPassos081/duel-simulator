"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeaveDuelButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    setLeaving(true);
    await fetch(`/api/duel/${matchId}/leave`, { method: "POST" });
    router.push("/random");
    router.refresh();
  }

  return (
    <button
      onClick={leave}
      disabled={leaving}
      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
    >
      {leaving ? "Saindo..." : "Sair do duelo"}
    </button>
  );
}
