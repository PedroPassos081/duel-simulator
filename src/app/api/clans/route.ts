import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  ClanError,
  acceptInvite,
  cancelOwnJoinRequest,
  cancelTournament,
  changeRole,
  createClan,
  createTournament,
  decideRequest,
  distributeByContribution,
  distributeManual,
  donateToVault,
  finalizeTournament,
  getClanPageData,
  giftCredits,
  invitePlayer,
  kickMember,
  leaveClan,
  requestJoin,
  respondJoinRequest,
  updateSettings,
} from "@/lib/clans/service";

const clanName = z
  .string()
  .trim()
  .min(3, "O nome do clã precisa ter pelo menos 3 caracteres.")
  .max(24, "O nome do clã pode ter no máximo 24 caracteres.");
const description = z.string().trim().max(300, "A descrição pode ter no máximo 300 caracteres.");
const amount = z.number().int().min(0).max(100_000_000);
const positiveAmount = z.number().int().min(1, "Informe um valor maior que zero.").max(100_000_000);
const id = z.string().min(1);
const currency = z.enum(["gold", "cash"]);

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: clanName, description: description.optional() }),
  z.object({ action: z.literal("request_join"), clanId: id }),
  z.object({ action: z.literal("cancel_own_request"), joinRequestId: id }),
  z.object({ action: z.literal("accept_invite"), joinRequestId: id }),
  z.object({ action: z.literal("invite"), username: z.string().trim().min(1, "Informe o nome de usuário.") }),
  z.object({ action: z.literal("respond_join"), joinRequestId: id, accept: z.boolean() }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("kick"), userId: id }),
  z.object({ action: z.literal("change_role"), userId: id, role: z.enum(["leader", "vice", "sub", "captain", "member"]) }),
  z.object({ action: z.literal("settings"), name: clanName.optional(), description: description.nullable().optional() }),
  z.object({ action: z.literal("donate"), amount: positiveAmount }),
  z.object({ action: z.literal("gift"), username: z.string().trim().min(1, "Informe o nome de usuário."), amount: positiveAmount }),
  z.object({
    action: z.literal("distribute_manual"),
    payouts: z.array(z.object({ userId: id, gold: amount, cash: amount })).min(1),
  }),
  z.object({
    action: z.literal("distribute_contribution"),
    currency,
    rankBy: currency,
    topCount: z.number().int().min(1).max(20),
    topAmount: amount,
    restAmount: amount,
  }),
  z.object({
    action: z.literal("tournament_create"),
    name: z.string().trim().min(3, "Dê um nome ao torneio.").max(60),
    description: description.optional(),
    startsAt: z.coerce.date(),
    prizes: z
      .array(z.object({ placement: z.number().int().min(1).max(20), gold: amount, cash: amount }))
      .min(1, "Defina ao menos uma premiação."),
  }),
  z.object({
    action: z.literal("tournament_finalize"),
    tournamentId: id,
    winners: z.array(z.object({ placement: z.number().int().min(1), userId: id })),
  }),
  z.object({ action: z.literal("tournament_cancel"), tournamentId: id }),
  z.object({ action: z.literal("decide_request"), requestId: id, approve: z.boolean() }),
]);

async function getUserId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json(await getClanPageData(userId));
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const a = parsed.data;

  try {
    const result = await (() => {
      switch (a.action) {
        case "create": return createClan(userId, a.name, a.description || undefined);
        case "request_join": return requestJoin(userId, a.clanId);
        case "cancel_own_request": return cancelOwnJoinRequest(userId, a.joinRequestId);
        case "accept_invite": return acceptInvite(userId, a.joinRequestId);
        case "invite": return invitePlayer(userId, a.username);
        case "respond_join": return respondJoinRequest(userId, a.joinRequestId, a.accept);
        case "leave": return leaveClan(userId);
        case "kick": return kickMember(userId, a.userId);
        case "change_role": return changeRole(userId, a.userId, a.role);
        case "settings": return updateSettings(userId, { name: a.name, description: a.description });
        case "donate": return donateToVault(userId, a.amount);
        case "gift": return giftCredits(userId, a.username, a.amount);
        case "distribute_manual": return distributeManual(userId, a.payouts);
        case "distribute_contribution": return distributeByContribution(userId, a);
        case "tournament_create": return createTournament(userId, a);
        case "tournament_finalize": return finalizeTournament(userId, a.tournamentId, a.winners);
        case "tournament_cancel": return cancelTournament(userId, a.tournamentId);
        case "decide_request": return decideRequest(userId, a.requestId, a.approve);
      }
    })();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ClanError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao processar a ação." }, { status: 500 });
  }
}
