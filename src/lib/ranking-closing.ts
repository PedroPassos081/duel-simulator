import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, formatBrt, weekRange } from "@/lib/brt";
import { getPeriodStandings, type DateRange } from "@/lib/rankings";
import { deliverReward } from "@/lib/admin-grants";
import { getPeriodPrizes, getPeriodsStatus, getWeekSchedule, type RankingPeriodKind } from "@/lib/site-settings";

// Quem entrega os prêmios automáticos no histórico do Admin
export const SYSTEM_ADMIN_ID = "system";
const TROPHY_PLACES = 3;
const PODIUM = ["🥇", "🥈", "🥉"];
const CHECK_EVERY_MS = 60_000;

export interface Period {
  kind: RankingPeriodKind;
  key: string;
  title: string; // "Semana 29/09 a 05/10" ou o nome da season
  range: DateRange;
}

/**
 * Encerra um período: troféus até o 3º lugar, prêmios da colocação e o
 * resultado no Jornal. A linha em RankingClosing garante que roda uma vez só.
 */
export async function closePeriod(period: Period) {
  const where = { kind_periodKey: { kind: period.kind, periodKey: period.key } };
  if (await prisma.rankingClosing.findUnique({ where })) return null;
  try {
    await prisma.rankingClosing.create({
      data: { kind: period.kind, periodKey: period.key, startsAt: period.range.start, endsAt: period.range.end },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null; // já encerrado
    throw err;
  }

  const standings = await getPeriodStandings(period.range);
  if (standings.length === 0) return { period, winners: 0 };

  const prizes = (await getPeriodPrizes())[period.kind];
  const label = period.kind === "week" ? "Semanal" : "Season";
  const delivered: string[] = [];

  for (const row of standings.filter((r) => r.position <= Math.max(TROPHY_PLACES, prizes.at(-1)?.placement ?? 0))) {
    if (row.position <= TROPHY_PLACES) {
      await prisma.trophy.create({
        data: { userId: row.userId, kind: period.kind === "week" ? "weekly" : "season", title: period.title, placement: row.position, refType: "RankingClosing", refId: period.key },
      });
    }
    for (const reward of prizes.find((p) => p.placement === row.position)?.rewards ?? []) {
      try {
        const summary = await deliverReward(SYSTEM_ADMIN_ID, row.userId, reward, "prize", `${label}: ${period.title} (${row.position}º)`);
        delivered.push(`${row.position}º: ${summary}`);
      } catch (err) {
        console.error("[ranking-closing] prêmio não entregue", period.key, row.userId, err);
      }
    }
  }

  // Resultado no Jornal
  const top = standings.slice(0, 10);
  const users = await prisma.user.findMany({ where: { id: { in: top.map((r) => r.userId) } }, select: { id: true, username: true, name: true } });
  const nameOf = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u?.username ? `@${u.username}` : u?.name ?? "Duelista";
  };
  const lines = top.map((r) => `${PODIUM[r.position - 1] ?? `${r.position}º`} ${nameOf(r.userId)} — ${r.points} pontos (${r.wins}V ${r.losses}D)`);
  const champion = nameOf(standings[0].userId);
  const post = await prisma.newsPost.create({
    data: {
      type: "tournament",
      title: `Resultado: ${period.title}`,
      summary: `${champion} venceu ${period.kind === "week" ? "a semana" : "a season"} com ${standings[0].points} pontos!`,
      content: [
        `Quem fez mais pontos ${period.kind === "week" ? "na semana" : "na season"} leva o troféu. Classificação final:`,
        lines.join("\n"),
        delivered.length > 0 ? `Prêmios entregues:\n${delivered.join("\n")}` : "",
        period.kind === "week" ? "A nova semana já começou: bons duelos!" : "A nova season já começou: bons duelos!",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  });
  await prisma.rankingClosing.update({ where: { kind_periodKey: { kind: period.kind, periodKey: period.key } }, data: { newsPostId: post.id } });
  return { period, winners: Math.min(TROPHY_PLACES, standings.length) };
}

/** Semana anterior e seasons que já terminaram e ainda não foram encerradas. */
async function pendingPeriods(now: Date): Promise<Period[]> {
  const periods: Period[] = [];

  const current = weekRange(now, await getWeekSchedule());
  const last = { start: addDays(current.start, -7), end: current.start };
  // Se o Admin mudou o dia da virada, não encerra uma semana que se sobrepõe à última encerrada
  const overlap = await prisma.rankingClosing.findFirst({ where: { kind: "week", endsAt: { gt: last.start } } });
  if (!overlap) {
    periods.push({ kind: "week", key: last.start.toISOString(), title: `Semana ${formatBrt(last.start)} a ${formatBrt(new Date(last.end.getTime() - 1))}`, range: last });
  }

  const [seasons, closed] = await Promise.all([
    prisma.season.findMany({ where: { endsAt: { lte: now } }, orderBy: { endsAt: "desc" }, take: 6 }),
    prisma.rankingClosing.findMany({ where: { kind: "season" }, select: { periodKey: true } }),
  ]);
  const done = new Set(closed.map((c) => c.periodKey));
  for (const s of seasons.reverse()) {
    if (!done.has(s.id)) periods.push({ kind: "season", key: s.id, title: s.name, range: { start: s.startsAt, end: s.endsAt } });
  }
  return periods;
}

let lastCheck = 0;
let running: Promise<void> | null = null;

/**
 * Encerra o que já terminou (chamado ao abrir o ranking, o perfil, o Jornal e
 * no fim de cada duelo). Checa no máximo uma vez por minuto por servidor.
 */
export function closeFinishedPeriods(now = new Date()) {
  if (running) return running;
  if (Date.now() - lastCheck < CHECK_EVERY_MS) return Promise.resolve();
  lastCheck = Date.now();
  running = (async () => {
    try {
      // Desligado (jogo ainda não lançado): nada é encerrado nem premiado
      const status = await getPeriodsStatus();
      if (!status.enabled) return;
      const since = status.enabledAt ? new Date(status.enabledAt) : null;
      for (const period of await pendingPeriods(now)) {
        if (since && period.range.end <= since) continue; // terminou antes de ligar
        await closePeriod(period);
      }
    } catch (err) {
      console.error("[ranking-closing]", err);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Para testes e para o Admin forçar a checagem agora. */
export async function closeFinishedPeriodsNow(now = new Date()) {
  lastCheck = 0;
  if (running) await running;
  return closeFinishedPeriods(now);
}
