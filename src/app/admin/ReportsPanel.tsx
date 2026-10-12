"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, CheckCircle2, Flag, Gavel } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { formatRelative } from "@/lib/dates";
import { REPORT_STATUS, type ReportStatus } from "@/lib/reports-shared";

interface PersonView {
  username: string | null;
  avatar: { image: string | null; name: string | null; frameUrl: string | null };
  playerName: { name: string | null; effect: string | null; profile: string | null };
}

interface ReportView {
  id: string;
  reasonLabel: string;
  message: string;
  status: ReportStatus;
  adminNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: PersonView;
  target: PersonView & { suspended: boolean; openReports: number };
}

const chip = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-xs font-semibold ${active ? "border-red-500 bg-red-500/10 text-red-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`;

/** Aba Denúncias: o que os jogadores denunciaram pelo perfil. Resolver, arquivar ou ir punir. */
export function ReportsPanel({ onPunish }: { onPunish: (username: string) => void }) {
  const [status, setStatus] = useState<ReportStatus>("open");
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setReports(null);
    const res = await fetch(`/api/admin/reports?status=${status}`);
    if (res.ok) setReports((await res.json()).reports);
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);

  async function close(id: string, next: "resolved" | "dismissed") {
    setFeedback(null);
    const res = await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next, note: notes[id] || undefined }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: res.ok ? data.message : data.error ?? "Não foi possível salvar." });
    if (res.ok) setReports((list) => list?.filter((r) => r.id !== id) ?? null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(REPORT_STATUS) as ReportStatus[]).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>
            {s === "open" ? "Abertas" : s === "resolved" ? "Resolvidas" : "Arquivadas"}
          </button>
        ))}
      </div>

      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {feedback.text}
        </p>
      )}

      {reports === null ? (
        <p className="text-sm text-zinc-400">Carregando...</p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
          {status === "open" ? "Nenhuma denúncia aberta. Tudo em paz no reino." : "Nada por aqui."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Flag className="h-4 w-4 text-red-400" />
                <Avatar {...r.target.avatar} size={30} />
                <PlayerName {...r.target.playerName} className="font-bold" />
                <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] font-bold text-red-300">{r.reasonLabel}</span>
                {r.target.openReports > 1 && <span className="text-[11px] font-semibold text-amber-300">{r.target.openReports} denúncias abertas</span>}
                {r.target.suspended && <span className="text-[11px] font-semibold text-zinc-400">suspenso</span>}
                <span className="ml-auto text-xs text-zinc-500">{formatRelative(new Date(r.createdAt))}</span>
              </div>

              <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">{r.message}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                Denunciado por <PlayerName {...r.reporter.playerName} className="font-semibold" />
              </p>

              {r.status === "open" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    maxLength={500}
                    placeholder="Anotação da equipe (opcional)"
                    className="min-w-[200px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-red-500/50 focus:outline-none"
                  />
                  {r.target.username && (
                    <button onClick={() => onPunish(r.target.username!)} className="flex items-center gap-1 rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10">
                      <Gavel className="h-3.5 w-3.5" /> Punir
                    </button>
                  )}
                  <button onClick={() => close(r.id, "resolved")} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
                  </button>
                  <button onClick={() => close(r.id, "dismissed")} className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                    <Archive className="h-3.5 w-3.5" /> Arquivar
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">
                  {REPORT_STATUS[r.status]} por @{r.resolvedBy ?? "?"} {r.resolvedAt && formatRelative(new Date(r.resolvedAt))}
                  {r.adminNote && <span className="block text-zinc-400">Anotação: {r.adminNote}</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
