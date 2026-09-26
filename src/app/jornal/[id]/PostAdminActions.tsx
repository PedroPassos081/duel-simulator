"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

/** Botões de Admin na página da publicação. */
export function PostAdminActions({ postId }: { postId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm("Excluir esta publicação e todos os comentários dela?")) return;
    setDeleting(true);
    const res = await fetch(`/api/jornal/posts/${postId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/jornal");
      router.refresh();
    } else {
      setDeleting(false);
      alert((await res.json()).error ?? "Não foi possível excluir.");
    }
  }

  return (
    <div className="flex gap-2">
      <Link
        href={`/jornal/${postId}/editar`}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
      >
        <Pencil className="h-3.5 w-3.5" /> Editar
      </Link>
      <button
        onClick={remove}
        disabled={deleting}
        className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> {deleting ? "Excluindo..." : "Excluir"}
      </button>
    </div>
  );
}
