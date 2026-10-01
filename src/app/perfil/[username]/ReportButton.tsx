"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flag, X } from "lucide-react";
import { REPORT_MAX_LENGTH, REPORT_MIN_LENGTH, REPORT_REASONS, type ReportReason } from "@/lib/reports-shared";

/** Botão "Denunciar" do perfil: escolhe o motivo e conta o que aconteceu. */
export function ReportButton({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    if (result?.ok) {
      setReason(null);
      setMessage("");
      setResult(null);
    }
  }

  async function send() {
    if (!reason) return;
    setSending(true);
    setResult(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: username, reason, message }),
    });
    const data = await res.json();
    setSending(false);
    setResult({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível enviar." });
  }

  const ready = reason && message.trim().length >= REPORT_MIN_LENGTH && !sending;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-400 hover:border-red-500/50 hover:text-red-300"
      >
        <Flag className="h-3.5 w-3.5" /> Denunciar
      </button>

      {/* Portal: o blur do painel prenderia um modal "fixed" dentro dele */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={close}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-950 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={`Denunciar @${username}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold text-zinc-100">
                  <Flag className="h-4 w-4 text-red-400" /> Denunciar @{username}
                </h2>
                <button onClick={close} className="text-zinc-500 hover:text-zinc-200" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {result?.ok ? (
                <div className="flex flex-col gap-4">
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">{result.text}</p>
                  <button onClick={close} className="self-end rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                    Fechar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-zinc-500">Só a equipe vê a denúncia. O jogador não sabe quem denunciou.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setReason(r)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                          reason === r ? "border-red-500 bg-red-500/10 text-red-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                        }`}
                      >
                        {REPORT_REASONS[r]}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={REPORT_MAX_LENGTH}
                    rows={5}
                    placeholder="Conte o que aconteceu: quando, onde (duelo, chat, mensagem) e o que foi dito ou feito."
                    className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-zinc-500">
                      {message.trim().length}/{REPORT_MAX_LENGTH}
                    </span>
                    <button onClick={send} disabled={!ready} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-40">
                      {sending ? "Enviando..." : "Enviar denúncia"}
                    </button>
                  </div>
                  {result && <p className="text-xs text-red-400">{result.text}</p>}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
