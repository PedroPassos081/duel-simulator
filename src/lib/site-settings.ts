import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SALE_PERCENT, MAX_SALE_PERCENT, MIN_SALE_PERCENT } from "@/lib/card-sale-rules";
import type { FinishPercents } from "@/lib/card-finish";
import type { TierPrices } from "@/lib/card-prices";
import { DEFAULT_SHOP_PRICING, type ItemShopPricing, type ShopPricing } from "@/lib/shop-pricing";
import { DEFAULT_MATCH_SCORING, type MatchScoring } from "@/lib/match-scoring";
import { DEFAULT_WEEK_SCHEDULE, isWeekSchedule, type WeekSchedule } from "@/lib/brt";
import type { GrantPayload } from "@/lib/admin-grants";

// Configurações que o Admin muda pelo painel (/admin). Guardadas em SiteSetting.
const CARD_SALE_PERCENT = "card_sale_percent";

type Db = Prisma.TransactionClient | typeof prisma;

/** % do preço da loja que o jogador recebe ao vender uma carta. */
export async function getCardSalePercent(db: Db = prisma) {
  const row = await db.siteSetting.findUnique({ where: { key: CARD_SALE_PERCENT } });
  const value = Number(row?.value);
  return Number.isInteger(value) && value >= MIN_SALE_PERCENT && value <= MAX_SALE_PERCENT ? value : DEFAULT_SALE_PERCENT;
}

export async function setCardSalePercent(percent: number, adminId: string) {
  if (!Number.isInteger(percent) || percent < MIN_SALE_PERCENT || percent > MAX_SALE_PERCENT) {
    throw new Error(`A porcentagem deve ser um número inteiro entre ${MIN_SALE_PERCENT} e ${MAX_SALE_PERCENT}.`);
  }
  await prisma.siteSetting.upsert({
    where: { key: CARD_SALE_PERCENT },
    update: { value: String(percent), updatedBy: adminId },
    create: { key: CARD_SALE_PERCENT, value: String(percent), updatedBy: adminId },
  });
  return percent;
}

// ---------------------------------------------------------------------------
// Preços da loja: % das raridades, preço das categorias e itens (Pó do Milênio)
// ---------------------------------------------------------------------------

const FINISH_PERCENTS = "finish_percents";
const TIER_PRICES = "tier_prices";
const ITEM_SHOP = "item_shop";

async function readJson<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.siteSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    // Junta com o padrão: campos novos que ainda não foram salvos continuam valendo
    const saved = JSON.parse(row.value);
    return typeof fallback === "object" && fallback && !Array.isArray(fallback) ? { ...fallback, ...saved } : saved;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown, adminId: string) {
  const text = JSON.stringify(value);
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value: text, updatedBy: adminId },
    create: { key, value: text, updatedBy: adminId },
  });
}

const positiveInt = (n: unknown, max = 10_000_000) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;

/** Todos os preços configuráveis da loja. */
export async function getShopPricing(db: Db = prisma): Promise<ShopPricing> {
  const [finishPercents, tiers, items] = await Promise.all([
    readJson(db, FINISH_PERCENTS, DEFAULT_SHOP_PRICING.finishPercents),
    readJson(db, TIER_PRICES, DEFAULT_SHOP_PRICING.tiers),
    readJson(db, ITEM_SHOP, DEFAULT_SHOP_PRICING.items),
  ]);
  return { finishPercents, tiers, items: { ...items, prices: { ...DEFAULT_SHOP_PRICING.items.prices, ...items.prices } } };
}

export async function setFinishPercents(percents: FinishPercents, adminId: string) {
  const { rara, ultra, secreta } = percents;
  if (![rara, ultra, secreta].every((p) => positiveInt(p, 10_000) && p >= 100)) {
    throw new Error("Use porcentagens inteiras de 100 para cima (100% = preço da Normal).");
  }
  if (!(rara <= ultra && ultra <= secreta)) throw new Error("A ordem precisa ser Rara ≤ Ultra ≤ Secreta.");
  await writeJson(FINISH_PERCENTS, { rara, ultra, secreta }, adminId);
}

export async function setTierPrices(tiers: TierPrices, adminId: string) {
  for (const t of Object.values(tiers)) {
    if (!positiveInt(t.gold) || !positiveInt(t.cash)) throw new Error("Preços precisam ser números inteiros (0 ou mais).");
  }
  await writeJson(TIER_PRICES, tiers, adminId);
}

export async function setItemShop(items: ItemShopPricing, adminId: string) {
  for (const p of Object.values(items.prices)) {
    if (!positiveInt(p.cash) || !positiveInt(p.moneyCents)) throw new Error("Preços precisam ser números inteiros (0 ou mais).");
  }
  if (!positiveInt(items.moneyDiscountPercent, 90)) throw new Error("O desconto deve ser de 0 a 90%.");
  await writeJson(ITEM_SHOP, items, adminId);
}

// ---------------------------------------------------------------------------
// Pontuação por duelo e gold do Random (aba Season do Admin)
// ---------------------------------------------------------------------------

const MATCH_SCORING = "match_scoring";

export async function getMatchScoring(db: Db = prisma): Promise<MatchScoring> {
  const saved = await readJson(db, MATCH_SCORING, DEFAULT_MATCH_SCORING);
  return {
    points: { ...DEFAULT_MATCH_SCORING.points, ...saved.points },
    gold: { ...DEFAULT_MATCH_SCORING.gold, ...saved.gold },
    tournamentGold: { ...DEFAULT_MATCH_SCORING.tournamentGold, ...saved.tournamentGold },
  };
}

export async function setMatchScoring(scoring: MatchScoring, adminId: string) {
  const values = [...Object.values(scoring.points).flatMap((p) => Object.values(p)), ...Object.values(scoring.gold), ...Object.values(scoring.tournamentGold)];
  if (!values.every((v) => Number.isInteger(v) && Math.abs(v) <= 1_000_000)) {
    throw new Error("Use números inteiros (pontos podem ser negativos, ex.: -2).");
  }
  if ([...Object.values(scoring.gold), ...Object.values(scoring.tournamentGold)].some((g) => g < 0)) throw new Error("O gold por duelo não pode ser negativo.");
  await writeJson(MATCH_SCORING, scoring, adminId);
}

// ---------------------------------------------------------------------------
// Season e Semanal: horário da virada da semana e prêmios de cada colocação
// ---------------------------------------------------------------------------

const WEEK_SCHEDULE = "week_schedule";
const PERIOD_PRIZES = "period_prizes";

export type RankingPeriodKind = "week" | "season";
export interface PeriodPrizeTier {
  placement: number;
  rewards: GrantPayload[];
}
export type PeriodPrizes = Record<RankingPeriodKind, PeriodPrizeTier[]>;

export async function getWeekSchedule(db: Db = prisma): Promise<WeekSchedule> {
  const saved = await readJson(db, WEEK_SCHEDULE, DEFAULT_WEEK_SCHEDULE);
  return isWeekSchedule(saved) ? saved : DEFAULT_WEEK_SCHEDULE;
}

export async function setWeekSchedule(schedule: WeekSchedule, adminId: string) {
  if (!isWeekSchedule(schedule)) throw new Error("Dia ou horário inválido.");
  await writeJson(WEEK_SCHEDULE, schedule, adminId);
}

export async function getPeriodPrizes(db: Db = prisma): Promise<PeriodPrizes> {
  const saved = await readJson<Partial<PeriodPrizes>>(db, PERIOD_PRIZES, {});
  const clean = (tiers: unknown) =>
    Array.isArray(tiers) ? tiers.filter((t) => t && Number.isInteger(t.placement) && Array.isArray(t.rewards)).sort((a, b) => a.placement - b.placement) : [];
  return { week: clean(saved.week), season: clean(saved.season) };
}

export async function setPeriodPrizes(prizes: PeriodPrizes, adminId: string) {
  await writeJson(PERIOD_PRIZES, prizes, adminId);
}

// Season e Semanal ligadas? Desligadas até o lançamento do jogo.
// Ao ligar, só períodos que terminam depois disso são premiados.
const PERIODS_ENABLED = "ranking_periods_enabled";

export interface PeriodsStatus {
  enabled: boolean;
  enabledAt: string | null;
}

export async function getPeriodsStatus(db: Db = prisma): Promise<PeriodsStatus> {
  const saved = await readJson<Partial<PeriodsStatus>>(db, PERIODS_ENABLED, {});
  return { enabled: saved.enabled === true, enabledAt: typeof saved.enabledAt === "string" ? saved.enabledAt : null };
}

export async function setPeriodsEnabled(enabled: boolean, adminId: string) {
  const current = await getPeriodsStatus();
  if (current.enabled === enabled) return current;
  const next = { enabled, enabledAt: enabled ? new Date().toISOString() : current.enabledAt };
  await writeJson(PERIODS_ENABLED, next, adminId);
  return next;
}

// ---------------------------------------------------------------------------
// Abertura das salas do Random (a Obelisco começa fechada e abre na data marcada)
// ---------------------------------------------------------------------------

const ROOM_SCHEDULE = "room_schedule";

export interface RoomSchedule {
  open: boolean; // aberta agora (manual)
  opensAt: string | null; // abre sozinha nesta data (ISO)
  calendarEventId?: string | null;
}

// Padrão do lançamento do jogo: Slifer aberta, Obelisco fechada sem data
const DEFAULT_ROOM_SCHEDULE: Record<string, RoomSchedule> = {
  slifer: { open: true, opensAt: null },
  obelisk: { open: false, opensAt: null },
};

export async function getRoomSchedules(db: Db = prisma): Promise<Record<string, RoomSchedule>> {
  const saved = await readJson<Record<string, RoomSchedule>>(db, ROOM_SCHEDULE, {});
  return { ...DEFAULT_ROOM_SCHEDULE, ...saved };
}

export async function setRoomSchedule(roomId: string, schedule: RoomSchedule, adminId: string) {
  const all = await getRoomSchedules();
  await writeJson(ROOM_SCHEDULE, { ...all, [roomId]: schedule }, adminId);
}
