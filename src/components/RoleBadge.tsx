import { ACCOUNT_ROLES, type AccountRole } from "@/lib/admin";

/** Etiqueta ADMIN ao lado do nome (jogadores comuns não têm etiqueta). */
export function RoleBadge({ role }: { role?: string | null }) {
  const info = ACCOUNT_ROLES[role as AccountRole];
  if (!info?.badge) return null;
  return (
    <span className={`rounded border px-1 py-px text-[10px] font-black uppercase tracking-wider ${info.badge}`}>
      {info.label}
    </span>
  );
}
