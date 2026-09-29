import type { Decision } from "@/lib/clans/roles";
import { roleLabel } from "@/lib/clans/roles";

export const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none";
export const primaryButton =
  "rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors";
export const secondaryButton =
  "rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors";

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-base font-bold text-zinc-100">{title}</h2>
      {description && <p className="mt-1 text-xs text-zinc-400">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Explica, antes do clique, se a ação é na hora ou vira pedido. */
export function DecisionHint({ decision }: { decision: Decision }) {
  if (decision.kind !== "request") return null;
  const who = decision.approvers.map(roleLabel).join(" ou ").toLowerCase();
  return (
    <p className="text-xs text-purple-300">
      Isto vira um pedido ao {who}.{" "}
      {decision.auto ? "Se não houver resposta em 2 dias, será executado." : "Ele precisa aprovar em até 2 dias."}
    </p>
  );
}

export function NumberInput({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value || ""}
      placeholder={placeholder ?? "0"}
      onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      className={`${inputClass} ${className}`}
    />
  );
}
