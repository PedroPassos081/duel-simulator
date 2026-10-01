import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { getMatchScoring, getPeriodPrizes, getPeriodsStatus, getWeekSchedule, setMatchScoring, setPeriodPrizes, setPeriodsEnabled, setWeekSchedule } from "@/lib/site-settings";
import { createSeason, getCurrentSeason, listSeasons, SeasonError } from "@/lib/seasons";
import { rewardSchema } from "@/lib/reward-schema";
import { weekRange } from "@/lib/brt";
import { closeFinishedPeriods } from "@/lib/ranking-closing";

// Aba Season do Admin: pontuação por duelo, gold do Random, semana, seasons e prêmios
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  await closeFinishedPeriods();
  await getCurrentSeason(); // garante a season do mês
  const [scoring, week, prizes, seasons, status] = await Promise.all([getMatchScoring(), getWeekSchedule(), getPeriodPrizes(), listSeasons(), getPeriodsStatus()]);
  return NextResponse.json({ scoring, week, currentWeek: weekRange(new Date(), week), prizes, seasons, enabled: status.enabled });
}

const outcome = z.object({ win: z.number().int(), loss: z.number().int(), draw: z.number().int() });
const tiers = z.array(z.object({ placement: z.number().int().min(1).max(10), rewards: z.array(rewardSchema).max(10) })).max(10);
const updateSchema = z.object({
  scoring: z.object({ points: z.object({ random: outcome, official: outcome, quick: outcome }), gold: outcome, tournamentGold: outcome }).optional(),
  week: z.object({ weekday: z.number().int().min(0).max(6), hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59) }).optional(),
  prizes: z.object({ week: tiers, season: tiers }).optional(),
  enabled: z.boolean().optional(),
});
const seasonSchema = z.object({ name: z.string().trim().min(2).max(60), startsAt: z.coerce.date(), endsAt: z.coerce.date() });

// PUT: salva a pontuação, a virada da semana e/ou os prêmios
export async function PUT(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Confira os valores (use números inteiros)." }, { status: 400 });
  try {
    const { scoring, week, prizes, enabled } = parsed.data;
    if (enabled !== undefined) await setPeriodsEnabled(enabled, admin.id);
    if (scoring) await setMatchScoring(scoring, admin.id);
    if (week) await setWeekSchedule(week, admin.id);
    if (prizes) await setPeriodPrizes(prizes, admin.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
}

// POST: cria uma season (sem sobrepor outra)
export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = seasonSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Informe nome, início e fim." }, { status: 400 });
  try {
    return NextResponse.json(await createSeason(parsed.data), { status: 201 });
  } catch (err) {
    if (err instanceof SeasonError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
