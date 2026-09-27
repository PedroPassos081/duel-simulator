import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import {
  APPROVAL_WINDOW_MS,
  CLAN_BONUS_RATE,
  CLAN_MAX_MEMBERS,
  CLAN_ROLES,
  CONTRIBUTION_REASONS,
  canManageInvites,
  decideKick,
  decideRoleChange,
  decideSettings,
  decideVault,
  roleLabel,
  type ClanRole,
  type Decision,
} from "@/lib/clans/roles";

export class ClanError extends Error {}

type Tx = Prisma.TransactionClient;
type Currency = "gold" | "cash";

// O banco fica longe (Neon, EUA): operações com vários membros passam fácil do
// limite padrão de 5 s de uma transação do Prisma.
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
function transaction<T>(fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(fn, TX_OPTIONS);
}

export interface ActionResult {
  message: string;
  pending?: boolean;
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

async function getMember(userId: string) {
  return prisma.clanMember.findUnique({ where: { userId } });
}

async function requireMember(userId: string) {
  const member = await getMember(userId);
  if (!member) throw new ClanError("Você não está em um clã.");
  return member as typeof member & { role: ClanRole };
}

async function requireMemberOf(clanId: string, userId: string) {
  const member = await prisma.clanMember.findUnique({ where: { userId } });
  if (!member || member.clanId !== clanId) throw new ClanError("Este jogador não está no clã.");
  return member as typeof member & { role: ClanRole };
}

async function nick(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true } });
  return user?.username ? `@${user.username}` : user?.name ?? "jogador";
}

const currencyLabel = (currency: Currency) => (currency === "gold" ? "gold" : "crédito");

function formatAmounts(gold: number, cash: number) {
  const parts = [];
  if (gold) parts.push(`${gold} gold`);
  if (cash) parts.push(`${cash} crédito`);
  return parts.join(" + ") || "0";
}

/** Movimenta o cofre dentro de uma transação. Saídas nunca deixam o cofre negativo. */
async function moveVault(
  tx: Tx,
  clanId: string,
  currency: Currency,
  amount: number,
  reason: string,
  userId?: string | null,
  ref?: { type: string; id: string }
) {
  const field = currency === "gold" ? "vaultGold" : "vaultCash";
  const { count } = await tx.clan.updateMany({
    where: { id: clanId, ...(amount < 0 ? { [field]: { gte: -amount } } : {}) },
    data: { [field]: { increment: amount } },
  });
  if (count === 0) throw new ClanError(`O cofre não tem ${currencyLabel(currency)} suficiente.`);

  const clan = await tx.clan.findUniqueOrThrow({ where: { id: clanId } });
  await tx.clanVaultTransaction.create({
    data: {
      clanId,
      userId: userId ?? null,
      currency,
      amount,
      balanceAfter: clan[field],
      reason,
      refType: ref?.type,
      refId: ref?.id,
    },
  });
}

/** Movimenta a carteira de um jogador dentro de uma transação (com histórico). */
async function moveWallet(
  tx: Tx,
  userId: string,
  currency: Currency,
  amount: number,
  reason: string,
  ref?: { type: string; id: string }
) {
  await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
  const { count } = await tx.wallet.updateMany({
    where: { userId, ...(amount < 0 ? { [currency]: { gte: -amount } } : {}) },
    data: { [currency]: { increment: amount } },
  });
  if (count === 0) throw new ClanError(`Saldo de ${currencyLabel(currency)} insuficiente.`);

  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  await tx.currencyTransaction.create({
    data: {
      userId,
      currency,
      amount,
      balanceAfter: wallet[currency],
      reason,
      refType: ref?.type,
      refId: ref?.id,
    },
  });
}

/**
 * Fecha o torneio só se ele ainda estiver aberto. Feito no começo da transação,
 * antes de mexer no cofre e nas carteiras: se duas execuções chegarem juntas
 * (dois cliques, ou um pedido que venceu o prazo junto com a decisão do líder),
 * a segunda não acha mais o torneio aberto e não paga/devolve a premiação de novo.
 */
async function closeOpenTournament(
  tx: Tx,
  tournamentId: string,
  data: Prisma.ClanTournamentUpdateManyMutationInput
) {
  const { count } = await tx.clanTournament.updateMany({
    where: { id: tournamentId, status: "open" },
    data,
  });
  if (count === 0) throw new ClanError("Torneio não está aberto.");
}

async function memberCount(clanId: string) {
  return prisma.clanMember.count({ where: { clanId } });
}

async function addMember(tx: Tx, clanId: string, userId: string) {
  const count = await tx.clanMember.count({ where: { clanId } });
  if (count >= CLAN_MAX_MEMBERS) throw new ClanError(`O clã já está cheio (${CLAN_MAX_MEMBERS} membros).`);
  await tx.clanMember.create({ data: { clanId, userId, role: "member" } });
  // Entrou em um clã: descarta os outros pedidos e convites dele
  await tx.clanJoinRequest.deleteMany({ where: { userId } });
}

// ---------------------------------------------------------------------------
// Pedidos com aprovação (prazo de 2 dias)
// ---------------------------------------------------------------------------

type RequestType =
  | "settings"
  | "kick"
  | "change_role"
  | "distribute"
  | "tournament_create"
  | "tournament_finalize"
  | "tournament_cancel";

/** Executa na hora ou cria o pedido, conforme a decisão de permissão. */
async function performOrRequest(opts: {
  decision: Decision;
  clanId: string;
  actorId: string;
  type: RequestType;
  payload: Record<string, unknown>;
  summary: string;
  targetUserId?: string;
}): Promise<ActionResult> {
  const { decision } = opts;
  if (decision.kind === "forbidden") throw new ClanError("Seu cargo não permite fazer isso.");

  if (decision.kind === "immediate") {
    const message = await execute(opts.type, opts.clanId, opts.payload);
    return { message };
  }

  await prisma.clanActionRequest.create({
    data: {
      clanId: opts.clanId,
      type: opts.type,
      payload: opts.payload as Prisma.InputJsonValue,
      summary: opts.summary,
      requesterId: opts.actorId,
      targetUserId: opts.targetUserId,
      approverRoles: decision.approvers.join(","),
      autoExecute: decision.auto,
      expiresAt: new Date(Date.now() + APPROVAL_WINDOW_MS),
    },
  });
  const who = decision.approvers.map(roleLabel).join(" ou ").toLowerCase();
  return {
    pending: true,
    message: decision.auto
      ? `Pedido enviado ao ${who}. Se não houver resposta em 2 dias, será executado.`
      : `Pedido enviado ao ${who}. Ele precisa aprovar em até 2 dias.`,
  };
}

/** Executa a ação de fato. Revalida tudo, porque o pedido pode ter esperado 2 dias. */
async function execute(type: RequestType, clanId: string, payload: Record<string, any>): Promise<string> {
  switch (type) {
    case "settings": {
      const { name, description } = payload as { name?: string; description?: string | null };
      if (name) {
        const taken = await prisma.clan.findFirst({ where: { name, NOT: { id: clanId } } });
        if (taken) throw new ClanError("Já existe um clã com esse nome.");
      }
      await prisma.clan.update({
        where: { id: clanId },
        data: { ...(name ? { name } : {}), ...(description !== undefined ? { description } : {}) },
      });
      return "Configurações do clã atualizadas.";
    }

    case "kick": {
      const { targetUserId, targetRole } = payload as { targetUserId: string; targetRole: ClanRole };
      const target = await requireMemberOf(clanId, targetUserId);
      if (target.role !== targetRole) throw new ClanError("O cargo do jogador mudou desde o pedido.");
      await prisma.clanMember.delete({ where: { id: target.id } });
      return `${await nick(targetUserId)} foi expulso do clã.`;
    }

    case "change_role": {
      const { targetUserId, fromRole, newRole, actorId } = payload as {
        targetUserId: string;
        fromRole: ClanRole;
        newRole: ClanRole;
        actorId: string;
      };
      const target = await requireMemberOf(clanId, targetUserId);
      if (target.role !== fromRole) throw new ClanError("O cargo do jogador mudou desde o pedido.");

      await transaction(async (tx) => {
        if (newRole === "leader") {
          // Passar a liderança: o líder atual assume o cargo antigo do novo líder
          const leader = await tx.clanMember.findFirstOrThrow({ where: { clanId, role: "leader" } });
          if (leader.userId !== actorId) throw new ClanError("Só o líder pode passar a liderança.");
          await tx.clanMember.update({ where: { id: leader.id }, data: { role: fromRole } });
        } else {
          const count = await tx.clanMember.count({ where: { clanId, role: newRole } });
          const max = CLAN_ROLES[newRole].max;
          if (count >= max) throw new ClanError(`O clã já tem o máximo de ${max} ${roleLabel(newRole).toLowerCase()}(s).`);
        }
        await tx.clanMember.update({ where: { id: target.id }, data: { role: newRole } });
      });
      return `${await nick(targetUserId)} agora é ${roleLabel(newRole)}.`;
    }

    case "distribute": {
      const { payouts } = payload as { payouts: { userId: string; gold: number; cash: number }[] };
      const members = await prisma.clanMember.findMany({ where: { clanId }, select: { userId: true } });
      const inClan = new Set(members.map((m) => m.userId));
      const valid = payouts.filter((p) => inClan.has(p.userId) && (p.gold > 0 || p.cash > 0));
      if (valid.length === 0) throw new ClanError("Nenhum membro para receber.");

      await transaction(async (tx) => {
        for (const p of valid) {
          const ref = { type: "ClanDistribution", id: `${clanId}:${Date.now()}:${p.userId}` };
          for (const currency of ["gold", "cash"] as const) {
            if (p[currency] <= 0) continue;
            await moveVault(tx, clanId, currency, -p[currency], "distribution", p.userId, ref);
            await moveWallet(tx, p.userId, currency, p[currency], "clan_distribution", ref);
          }
        }
      });
      const gold = valid.reduce((s, p) => s + p.gold, 0);
      const cash = valid.reduce((s, p) => s + p.cash, 0);
      const skipped = payouts.length - valid.length;
      return `Distribuídos ${formatAmounts(gold, cash)} para ${valid.length} membro(s).${
        skipped > 0 ? ` ${skipped} ignorado(s) por não estarem mais no clã.` : ""
      }`;
    }

    case "tournament_create": {
      const { name, description, startsAt, prizes, createdById } = payload as {
        name: string;
        description?: string;
        startsAt: string;
        prizes: { placement: number; gold: number; cash: number }[];
        createdById: string;
      };
      const gold = prizes.reduce((s, p) => s + p.gold, 0);
      const cash = prizes.reduce((s, p) => s + p.cash, 0);
      await transaction(async (tx) => {
        const tournament = await tx.clanTournament.create({
          data: { clanId, name, description, startsAt: new Date(startsAt), prizes, createdById },
        });
        const ref = { type: "ClanTournament", id: tournament.id };
        // A premiação fica reservada: sai do cofre agora e volta se o torneio for cancelado
        if (gold > 0) await moveVault(tx, clanId, "gold", -gold, "tournament_reserve", null, ref);
        if (cash > 0) await moveVault(tx, clanId, "cash", -cash, "tournament_reserve", null, ref);
      });
      return `Torneio "${name}" criado. Premiação de ${formatAmounts(gold, cash)} reservada do cofre.`;
    }

    case "tournament_finalize": {
      const { tournamentId, winners } = payload as {
        tournamentId: string;
        winners: { placement: number; userId: string }[];
      };
      const tournament = await prisma.clanTournament.findFirst({ where: { id: tournamentId, clanId } });
      if (!tournament || tournament.status !== "open") throw new ClanError("Torneio não está aberto.");
      const prizes = tournament.prizes as { placement: number; gold: number; cash: number }[];

      await transaction(async (tx) => {
        await closeOpenTournament(tx, tournament.id, {
          status: "finished",
          results: winners,
          finishedAt: new Date(),
        });
        const ref = { type: "ClanTournament", id: tournament.id };
        for (const prize of prizes) {
          const winner = winners.find((w) => w.placement === prize.placement);
          // Colocação sem vencedor: o prêmio volta para o cofre
          if (!winner) {
            if (prize.gold > 0) await moveVault(tx, clanId, "gold", prize.gold, "tournament_refund", null, ref);
            if (prize.cash > 0) await moveVault(tx, clanId, "cash", prize.cash, "tournament_refund", null, ref);
            continue;
          }
          if (prize.gold > 0) await moveWallet(tx, winner.userId, "gold", prize.gold, "clan_tournament_prize", ref);
          if (prize.cash > 0) await moveWallet(tx, winner.userId, "cash", prize.cash, "clan_tournament_prize", ref);
        }
      });
      return `Torneio "${tournament.name}" finalizado e premiação paga.`;
    }

    case "tournament_cancel": {
      const { tournamentId } = payload as { tournamentId: string };
      const tournament = await prisma.clanTournament.findFirst({ where: { id: tournamentId, clanId } });
      if (!tournament || tournament.status !== "open") throw new ClanError("Torneio não está aberto.");
      const prizes = tournament.prizes as { gold: number; cash: number }[];
      const gold = prizes.reduce((s, p) => s + p.gold, 0);
      const cash = prizes.reduce((s, p) => s + p.cash, 0);
      await transaction(async (tx) => {
        await closeOpenTournament(tx, tournament.id, { status: "cancelled" });
        const ref = { type: "ClanTournament", id: tournament.id };
        if (gold > 0) await moveVault(tx, clanId, "gold", gold, "tournament_refund", null, ref);
        if (cash > 0) await moveVault(tx, clanId, "cash", cash, "tournament_refund", null, ref);
      });
      return `Torneio "${tournament.name}" cancelado. Premiação devolvida ao cofre.`;
    }
  }
}

/** Marca o pedido como "executando" (só um processo consegue) e executa. */
async function runRequest(requestId: string, decidedById: string | null) {
  const { count } = await prisma.clanActionRequest.updateMany({
    where: { id: requestId, status: "pending" },
    data: { status: "executing" },
  });
  if (count === 0) return null;

  const request = await prisma.clanActionRequest.findUniqueOrThrow({ where: { id: requestId } });
  try {
    const message = await execute(request.type as RequestType, request.clanId, request.payload as Record<string, any>);
    await prisma.clanActionRequest.update({
      where: { id: requestId },
      data: { status: "executed", decidedById, decidedAt: new Date(), resultMessage: message },
    });
    return message;
  } catch (err) {
    const message = err instanceof ClanError ? err.message : "Erro ao executar.";
    await prisma.clanActionRequest.update({
      where: { id: requestId },
      data: { status: "failed", decidedById, decidedAt: new Date(), resultMessage: message },
    });
    if (!(err instanceof ClanError)) console.error(err);
    return message;
  }
}

/** Resolve pedidos cujo prazo de 2 dias acabou. Chamado sempre que o clã é carregado. */
export async function processDueRequests(clanId: string) {
  const due = await prisma.clanActionRequest.findMany({
    where: { clanId, status: "pending", expiresAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
  });
  for (const request of due) {
    if (request.autoExecute) {
      await runRequest(request.id, null);
    } else {
      await prisma.clanActionRequest.updateMany({
        where: { id: request.id, status: "pending" },
        data: { status: "expired", decidedAt: new Date(), resultMessage: "Expirou sem aprovação do líder." },
      });
    }
  }
}

export async function decideRequest(actorId: string, requestId: string, approve: boolean): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  await processDueRequests(actor.clanId);
  const request = await prisma.clanActionRequest.findUnique({ where: { id: requestId } });
  if (!request || request.clanId !== actor.clanId || request.status !== "pending") {
    throw new ClanError("Este pedido não está mais pendente.");
  }
  if (!request.approverRoles.split(",").includes(actor.role)) {
    throw new ClanError("Seu cargo não pode responder este pedido.");
  }

  if (!approve) {
    const { count } = await prisma.clanActionRequest.updateMany({
      where: { id: requestId, status: "pending" },
      data: { status: "rejected", decidedById: actorId, decidedAt: new Date(), resultMessage: "Recusado." },
    });
    if (count === 0) throw new ClanError("Este pedido não está mais pendente.");
    return { message: "Pedido recusado." };
  }

  const message = await runRequest(requestId, actorId);
  if (message === null) throw new ClanError("Este pedido não está mais pendente.");
  return { message };
}

// ---------------------------------------------------------------------------
// Entrar, sair, convites
// ---------------------------------------------------------------------------

export async function createClan(userId: string, name: string, description?: string): Promise<ActionResult> {
  if (await getMember(userId)) throw new ClanError("Você já está em um clã.");
  if (await prisma.clan.findUnique({ where: { name } })) throw new ClanError("Já existe um clã com esse nome.");

  await transaction(async (tx) => {
    const clan = await tx.clan.create({ data: { name, description } });
    await tx.clanMember.create({ data: { clanId: clan.id, userId, role: "leader" } });
    await tx.clanJoinRequest.deleteMany({ where: { userId } });
  });
  return { message: `Clã "${name}" criado. Você é o líder!` };
}

export async function requestJoin(userId: string, clanId: string): Promise<ActionResult> {
  if (await getMember(userId)) throw new ClanError("Você já está em um clã.");
  const clan = await prisma.clan.findUnique({ where: { id: clanId } });
  if (!clan) throw new ClanError("Clã não encontrado.");
  if ((await memberCount(clanId)) >= CLAN_MAX_MEMBERS) throw new ClanError("Este clã está cheio.");

  const existing = await prisma.clanJoinRequest.findUnique({ where: { clanId_userId: { clanId, userId } } });
  // Já tinha convite deste clã: pedir para entrar = aceitar o convite
  if (existing?.type === "invite") {
    await transaction((tx) => addMember(tx, clanId, userId));
    return { message: `Você entrou no clã ${clan.name}!` };
  }
  if (existing) throw new ClanError("Você já pediu para entrar neste clã.");

  await prisma.clanJoinRequest.create({ data: { clanId, userId, type: "request" } });
  return { message: `Pedido enviado ao clã ${clan.name}.` };
}

/** O jogador cancela o próprio pedido ou recusa um convite. */
export async function cancelOwnJoinRequest(userId: string, joinRequestId: string): Promise<ActionResult> {
  const { count } = await prisma.clanJoinRequest.deleteMany({ where: { id: joinRequestId, userId } });
  if (count === 0) throw new ClanError("Pedido não encontrado.");
  return { message: "Pronto." };
}

export async function acceptInvite(userId: string, joinRequestId: string): Promise<ActionResult> {
  if (await getMember(userId)) throw new ClanError("Você já está em um clã.");
  const invite = await prisma.clanJoinRequest.findFirst({
    where: { id: joinRequestId, userId, type: "invite" },
    include: { clan: true },
  });
  if (!invite) throw new ClanError("Convite não encontrado.");
  await transaction((tx) => addMember(tx, invite.clanId, userId));
  return { message: `Você entrou no clã ${invite.clan.name}!` };
}

export async function invitePlayer(actorId: string, username: string): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  if (!canManageInvites(actor.role)) throw new ClanError("Seu cargo não permite convidar.");

  const target = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase().replace(/^@/, "") } });
  if (!target) throw new ClanError("Jogador não encontrado.");
  if (await getMember(target.id)) throw new ClanError("Este jogador já está em um clã.");
  if ((await memberCount(actor.clanId)) >= CLAN_MAX_MEMBERS) throw new ClanError("O clã está cheio.");

  const existing = await prisma.clanJoinRequest.findUnique({
    where: { clanId_userId: { clanId: actor.clanId, userId: target.id } },
  });
  // Ele já tinha pedido para entrar: convidar = aceitar
  if (existing?.type === "request") {
    await transaction((tx) => addMember(tx, actor.clanId, target.id));
    return { message: `@${target.username} já tinha pedido para entrar e agora é membro.` };
  }
  if (existing) throw new ClanError("Este jogador já foi convidado.");

  await prisma.clanJoinRequest.create({
    data: { clanId: actor.clanId, userId: target.id, type: "invite", invitedById: actorId },
  });
  return { message: `Convite enviado para @${target.username}.` };
}

/** Líder, vice ou sub aceita/recusa um pedido de entrada, ou cancela um convite. */
export async function respondJoinRequest(actorId: string, joinRequestId: string, accept: boolean): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  if (!canManageInvites(actor.role)) throw new ClanError("Seu cargo não permite fazer isso.");
  const joinRequest = await prisma.clanJoinRequest.findFirst({
    where: { id: joinRequestId, clanId: actor.clanId },
  });
  if (!joinRequest) throw new ClanError("Pedido não encontrado.");

  if (!accept || joinRequest.type === "invite") {
    await prisma.clanJoinRequest.delete({ where: { id: joinRequest.id } });
    return { message: joinRequest.type === "invite" ? "Convite cancelado." : "Pedido recusado." };
  }
  if (await getMember(joinRequest.userId)) {
    await prisma.clanJoinRequest.delete({ where: { id: joinRequest.id } });
    throw new ClanError("Este jogador já entrou em outro clã.");
  }
  await transaction((tx) => addMember(tx, actor.clanId, joinRequest.userId));
  return { message: `${await nick(joinRequest.userId)} agora é membro do clã.` };
}

export async function leaveClan(userId: string): Promise<ActionResult> {
  const member = await requireMember(userId);
  if (member.role === "leader") {
    if ((await memberCount(member.clanId)) > 1) {
      throw new ClanError("Passe a liderança para outro membro antes de sair.");
    }
    // Último membro saindo: o clã (e o cofre) deixa de existir
    await prisma.clan.delete({ where: { id: member.clanId } });
    return { message: "Você saiu e o clã foi desfeito." };
  }
  await prisma.clanMember.delete({ where: { id: member.id } });
  return { message: "Você saiu do clã." };
}

// ---------------------------------------------------------------------------
// Cargos, expulsão, configurações
// ---------------------------------------------------------------------------

export async function kickMember(actorId: string, targetUserId: string): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  if (actorId === targetUserId) throw new ClanError("Para sair, use a opção Sair do clã.");
  const target = await requireMemberOf(actor.clanId, targetUserId);
  return performOrRequest({
    decision: decideKick(actor.role, target.role),
    clanId: actor.clanId,
    actorId,
    type: "kick",
    payload: { targetUserId, targetRole: target.role },
    summary: `Expulsar ${await nick(targetUserId)} (${roleLabel(target.role)})`,
    targetUserId,
  });
}

export async function changeRole(actorId: string, targetUserId: string, newRole: ClanRole): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  if (actorId === targetUserId) throw new ClanError("Você não pode mudar o próprio cargo.");
  const target = await requireMemberOf(actor.clanId, targetUserId);

  const decision = decideRoleChange(actor.role, target.role, newRole);
  // Checa a vaga já no pedido, para não criar pedidos impossíveis
  if (decision.kind !== "forbidden" && newRole !== "leader") {
    const count = await prisma.clanMember.count({ where: { clanId: actor.clanId, role: newRole } });
    if (count >= CLAN_ROLES[newRole].max) {
      throw new ClanError(`O clã já tem o máximo de ${CLAN_ROLES[newRole].max} ${roleLabel(newRole).toLowerCase()}(s).`);
    }
  }
  return performOrRequest({
    decision,
    clanId: actor.clanId,
    actorId,
    type: "change_role",
    payload: { targetUserId, fromRole: target.role, newRole, actorId },
    summary: `${await nick(targetUserId)}: ${roleLabel(target.role)} → ${roleLabel(newRole)}`,
    targetUserId,
  });
}

export async function updateSettings(
  actorId: string,
  data: { name?: string; description?: string | null }
): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  const changes = [data.name && `nome para "${data.name}"`, data.description !== undefined && "descrição"].filter(Boolean);
  return performOrRequest({
    decision: decideSettings(actor.role),
    clanId: actor.clanId,
    actorId,
    type: "settings",
    payload: data,
    summary: `Alterar ${changes.join(" e ")}`,
  });
}

// ---------------------------------------------------------------------------
// Cofre
// ---------------------------------------------------------------------------

/**
 * Bônus do clã: quando um membro ganha gold/crédito no Random ou em premiações,
 * o cofre do clã recebe +10% desse valor, SEM tirar do jogador. Idempotente pela
 * referência (a mesma partida não gera bônus duas vezes).
 */
export async function addClanBonus(
  userId: string,
  currency: Currency,
  earned: number,
  reason: "match_bonus" | "prize_bonus",
  ref: { type: string; id: string }
) {
  const member = await getMember(userId);
  const bonus = Math.floor(earned * CLAN_BONUS_RATE);
  if (!member || bonus <= 0) return;

  const already = await prisma.clanVaultTransaction.findFirst({
    where: { clanId: member.clanId, userId, reason, refType: ref.type, refId: ref.id, currency },
  });
  if (already) return;

  await transaction((tx) => moveVault(tx, member.clanId, currency, bonus, reason, userId, ref));
}

/** Prêmio dado diretamente ao clã (vai inteiro para o cofre). */
export async function grantClanPrize(clanId: string, currency: Currency, amount: number, ref?: { type: string; id: string }) {
  await transaction((tx) => moveVault(tx, clanId, currency, amount, "clan_prize", null, ref));
}

/** Qualquer membro pode doar créditos da própria carteira para o cofre. */
export async function donateToVault(userId: string, amount: number): Promise<ActionResult> {
  const member = await requireMember(userId);
  const ref = { type: "ClanDonation", id: `${member.clanId}:${userId}:${Date.now()}` };
  await transaction(async (tx) => {
    await moveWallet(tx, userId, "cash", -amount, "clan_donation", ref);
    await moveVault(tx, member.clanId, "cash", amount, "donation", userId, ref);
  });
  return { message: `Você doou ${amount} crédito(s) ao cofre. Obrigado!` };
}

/** Presente: manda créditos da própria carteira para outro jogador. */
export async function giftCredits(userId: string, toUsername: string, amount: number): Promise<ActionResult> {
  const target = await prisma.user.findUnique({
    where: { username: toUsername.trim().toLowerCase().replace(/^@/, "") },
  });
  if (!target) throw new ClanError("Jogador não encontrado.");
  if (target.id === userId) throw new ClanError("Você não pode presentear a si mesmo.");

  const ref = { type: "Gift", id: `${userId}:${target.id}:${Date.now()}` };
  await transaction(async (tx) => {
    await moveWallet(tx, userId, "cash", -amount, "gift_sent", ref);
    await moveWallet(tx, target.id, "cash", amount, "gift_received", ref);
  });
  return { message: `Você enviou ${amount} crédito(s) de presente para @${target.username}.` };
}

/** Quanto cada membro já contribuiu para o cofre (bônus + doações). */
export async function getContributions(clanId: string) {
  const groups = await prisma.clanVaultTransaction.groupBy({
    by: ["userId", "currency"],
    where: { clanId, reason: { in: [...CONTRIBUTION_REASONS] }, userId: { not: null } },
    _sum: { amount: true },
  });
  const byUser = new Map<string, { gold: number; cash: number }>();
  for (const g of groups) {
    const entry = byUser.get(g.userId!) ?? { gold: 0, cash: 0 };
    entry[g.currency as Currency] += g._sum.amount ?? 0;
    byUser.set(g.userId!, entry);
  }
  return byUser;
}

type Payout = { userId: string; gold: number; cash: number };

export async function distributeManual(actorId: string, payouts: Payout[]): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  const clean = payouts.filter((p) => p.gold > 0 || p.cash > 0);
  if (clean.length === 0) throw new ClanError("Informe algum valor para distribuir.");
  const members = await prisma.clanMember.findMany({ where: { clanId: actor.clanId }, select: { userId: true } });
  const inClan = new Set(members.map((m) => m.userId));
  if (clean.some((p) => !inClan.has(p.userId))) throw new ClanError("Só é possível distribuir para membros do clã.");
  await assertVaultCovers(actor.clanId, clean);

  const gold = clean.reduce((s, p) => s + p.gold, 0);
  const cash = clean.reduce((s, p) => s + p.cash, 0);
  return performOrRequest({
    decision: decideVault(actor.role),
    clanId: actor.clanId,
    actorId,
    type: "distribute",
    payload: { payouts: clean },
    summary: `Distribuir ${formatAmounts(gold, cash)} do cofre para ${clean.length} membro(s)`,
  });
}

/**
 * Distribuição por contribuição: os `topCount` que mais contribuíram recebem
 * `topAmount` cada; os demais membros recebem `restAmount` cada.
 */
export async function distributeByContribution(
  actorId: string,
  opts: { currency: Currency; rankBy: Currency; topCount: number; topAmount: number; restAmount: number }
): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  const [members, contributions] = await Promise.all([
    prisma.clanMember.findMany({ where: { clanId: actor.clanId }, select: { userId: true } }),
    getContributions(actor.clanId),
  ]);
  const ranked = members
    .map((m) => ({ userId: m.userId, score: contributions.get(m.userId)?.[opts.rankBy] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  // Payouts calculados agora, para o líder aprovar exatamente o que foi pedido
  const payouts = ranked
    .map((m, i) => {
      const amount = i < opts.topCount ? opts.topAmount : opts.restAmount;
      return { userId: m.userId, gold: opts.currency === "gold" ? amount : 0, cash: opts.currency === "cash" ? amount : 0 };
    })
    .filter((p) => p.gold > 0 || p.cash > 0);
  if (payouts.length === 0) throw new ClanError("Informe algum valor para distribuir.");
  await assertVaultCovers(actor.clanId, payouts);

  const total = payouts.reduce((s, p) => s + p.gold + p.cash, 0);
  return performOrRequest({
    decision: decideVault(actor.role),
    clanId: actor.clanId,
    actorId,
    type: "distribute",
    payload: { payouts },
    summary: `Distribuir ${total} ${currencyLabel(opts.currency)} por contribuição: top ${opts.topCount} recebem ${opts.topAmount} cada, demais ${opts.restAmount} cada`,
  });
}

async function assertVaultCovers(clanId: string, payouts: { gold: number; cash: number }[]) {
  const clan = await prisma.clan.findUniqueOrThrow({ where: { id: clanId } });
  const gold = payouts.reduce((s, p) => s + p.gold, 0);
  const cash = payouts.reduce((s, p) => s + p.cash, 0);
  if (gold > clan.vaultGold) throw new ClanError(`O cofre tem só ${clan.vaultGold} gold.`);
  if (cash > clan.vaultCash) throw new ClanError(`O cofre tem só ${clan.vaultCash} crédito(s).`);
}

// ---------------------------------------------------------------------------
// Torneios do clã
// ---------------------------------------------------------------------------

export async function createTournament(
  actorId: string,
  data: { name: string; description?: string; startsAt: Date; prizes: { placement: number; gold: number; cash: number }[] }
): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  await assertVaultCovers(actor.clanId, data.prizes);
  return performOrRequest({
    decision: decideVault(actor.role),
    clanId: actor.clanId,
    actorId,
    type: "tournament_create",
    payload: { ...data, startsAt: data.startsAt.toISOString(), createdById: actorId },
    summary: `Criar torneio "${data.name}" com premiação de ${formatAmounts(
      data.prizes.reduce((s, p) => s + p.gold, 0),
      data.prizes.reduce((s, p) => s + p.cash, 0)
    )}`,
  });
}

export async function finalizeTournament(
  actorId: string,
  tournamentId: string,
  winners: { placement: number; userId: string }[]
): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  const tournament = await prisma.clanTournament.findFirst({ where: { id: tournamentId, clanId: actor.clanId } });
  if (!tournament || tournament.status !== "open") throw new ClanError("Torneio não está aberto.");
  for (const w of winners) await requireMemberOf(actor.clanId, w.userId);
  const names = await Promise.all(winners.map(async (w) => `${w.placement}º ${await nick(w.userId)}`));
  return performOrRequest({
    decision: decideVault(actor.role),
    clanId: actor.clanId,
    actorId,
    type: "tournament_finalize",
    payload: { tournamentId, winners },
    summary: `Finalizar torneio "${tournament.name}": ${names.join(", ")}`,
  });
}

export async function cancelTournament(actorId: string, tournamentId: string): Promise<ActionResult> {
  const actor = await requireMember(actorId);
  const tournament = await prisma.clanTournament.findFirst({ where: { id: tournamentId, clanId: actor.clanId } });
  if (!tournament || tournament.status !== "open") throw new ClanError("Torneio não está aberto.");
  return performOrRequest({
    decision: decideVault(actor.role),
    clanId: actor.clanId,
    actorId,
    type: "tournament_cancel",
    payload: { tournamentId },
    summary: `Cancelar torneio "${tournament.name}" e devolver a premiação ao cofre`,
  });
}

// ---------------------------------------------------------------------------
// Dados da tela
// ---------------------------------------------------------------------------

export async function getClanPageData(userId: string) {
  const member = await getMember(userId);

  if (!member) {
    const [joinRequests, clans] = await Promise.all([
      prisma.clanJoinRequest.findMany({
        where: { userId },
        include: { clan: { select: { id: true, name: true, _count: { select: { members: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.clan.findMany({
        take: 50,
        orderBy: { members: { _count: "desc" } },
        select: { id: true, name: true, description: true, _count: { select: { members: true } } },
      }),
    ]);
    return {
      clan: null,
      invites: joinRequests.filter((r) => r.type === "invite"),
      myRequests: joinRequests.filter((r) => r.type === "request"),
      clans,
    } as const;
  }

  await processDueRequests(member.clanId);
  const clanId = member.clanId;

  const [clan, members, contributions, vaultTransactions, requests, joinRequests, tournaments] = await Promise.all([
    prisma.clan.findUniqueOrThrow({ where: { id: clanId } }),
    prisma.clanMember.findMany({ where: { clanId }, include: { user: { select: { id: true, ...userAvatarSelect } } } }),
    getContributions(clanId),
    prisma.clanVaultTransaction.findMany({ where: { clanId }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.clanActionRequest.findMany({ where: { clanId }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.clanJoinRequest.findMany({
      where: { clanId },
      include: { user: { select: { id: true, ...userAvatarSelect } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clanTournament.findMany({ where: { clanId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  // Nomes de quem aparece nos pedidos e no histórico e não é mais membro
  const knownIds = new Set(members.map((m) => m.userId));
  const extraIds = [
    ...requests.flatMap((r) => [r.requesterId, r.decidedById]),
    ...vaultTransactions.map((t) => t.userId),
  ].filter((id): id is string => Boolean(id) && !knownIds.has(id!));
  const extraUsers = await prisma.user.findMany({
    where: { id: { in: [...new Set(extraIds)] } },
    select: { id: true, username: true, name: true },
  });
  const names = new Map<string, string>([
    ...members.map((m) => [m.userId, m.user.username ?? m.user.name ?? "jogador"] as [string, string]),
    ...extraUsers.map((u) => [u.id, u.username ?? u.name ?? "jogador"] as [string, string]),
  ]);

  const memberViews = members
    .map((m) => ({
      userId: m.userId,
      role: m.role as ClanRole,
      joinedAt: m.joinedAt.toISOString(),
      avatar: toAvatarProps(m.user),
      playerName: toPlayerNameProps(m.user),
      contribution: contributions.get(m.userId) ?? { gold: 0, cash: 0 },
    }))
    .sort(
      (a, b) =>
        CLAN_ROLES[b.role].rank - CLAN_ROLES[a.role].rank ||
        b.contribution.cash + b.contribution.gold - (a.contribution.cash + a.contribution.gold)
    );

  return {
    clan: {
      id: clan.id,
      name: clan.name,
      description: clan.description,
      vaultGold: clan.vaultGold,
      vaultCash: clan.vaultCash,
      createdAt: clan.createdAt.toISOString(),
    },
    me: { userId, role: member.role as ClanRole },
    members: memberViews,
    vaultTransactions: vaultTransactions.map((t) => ({
      id: t.id,
      currency: t.currency,
      amount: t.amount,
      reason: t.reason,
      userName: t.userId ? names.get(t.userId) ?? null : null,
      createdAt: t.createdAt.toISOString(),
    })),
    requests: requests.map((r) => ({
      id: r.id,
      type: r.type,
      summary: r.summary,
      status: r.status,
      autoExecute: r.autoExecute,
      requesterName: names.get(r.requesterId) ?? "jogador",
      approverRoles: r.approverRoles.split(",") as ClanRole[],
      canDecide: r.status === "pending" && r.approverRoles.split(",").includes(member.role),
      expiresAt: r.expiresAt.toISOString(),
      decidedByName: r.decidedById ? names.get(r.decidedById) ?? null : null,
      resultMessage: r.resultMessage,
      createdAt: r.createdAt.toISOString(),
    })),
    joinRequests: joinRequests.map((j) => ({
      id: j.id,
      type: j.type,
      userId: j.userId,
      avatar: toAvatarProps(j.user),
      playerName: toPlayerNameProps(j.user),
      createdAt: j.createdAt.toISOString(),
    })),
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      startsAt: t.startsAt.toISOString(),
      status: t.status,
      prizes: t.prizes as { placement: number; gold: number; cash: number }[],
      results: (t.results as { placement: number; userId: string }[] | null)?.map((r) => ({
        ...r,
        name: names.get(r.userId) ?? "jogador",
      })) ?? null,
    })),
  } as const;
}

/** Quantos pedidos esperam a resposta deste jogador (para o aviso na navegação). */
export async function countPendingApprovals(userId: string) {
  const member = await getMember(userId);
  if (!member) return 0;
  return prisma.clanActionRequest.count({
    where: { clanId: member.clanId, status: "pending", approverRoles: { contains: member.role } },
  });
}
