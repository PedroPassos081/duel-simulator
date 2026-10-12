import { Prisma } from "@prisma/client";
import { atomicWork, prisma } from "@/lib/prisma";
import { addDays, formatBrt, weekRange } from "@/lib/brt";
import {
  getClanPeriodStandings,
  getPeriodStandings,
  type DateRange,
} from "@/lib/rankings";
import { deliverReward } from "@/lib/admin-grants";
import {
  getClanSeasonPrizes,
  getPeriodPrizes,
  getPeriodsStatus,
  getWeekSchedule,
  type RankingPeriodKind,
} from "@/lib/site-settings";
import { grantClanPrize } from "@/lib/clans/service";

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
  return atomicWork(["economy"], async () => {
    const where = {
      kind_periodKey: { kind: period.kind, periodKey: period.key },
    };
    if (await prisma.rankingClosing.findUnique({ where })) return null;
    try {
      await prisma.rankingClosing.create({
        data: {
          kind: period.kind,
          periodKey: period.key,
          startsAt: period.range.start,
          endsAt: period.range.end,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      )
        return null; // já encerrado
      throw err;
    }

    const standings = await getPeriodStandings(period.range);
    if (standings.length === 0) return { period, winners: 0 };

    const prizes = (await getPeriodPrizes())[period.kind];
    const label = period.kind === "week" ? "Semanal" : "Season";
    const delivered: string[] = [];

    for (const row of standings.filter(
      (r) =>
        r.position <= Math.max(TROPHY_PLACES, prizes.at(-1)?.placement ?? 0),
    )) {
      if (row.position <= TROPHY_PLACES) {
        await prisma.trophy.create({
          data: {
            userId: row.userId,
            kind: period.kind === "week" ? "weekly" : "season",
            title: period.title,
            placement: row.position,
            refType: "RankingClosing",
            refId: period.key,
          },
        });
      }
      for (const reward of prizes.find((p) => p.placement === row.position)
        ?.rewards ?? []) {
        try {
          const summary = await deliverReward(
            SYSTEM_ADMIN_ID,
            row.userId,
            reward,
            "prize",
            `${label}: ${period.title} (${row.position}º)`,
          );
          delivered.push(`${row.position}º: ${summary}`);
        } catch (err) {
          throw err;
        }
      }
    }

    // Resultado no Jornal
    const top = standings.slice(0, 10);
    const users = await prisma.user.findMany({
      where: { id: { in: top.map((r) => r.userId) } },
      select: { id: true, username: true, name: true },
    });
    const nameOf = (id: string) => {
      const u = users.find((x) => x.id === id);
      return u?.username ? `@${u.username}` : (u?.name ?? "Duelista");
    };
    const lines = top.map(
      (r) =>
        `${PODIUM[r.position - 1] ?? `${r.position}º`} ${nameOf(r.userId)} — ${r.points} pontos (${r.wins}V ${r.losses}D)`,
    );
    const champion = nameOf(standings[0].userId);
    const post = await prisma.newsPost.create({
      data: {
        type: "tournament",
        title: `Resultado: ${period.title}`,
        summary: `${champion} venceu ${period.kind === "week" ? "a semana" : "a season"} com ${standings[0].points} pontos!`,
        content: [
          `Quem fez mais pontos ${period.kind === "week" ? "na semana" : "na season"} leva o troféu. Classificação final:`,
          lines.join("\n"),
          delivered.length > 0
            ? `Prêmios entregues:\n${delivered.join("\n")}`
            : "",
          period.kind === "week"
            ? "A nova semana já começou: bons duelos!"
            : "A nova season já começou: bons duelos!",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    });
    await prisma.rankingClosing.update({
      where: { kind_periodKey: { kind: period.kind, periodKey: period.key } },
      data: { newsPostId: post.id },
    });
    return { period, winners: Math.min(TROPHY_PLACES, standings.length) };
  });
}

/**
 * Encerra a Season dos clãs: o prêmio de cada colocação (gold e crédito) vai para o
 * cofre do clã e o resultado sai no Jornal. Roda uma vez só por season (RankingClosing).
 */
export async function closeClanSeason(season: {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
}) {
  return atomicWork(["economy"], async () => {
    const where = {
      kind_periodKey: { kind: "clan_season", periodKey: season.id },
    };
    if (await prisma.rankingClosing.findUnique({ where })) return null;
    try {
      await prisma.rankingClosing.create({
        data: {
          kind: "clan_season",
          periodKey: season.id,
          startsAt: season.startsAt,
          endsAt: season.endsAt,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      )
        return null;
      throw err;
    }

    const standings = await getClanPeriodStandings({
      start: season.startsAt,
      end: season.endsAt,
    });
    if (standings.length === 0) return { winners: 0 };
    const tiers = await getClanSeasonPrizes();
    const lastPlace = tiers.at(-1)?.placement ?? 0;
    const clans = await prisma.clan.findMany({
      where: { id: { in: standings.slice(0, 10).map((r) => r.clanId) } },
      select: { id: true, name: true },
    });
    const nameOf = (id: string) =>
      clans.find((c) => c.id === id)?.name ?? "Clã";
    const delivered: string[] = [];

    for (const row of standings.filter((r) => r.position <= lastPlace)) {
      const tier = tiers.find((t) => t.placement === row.position);
      if (!tier) continue;
      const ref = { type: "ClanSeason", id: `${season.id}:${row.clanId}` };
      try {
        if (tier.gold > 0)
          await grantClanPrize(row.clanId, "gold", tier.gold, ref);
        if (tier.cash > 0)
          await grantClanPrize(row.clanId, "cash", tier.cash, ref);
        const parts = [
          tier.gold > 0 && `${tier.gold} gold`,
          tier.cash > 0 && `${tier.cash} crédito`,
        ].filter(Boolean);
        delivered.push(
          `${row.position}º ${nameOf(row.clanId)}: ${parts.join(" + ")}`,
        );
      } catch (err) {
        throw err;
      }
    }

    const lines = standings
      .slice(0, 10)
      .map(
        (r) =>
          `${PODIUM[r.position - 1] ?? `${r.position}º`} ${nameOf(r.clanId)} — ${r.value} pontos`,
      );
    const post = await prisma.newsPost.create({
      data: {
        type: "tournament",
        title: `Resultado: Season dos Clãs — ${season.name}`,
        summary: `${nameOf(standings[0].clanId)} foi o clã campeão da season com ${standings[0].value} pontos!`,
        content: [
          "Os clãs que mais pontuaram na season levam prêmios direto para o cofre. Classificação final:",
          lines.join("\n"),
          delivered.length > 0
            ? `Prêmios entregues ao cofre:\n${delivered.join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    });
    await prisma.rankingClosing.update({
      where: { kind_periodKey: { kind: "clan_season", periodKey: season.id } },
      data: { newsPostId: post.id },
    });
    return { winners: delivered.length };
  });
}

/** Semana anterior e seasons que já terminaram e ainda não foram encerradas. */
async function pendingPeriods(now: Date): Promise<Period[]> {
  const periods: Period[] = [];

  const current = weekRange(now, await getWeekSchedule());
  const [latest, status] = await Promise.all([
    prisma.rankingClosing.findFirst({
      where: { kind: "week" },
      orderBy: { endsAt: "desc" },
    }),
    getPeriodsStatus(),
  ]);
  let start = latest
    ? weekRange(latest.endsAt, await getWeekSchedule()).start
    : status.enabledAt
      ? weekRange(new Date(status.enabledAt), await getWeekSchedule()).start
      : addDays(current.start, -7);
  // Catch up after downtime, in bounded batches. Later requests continue.
  for (
    let i = 0;
    start < current.start && i < 104;
    i++, start = addDays(start, 7)
  ) {
    const end = addDays(start, 7);
    if (latest && start < latest.endsAt) continue;
    periods.push({
      kind: "week",
      key: start.toISOString(),
      title: `Semana ${formatBrt(start)} a ${formatBrt(new Date(end.getTime() - 1))}`,
      range: { start, end },
    });
  }

  const [seasons, closed] = await Promise.all([
    prisma.season.findMany({
      where: { endsAt: { lte: now } },
      orderBy: { endsAt: "desc" },
    }),
    prisma.rankingClosing.findMany({
      where: { kind: "season" },
      select: { periodKey: true },
    }),
  ]);
  const done = new Set(closed.map((c) => c.periodKey));
  for (const s of seasons.reverse()) {
    if (!done.has(s.id))
      periods.push({
        kind: "season",
        key: s.id,
        title: s.name,
        range: { start: s.startsAt, end: s.endsAt },
      });
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
      // Season dos clãs: fecha junto com a season dos jogadores
      const ended = await prisma.season.findMany({
        where: { endsAt: { lte: now } },
        orderBy: { endsAt: "desc" },
      });
      for (const season of ended.reverse()) {
        if (since && season.endsAt <= since) continue;
        await closeClanSeason(season);
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
