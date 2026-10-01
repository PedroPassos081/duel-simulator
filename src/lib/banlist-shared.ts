// Banlists: rótulos usados no navegador e no servidor

export const BAN_STATUSES = ["forbidden", "limited", "semi-limited", "unlimited"] as const;
export type BanStatus = (typeof BAN_STATUSES)[number];

export const BAN_STATUS_INFO: Record<BanStatus, { label: string; short: string; copies: number; className: string }> = {
  forbidden: { label: "Proibida", short: "0", copies: 0, className: "border-red-500/50 bg-red-500/15 text-red-300" },
  limited: { label: "Limitada", short: "1", copies: 1, className: "border-orange-500/50 bg-orange-500/15 text-orange-300" },
  "semi-limited": { label: "Semi-limitada", short: "2", copies: 2, className: "border-yellow-500/50 bg-yellow-500/15 text-yellow-200" },
  unlimited: { label: "Livre", short: "3", copies: 3, className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
};

// Salas do Random (as duas banlists que aparecem em cada carta da loja)
export const ROOM_BANLISTS = [
  { id: "slifer", name: "Slifer", className: "text-red-300" },
  { id: "obelisk", name: "Obelisco", className: "text-sky-300" },
] as const;

export function isBanStatus(value: unknown): value is BanStatus {
  return typeof value === "string" && (BAN_STATUSES as readonly string[]).includes(value);
}

/** Status da carta numa banlist ("unlimited" quando não está na lista). */
export function statusIn(entries: { format?: string; status: string }[] | undefined, format: string): BanStatus {
  const status = entries?.find((e) => e.format === format)?.status;
  return isBanStatus(status) ? status : "unlimited";
}

/** Cópias que dá para usar em alguma sala (a sala mais aberta vale para comprar e montar deck). */
export function mostPermissiveCopies(entries: { format?: string; status: string }[] | undefined) {
  return Math.max(...ROOM_BANLISTS.map((r) => BAN_STATUS_INFO[statusIn(entries, r.id)].copies));
}
