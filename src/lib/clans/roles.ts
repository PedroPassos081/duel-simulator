// Regras de cargos e permissões dos clãs. Código puro (sem banco): usado pelo
// servidor para validar e pela tela para mostrar só o que cada cargo pode fazer.

export const CLAN_MAX_MEMBERS = 20;
// Parte dos ganhos de cada membro que vai para o cofre, SEM tirar do jogador
export const CLAN_BONUS_RATE = 0.1;
// Prazo para o líder (ou vice) responder um pedido
export const APPROVAL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export const CLAN_ROLES = {
  leader: { label: "Líder", rank: 5, max: 1 },
  vice: { label: "Vice-líder", rank: 4, max: 1 },
  sub: { label: "Sub-líder", rank: 3, max: 2 },
  captain: { label: "Capitão", rank: 2, max: 3 },
  member: { label: "Membro", rank: 1, max: CLAN_MAX_MEMBERS },
} as const;

export type ClanRole = keyof typeof CLAN_ROLES;

export function isClanRole(value: string): value is ClanRole {
  return value in CLAN_ROLES;
}

export function roleLabel(role: string) {
  return CLAN_ROLES[role as ClanRole]?.label ?? role;
}

// Motivos do histórico do cofre
export const VAULT_REASONS = {
  match_bonus: "Bônus de 10% (Random)",
  prize_bonus: "Bônus de 10% (premiação)",
  donation: "Doação",
  clan_prize: "Prêmio do clã",
  distribution: "Distribuição",
  tournament_reserve: "Reserva de torneio",
  tournament_refund: "Devolução de torneio",
  // Futuro: guerras entre clãs
  war_gain: "Vitória em guerra",
  war_loss: "Derrota em guerra",
} as const;

// Entradas que contam como contribuição do membro (ranking de contribuição)
export const CONTRIBUTION_REASONS = ["match_bonus", "prize_bonus", "donation"] as const;

/**
 * Como uma ação acontece para um cargo:
 * - "immediate": executa na hora
 * - "request": vira pedido para `approvers` (auto = executa sozinho se ninguém responder em 2 dias)
 * - "forbidden": não pode
 */
export type Decision =
  | { kind: "immediate" }
  | { kind: "request"; approvers: ClanRole[]; auto: boolean }
  | { kind: "forbidden" };

const immediate: Decision = { kind: "immediate" };
const forbidden: Decision = { kind: "forbidden" };
const request = (approvers: ClanRole[], auto = true): Decision => ({ kind: "request", approvers, auto });

/** Nome, descrição e configurações do clã. */
export function decideSettings(actor: ClanRole): Decision {
  if (actor === "leader") return immediate;
  if (actor === "vice") return request(["leader"]);
  return forbidden;
}

/** Cofre: distribuir valores e criar/finalizar/cancelar torneio do clã. */
export function decideVault(actor: ClanRole): Decision {
  if (actor === "leader") return immediate;
  // O vice decide na ausência do líder: sem resposta em 2 dias, vale a decisão dele
  if (actor === "vice") return request(["leader"]);
  // O sub-líder só solicita: precisa do "sim" do líder
  if (actor === "sub") return request(["leader"], false);
  return forbidden;
}

/** Expulsar um membro. */
export function decideKick(actor: ClanRole, target: ClanRole): Decision {
  if (target === "leader") return forbidden;
  if (actor === "leader") return immediate;
  if (actor === "vice") {
    if (target === "sub") return request(["leader"]);
    if (target === "captain" || target === "member") return immediate;
    return forbidden;
  }
  if (actor === "sub") return target === "member" ? immediate : forbidden;
  if (actor === "captain") return target === "member" ? request(["leader", "vice"]) : forbidden;
  return forbidden;
}

/** Promover/rebaixar. Passar a liderança é só do líder. */
export function decideRoleChange(actor: ClanRole, target: ClanRole, newRole: ClanRole): Decision {
  if (target === newRole || target === "leader") return forbidden;
  if (actor === "leader") return immediate;
  if (actor === "vice") {
    if (newRole === "leader" || newRole === "vice" || target === "vice") return forbidden;
    if (target === "sub" || newRole === "sub") return request(["leader"]);
    return immediate; // entre membro e capitão
  }
  return forbidden;
}

/** Convidar jogadores e aceitar/recusar pedidos de entrada. */
export function canManageInvites(actor: ClanRole) {
  return actor === "leader" || actor === "vice" || actor === "sub";
}
