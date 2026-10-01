import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deliverReward, describeReward, type GrantPayload } from "@/lib/admin-grants";
import { FINISHES, ITEMS, type Finish } from "@/lib/card-finish";
import { HIDDEN_CARD_NAMES } from "@/lib/site";
import { brtDate, brtParts, weekRange } from "@/lib/brt";
import { CREDIT_LABEL } from "@/lib/shop-rules";

// ---------------------------------------------------------------------------
// PASSE DE BATALHA
// Temporada com 50 níveis. Trilha grátis para todos; a Premium (paga em
// crédito) libera os prêmios melhores, inclusive dos níveis já alcançados.
// XP: cada duelo (mais na vitória) + missões diárias e semanais.
// ---------------------------------------------------------------------------

export class BattlePassError extends Error {}

export type MysteryReward = { kind: "mystery_card"; finish?: Finish };
// O jogador escolhe 1 entre alguns cosméticos (ex.: um dos 3 playmats)
export type ChoiceReward = { kind: "choice_cosmetic"; options: string[] };
export type PassReward = GrantPayload | MysteryReward | ChoiceReward;
export type Track = "free" | "premium";

// Carta surpresa: raridade sorteada quando o prêmio não fixa uma
const MYSTERY_WEIGHTS: [Finish, number][] = [
  ["normal", 55],
  ["rara", 30],
  ["ultra", 12],
  ["secreta", 3],
];

export interface Mission {
  key: string;
  period: "day" | "week";
  title: string;
  goal: number;
  xp: number;
  win?: boolean;
  room?: string;
  random?: boolean; // qualquer sala do Random (sem torneio)
  tournament?: boolean;
}

// Missões (diárias viram à meia-noite de Brasília; semanais na virada da semana)
export const MISSIONS: Mission[] = [
  { key: "d_play3", period: "day", title: "Jogue 3 duelos", goal: 3, xp: 150 },
  { key: "d_win1", period: "day", title: "Vença 1 duelo", goal: 1, xp: 150, win: true },
  { key: "w_win7", period: "week", title: "Vença 7 duelos", goal: 7, xp: 800, win: true },
  { key: "w_play15", period: "week", title: "Jogue 15 duelos", goal: 15, xp: 700 },
  { key: "w_random5", period: "week", title: "Jogue 5 duelos no Random", goal: 5, xp: 500, random: true },
  { key: "w_tournament", period: "week", title: "Jogue 1 duelo de torneio", goal: 1, xp: 500, tournament: true },
];

function periodRange(period: "day" | "week", now = new Date()) {
  if (period === "week") {
    const w = weekRange(now);
    return { ...w, key: `w-${w.start.toISOString().slice(0, 10)}` };
  }
  const p = brtParts(now);
  const start = brtDate(p.year, p.month, p.day);
  return { start, end: brtDate(p.year, p.month, p.day + 1), key: `d-${p.year}-${p.month + 1}-${p.day}` };
}

export function levelOf(xp: number, pass: { xpPerLevel: number; levels: number }) {
  return Math.min(pass.levels, Math.floor(xp / pass.xpPerLevel));
}

export async function getActivePass(now = new Date()) {
  return prisma.battlePass.findFirst({
    where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
  });
}

async function progressFor(passId: string, userId: string) {
  return prisma.battlePassProgress.upsert({
    where: { passId_userId: { passId, userId } },
    update: {},
    create: { passId, userId },
  });
}

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

/** XP do duelo (chamado quando a partida é fechada). */
export async function addMatchXp(userId: string, result: "win" | "loss" | "draw") {
  const pass = await getActivePass();
  if (!pass) return;
  const xp = result === "win" ? pass.xpWin : pass.xpLoss;
  if (xp <= 0) return;
  await prisma.battlePassProgress.upsert({
    where: { passId_userId: { passId: pass.id, userId } },
    update: { xp: { increment: xp } },
    create: { passId: pass.id, userId, xp },
  });
}

/** Soma XP no passe ativo (desafios diários e missões da conta também dão XP). */
export async function addPassXp(userId: string, xp: number) {
  const pass = await getActivePass();
  if (!pass || xp <= 0) return 0;
  await prisma.battlePassProgress.upsert({
    where: { passId_userId: { passId: pass.id, userId } },
    update: { xp: { increment: xp } },
    create: { passId: pass.id, userId, xp },
  });
  return xp;
}

async function missionProgress(userId: string, m: Mission, range: { start: Date; end: Date }) {
  return prisma.matchPlayer.count({
    where: {
      userId,
      ...(m.win ? { result: "win" } : { result: { in: ["win", "loss", "draw"] } }),
      match: {
        finishedAt: { gte: range.start, lt: range.end },
        ...(m.room ? { format: m.room, tournamentId: null } : {}),
        ...(m.random ? { tournamentId: null } : {}),
        ...(m.tournament ? { tournamentId: { not: null } } : {}),
      },
    },
  });
}

export async function claimMission(userId: string, key: string) {
  const pass = await getActivePass();
  if (!pass) throw new BattlePassError("Nenhum passe ativo agora.");
  const m = MISSIONS.find((x) => x.key === key);
  if (!m) throw new BattlePassError("Missão não encontrada.");
  const range = periodRange(m.period);
  if ((await missionProgress(userId, m, range)) < m.goal) throw new BattlePassError("Essa missão ainda não foi concluída.");
  try {
    await prisma.battlePassMissionClaim.create({ data: { passId: pass.id, userId, missionKey: m.key, periodKey: range.key, xp: m.xp } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new BattlePassError("Você já resgatou essa missão.");
    throw err;
  }
  await prisma.battlePassProgress.upsert({
    where: { passId_userId: { passId: pass.id, userId } },
    update: { xp: { increment: m.xp } },
    create: { passId: pass.id, userId, xp: m.xp },
  });
  return { message: `+${m.xp} XP! Missão "${m.title}" resgatada.` };
}

// ---------------------------------------------------------------------------
// PRÊMIOS
// ---------------------------------------------------------------------------

function pickFinish(fixed?: Finish): Finish {
  if (fixed) return fixed;
  const total = MYSTERY_WEIGHTS.reduce((n, [, w]) => n + w, 0);
  let roll = randomInt(total);
  for (const [finish, w] of MYSTERY_WEIGHTS) {
    if (roll < w) return finish;
    roll -= w;
  }
  return "normal";
}

/** Carta surpresa: qualquer carta lançada que está na loja, com raridade sorteada. */
async function pickMysteryCard() {
  const count = await prisma.shopListing.count({ where: { active: true, card: { released: true, name: { notIn: HIDDEN_CARD_NAMES } } } });
  const listing = await prisma.shopListing.findFirst({
    where: { active: true, card: { released: true, name: { notIn: HIDDEN_CARD_NAMES } } },
    skip: randomInt(Math.max(1, count)),
    select: { cardId: true },
  });
  if (!listing) throw new BattlePassError("Não há cartas para sortear.");
  return listing.cardId;
}

/** Resgata o prêmio de um nível (grátis ou Premium). */
export async function claimReward(userId: string, level: number, track: Track, choiceId?: string) {
  const pass = await getActivePass();
  if (!pass) throw new BattlePassError("Nenhum passe ativo agora.");
  const progress = await progressFor(pass.id, userId);
  if (levelOf(progress.xp, pass) < level) throw new BattlePassError(`Chegue ao nível ${level} para resgatar.`);
  if (track === "premium" && !progress.premium) throw new BattlePassError("Esse prêmio é da trilha Premium.");
  const row = await prisma.battlePassReward.findUnique({ where: { passId_level_track: { passId: pass.id, level, track } } });
  if (!row) throw new BattlePassError("Esse nível não tem prêmio nessa trilha.");
  const rewardRow = row.reward as unknown as PassReward;
  if (rewardRow.kind === "choice_cosmetic" && (!choiceId || !rewardRow.options.includes(choiceId))) {
    throw new BattlePassError("Escolha um dos itens para resgatar.");
  }

  // Marca como resgatado antes de entregar: clique duplo não entrega em dobro
  let claim;
  try {
    claim = await prisma.battlePassClaim.create({ data: { progressId: progress.id, level, track, summary: "..." } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new BattlePassError("Você já resgatou esse prêmio.");
    throw err;
  }

  const reward = row.reward as unknown as PassReward;
  const note = `Passe de Batalha: ${pass.name} (nível ${level}${track === "premium" ? ", Premium" : ""})`;
  let summary: string;
  // Para a revelação na tela (carta surpresa vira na hora)
  let reveal: { cardId: number; finish: Finish } | null = reward.kind === "card" ? { cardId: reward.cardId, finish: reward.variant.finish } : null;
  try {
    if (reward.kind === "choice_cosmetic") {
      summary = await deliverReward("system", userId, { kind: "cosmetic", cosmeticId: choiceId! }, "event", note);
    } else if (reward.kind === "mystery_card") {
      const cardId = await pickMysteryCard();
      const finish = pickFinish(reward.finish);
      reveal = { cardId, finish };
      summary = `Carta surpresa: ${await deliverReward("system", userId, { kind: "card", cardId, quantity: 1, variant: { finish, border: "none" } }, "event", note)}`;
    } else {
      summary = await deliverReward("system", userId, reward, "event", note);
    }
  } catch (err) {
    await prisma.battlePassClaim.delete({ where: { id: claim.id } }); // devolve para tentar de novo
    throw err;
  }
  await prisma.battlePassClaim.update({ where: { id: claim.id }, data: { summary } });
  const card = reveal ? await prisma.card.findUnique({ where: { id: reveal.cardId }, select: { name: true, imageUrl: true } }) : null;
  return {
    message: `Você recebeu: ${summary}`,
    summary,
    mystery: reward.kind === "mystery_card",
    reveal: card && reveal ? { name: card.name, imageUrl: card.imageUrl, finish: reveal.finish } : null,
  };
}

/** Compra o Premium (crédito). Os prêmios Premium dos níveis já alcançados ficam liberados. */
export async function buyPremium(userId: string) {
  const pass = await getActivePass();
  if (!pass) throw new BattlePassError("Nenhum passe ativo agora.");
  const progress = await progressFor(pass.id, userId);
  if (progress.premium) throw new BattlePassError("Você já tem o Premium deste passe.");
  await prisma.$transaction(
    async (tx) => {
      const wallet = await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
      if (wallet.cash < pass.premiumPriceCash) throw new BattlePassError(`${CREDIT_LABEL} insuficiente: o Premium custa ${pass.premiumPriceCash}.`);
      const balanceAfter = wallet.cash - pass.premiumPriceCash;
      await tx.wallet.update({ where: { userId }, data: { cash: balanceAfter } });
      await tx.currencyTransaction.create({
        data: { userId, currency: "cash", amount: -pass.premiumPriceCash, balanceAfter, reason: "battle_pass", refType: "BattlePass", refId: pass.id },
      });
      const { count } = await tx.battlePassProgress.updateMany({ where: { id: progress.id, premium: false }, data: { premium: true, premiumAt: new Date() } });
      if (count === 0) throw new BattlePassError("Você já tem o Premium deste passe.");
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
  return { message: "Passe Premium ativado! Resgate os prêmios dourados." };
}

// ---------------------------------------------------------------------------
// TELA
// ---------------------------------------------------------------------------

export interface RewardView {
  kind: string;
  label: string;
  imageUrl: string | null;
  finish: Finish | null;
  cosmeticType?: string;
  effect?: string | null;
  options?: { id: string; name: string; imageUrl: string | null; type: string; effect: string | null }[];
  itemKey?: string;
  currency?: string;
  amount?: number;
}

/** Texto e imagem de cada prêmio (para a trilha). */
async function rewardViews(rows: { reward: Prisma.JsonValue }[]) {
  const rewards = rows.map((r) => r.reward as unknown as PassReward);
  const cardIds = rewards.flatMap((r) => (r.kind === "card" ? [r.cardId] : []));
  const cosmeticIds = rewards.flatMap((r) => (r.kind === "cosmetic" ? [r.cosmeticId] : r.kind === "choice_cosmetic" ? r.options : []));
  const deckIds = rewards.flatMap((r) => (r.kind === "structure" ? [r.structureDeckId] : []));
  const [cards, cosmetics, decks] = await Promise.all([
    prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, name: true, imageUrl: true } }),
    prisma.cosmetic.findMany({ where: { id: { in: cosmeticIds } }, select: { id: true, name: true, imageUrl: true, type: true, effect: true } }),
    prisma.structureDeck.findMany({ where: { id: { in: deckIds } }, select: { id: true, name: true, coverCardId: true } }),
  ]);
  return rewards.map((r): RewardView => {
    switch (r.kind) {
      case "currency":
        return { kind: "currency", currency: r.currency, amount: r.amount, label: `${r.amount.toLocaleString("pt-BR")} ${r.currency === "gold" ? "gold" : CREDIT_LABEL.toLowerCase()}`, imageUrl: null, finish: null };
      case "card": {
        const c = cards.find((x) => x.id === r.cardId);
        const finish = r.variant.finish;
        return { kind: "card", label: `${r.quantity > 1 ? `${r.quantity}x ` : ""}${c?.name ?? "Carta"}${finish !== "normal" ? ` (${FINISHES[finish].label})` : ""}`, imageUrl: c?.imageUrl ?? null, finish };
      }
      case "cosmetic": {
        const c = cosmetics.find((x) => x.id === r.cosmeticId);
        return { kind: "cosmetic", label: c?.name ?? "Cosmético", imageUrl: c?.imageUrl ?? null, finish: null, cosmeticType: c?.type, effect: c?.effect };
      }
      case "item":
        return { kind: "item", itemKey: r.itemKey, label: `${r.quantity > 1 ? `${r.quantity}x ` : ""}${ITEMS[r.itemKey].name}`, imageUrl: null, finish: null };
      case "structure": {
        const d = decks.find((x) => x.id === r.structureDeckId);
        return { kind: "structure", label: `Structure Deck ${d?.name ?? ""} (${r.edition === "premium" ? "Premium" : "Base"})`, imageUrl: d?.coverCardId ? `https://images.ygoprodeck.com/images/cards/${d.coverCardId}.jpg` : null, finish: null };
      }
      case "vip":
        return { kind: "vip", label: `VIP por ${r.days} dia${r.days === 1 ? "" : "s"}`, imageUrl: null, finish: null, amount: r.days };
      case "mystery_card":
        return { kind: "mystery_card", label: r.finish ? `Carta surpresa ${FINISHES[r.finish].label}` : "Carta surpresa", imageUrl: null, finish: r.finish ?? null };
      case "choice_cosmetic": {
        const options = r.options.map((id) => cosmetics.find((x) => x.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
        const type = options[0]?.type;
        const what = type === "playmat" ? "playmats" : type === "sleeve" ? "sleeves" : "itens";
        return {
          kind: "choice_cosmetic",
          label: `Escolha 1 de ${options.length} ${what}`,
          imageUrl: options[0]?.imageUrl ?? null,
          finish: null,
          cosmeticType: type,
          options: options.map((o) => ({ id: o.id, name: o.name, imageUrl: o.imageUrl, type: o.type, effect: o.effect })),
        };
      }
    }
  });
}

/** Tudo da tela do passe para o jogador. */
export async function getPassView(userId: string | null) {
  const pass = await getActivePass();
  if (!pass) return null;
  const [rows, progress] = await Promise.all([
    prisma.battlePassReward.findMany({ where: { passId: pass.id }, orderBy: [{ level: "asc" }, { track: "asc" }] }),
    userId ? prisma.battlePassProgress.findUnique({ where: { passId_userId: { passId: pass.id, userId } }, include: { claims: true } }) : null,
  ]);
  const views = await rewardViews(rows);
  const xp = progress?.xp ?? 0;
  const level = levelOf(xp, pass);

  const missions = userId
    ? await Promise.all(
        MISSIONS.map(async (m) => {
          const range = periodRange(m.period);
          const [done, claimed] = await Promise.all([
            missionProgress(userId, m, range),
            prisma.battlePassMissionClaim.findUnique({ where: { passId_userId_missionKey_periodKey: { passId: pass.id, userId, missionKey: m.key, periodKey: range.key } } }),
          ]);
          return { key: m.key, period: m.period, title: m.title, goal: m.goal, xp: m.xp, progress: Math.min(done, m.goal), claimed: Boolean(claimed), resetsAt: range.end.toISOString() };
        })
      )
    : [];

  return {
    pass: {
      id: pass.id,
      name: pass.name,
      description: pass.description,
      artUrl: pass.artCardId ? `https://images.ygoprodeck.com/images/cards_cropped/${pass.artCardId}.jpg` : null,
      endsAt: pass.endsAt.toISOString(),
      levels: pass.levels,
      xpPerLevel: pass.xpPerLevel,
      xpWin: pass.xpWin,
      xpLoss: pass.xpLoss,
      premiumPriceCash: pass.premiumPriceCash,
    },
    progress: { xp, level, premium: progress?.premium ?? false, xpInLevel: level >= pass.levels ? pass.xpPerLevel : xp % pass.xpPerLevel },
    rewards: rows.map((r, i) => ({
      level: r.level,
      track: r.track as Track,
      ...views[i],
      claimed: progress?.claims.find((c) => c.level === r.level && c.track === r.track)?.summary ?? null,
    })),
    missions,
  };
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

export interface PassInput {
  name: string;
  description?: string | null;
  artCardId?: number | null;
  startsAt: Date;
  endsAt: Date;
  levels: number;
  xpPerLevel: number;
  xpWin: number;
  xpLoss: number;
  premiumPriceCash: number;
  active: boolean;
}

function validatePass(input: PassInput) {
  if (input.name.trim().length < 3) throw new BattlePassError("Dê um nome ao passe.");
  if (!(input.endsAt > input.startsAt)) throw new BattlePassError("O fim precisa ser depois do início.");
  if (input.levels < 1 || input.levels > 200) throw new BattlePassError("De 1 a 200 níveis.");
  if (input.xpPerLevel < 1) throw new BattlePassError("XP por nível precisa ser maior que zero.");
}

export async function listPasses() {
  return prisma.battlePass.findMany({ orderBy: { startsAt: "desc" }, include: { _count: { select: { rewards: true, progress: true } } } });
}

export async function createPass(input: PassInput) {
  validatePass(input);
  return prisma.battlePass.create({ data: { ...input, name: input.name.trim() } });
}

export async function updatePass(id: string, input: PassInput) {
  validatePass(input);
  return prisma.battlePass.update({ where: { id }, data: { ...input, name: input.name.trim() } });
}

/** Coloca (ou tira, com reward null) o prêmio de um nível numa trilha. */
export async function setPassReward(passId: string, level: number, track: Track, reward: PassReward | null) {
  if (!reward) {
    await prisma.battlePassReward.deleteMany({ where: { passId, level, track } });
    return;
  }
  if (reward.kind === "choice_cosmetic") {
    const found = await prisma.cosmetic.count({ where: { id: { in: reward.options } } });
    if (found !== reward.options.length || reward.options.length < 2) throw new BattlePassError("Escolha pelo menos 2 cosméticos que existam.");
  } else if (reward.kind !== "mystery_card") await describeReward(reward); // confere se a carta/cosmético existe
  await prisma.battlePassReward.upsert({
    where: { passId_level_track: { passId, level, track } },
    update: { reward: reward as never },
    create: { passId, level, track, reward: reward as never },
  });
}

export async function getPassRewardsForAdmin(passId: string) {
  const rows = await prisma.battlePassReward.findMany({ where: { passId }, orderBy: [{ level: "asc" }, { track: "asc" }] });
  const views = await rewardViews(rows);
  return rows.map((r, i) => ({ level: r.level, track: r.track, reward: r.reward, label: views[i].label }));
}

// ---------------------------------------------------------------------------
// VITRINE DE COSMÉTICOS (aba Cosméticos da loja)
// ---------------------------------------------------------------------------

/** Cosméticos dos passes (para o Admin colocar na loja). */
export async function listPassCosmetics() {
  const rows = await prisma.battlePassReward.findMany({ select: { reward: true } });
  const ids = new Set<string>();
  for (const r of rows) {
    const reward = r.reward as unknown as PassReward;
    if (reward.kind === "cosmetic") ids.add(reward.cosmeticId);
    if (reward.kind === "choice_cosmetic") reward.options.forEach((id) => ids.add(id));
  }
  return prisma.cosmetic.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, type: true, imageUrl: true, effect: true, inShop: true, priceCash: true, shopUnlockAt: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function setCosmeticShop(id: string, input: { inShop: boolean; priceCash: number; shopUnlockAt: Date | null }) {
  if (input.priceCash < 1) throw new BattlePassError("O preço precisa ser maior que zero.");
  await prisma.cosmetic.update({ where: { id }, data: input });
}

/** Vitrine para os jogadores: trancados até a data, com preço em crédito. */
export async function listShopCosmetics(userId: string | null) {
  const [items, owned] = await Promise.all([
    prisma.cosmetic.findMany({
      where: { inShop: true, active: true, priceCash: { not: null } },
      select: { id: true, name: true, description: true, type: true, imageUrl: true, effect: true, rarity: true, priceCash: true, shopUnlockAt: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    userId ? prisma.userCosmetic.findMany({ where: { userId }, select: { cosmeticId: true } }) : [],
  ]);
  const mine = new Set(owned.map((o) => o.cosmeticId));
  const now = new Date();
  return items.map((c) => ({
    ...c,
    shopUnlockAt: c.shopUnlockAt?.toISOString() ?? null,
    locked: Boolean(c.shopUnlockAt && c.shopUnlockAt > now),
    owned: mine.has(c.id),
  }));
}
