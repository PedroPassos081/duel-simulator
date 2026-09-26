"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pin } from "lucide-react";

interface PostValues {
  type: "news" | "notice" | "tournament";
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  pinned: boolean;
}

const TYPE_OPTIONS = [
  { id: "news", label: "Notícia", hint: "Novidades do jogo" },
  { id: "notice", label: "Aviso", hint: "Manutenção, regras, avisos importantes" },
  { id: "tournament", label: "Torneio", hint: "Anúncios e resultados" },
] as const;

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none";

/** Formulário de publicação do jornal (criar ou editar). Só Admin chega aqui. */
export function PostForm({ postId, initial }: { postId?: string; initial?: Partial<PostValues> }) {
  const router = useRouter();
  const [values, setValues] = useState<PostValues>({
    type: "news",
    title: "",
    summary: "",
    content: "",
    imageUrl: "",
    pinned: false,
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PostValues>(key: K, value: PostValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(postId ? `/api/jornal/posts/${postId}` : "/api/jornal/posts", {
      method: postId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Não foi possível salvar.");
      return;
    }
    router.push(`/jornal/${json.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* TIPO */}
      <div className="grid gap-2 sm:grid-cols-3">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => set("type", t.id)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              values.type === t.id ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600"
            }`}
          >
            <span className={`block text-sm font-bold ${values.type === t.id ? "text-amber-300" : "text-zinc-200"}`}>{t.label}</span>
            <span className="block text-xs text-zinc-500">{t.hint}</span>
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
        Título
        <input value={values.title} onChange={(e) => set("title", e.target.value)} maxLength={120} className={`${inputClass} text-base font-bold`} />
      </label>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
        Resumo <span className="font-normal text-zinc-500">(opcional — aparece na lista do jornal)</span>
        <input value={values.summary} onChange={(e) => set("summary", e.target.value)} maxLength={200} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
        Texto <span className="font-normal text-zinc-500">(deixe uma linha em branco entre os parágrafos)</span>
        <textarea value={values.content} onChange={(e) => set("content", e.target.value)} rows={10} className={`${inputClass} resize-y leading-relaxed`} />
      </label>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
        Imagem de capa <span className="font-normal text-zinc-500">(opcional — link https://)</span>
        <input value={values.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." className={inputClass} />
      </label>
      {values.imageUrl.startsWith("https://") && (
        <img src={values.imageUrl} alt="Prévia da capa" className="max-h-48 w-fit rounded-lg border border-zinc-800 object-cover" />
      )}

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={values.pinned} onChange={(e) => set("pinned", e.target.checked)} className="h-4 w-4 accent-amber-500" />
        <Pin className="h-4 w-4 text-amber-400" />
        Fixar no topo do jornal
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          disabled={saving || values.title.trim().length < 3 || !values.content.trim()}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          {saving ? "Salvando..." : postId ? "Salvar alterações" : "Publicar"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800">
          Cancelar
        </button>
      </div>
    </form>
  );
}
