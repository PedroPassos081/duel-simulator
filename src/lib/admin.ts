// Cargos de conta. Código puro: usado pelo servidor e pela tela.
// Para tornar alguém Admin: altere User.role para "admin" no Prisma Studio.

export const ACCOUNT_ROLES = {
  player: { label: "Jogador", badge: null },
  admin: { label: "Admin", badge: "bg-red-500/15 text-red-300 border-red-500/40" },
} as const;

export type AccountRole = keyof typeof ACCOUNT_ROLES;

/** Admin: publica no jornal e modera comentários. */
export function isAdmin(role: string | null | undefined) {
  return role === "admin";
}
