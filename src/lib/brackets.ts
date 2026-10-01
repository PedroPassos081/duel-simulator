import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { createCompetitionWithResults } from "@/lib/competitions";
import { deliverReward } from "@/lib/admin-grants";
import { settleMatch } from "@/lib/match-results";
import { validateDeckForBanlist } from "@/lib/matchmaking";
import { TOURNAMENT_TYPES, TROPHY_PLACES, TournamentError, parsePrizes, type TournamentType } from "@/lib/tournaments";

// ---------------------------------------------------------------------------
// TORNEIO EM CHAVES
// Inscrição com vagas → o Admin sorteia as chaves (A e B) e ativa → cada chave
// começa no seu horário e a Final no dela. Cada confronto é melhor de 3:
// um duelo abre depois do outro. Tela de espera de 5 min antes do 1º duelo de
// cada confronto (começa na hora se os dois entrarem). Quem não entra tem o
// tempo dele correndo; ao zerar, perde aquele duelo por W.O. No duelo seguinte,
// quem venceu por W.O. escolhe quem começa.
// ---------------------------------------------------------------------------

export const COUNTDOWN_MS = 5 * 60_000;
const CHECK_EVERY_MS = 5_000;
const OPEN_MATCH = ["waiting", "rps", "choosing", "active"];
export const STAGE_NAMES: Record<string, string> = { A: "Chave A", B: "Chave B", final: "Final" };

type Db = Prisma.TransactionClient | typeof prisma;

function shuffle<T>(list: T[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

async function bracketTournament(id: string) {
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t || t.structure !== "bracket") throw new TournamentError("Torneio em chaves não encontrado.");
  return t;
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

/** Sorteia os inscritos em duas chaves (A e B) e monta os confrontos até a Final. */
export async function generateBracket(tournamentId: string) {
  const t = await bracketTournament(tournamentId);
  if (t.status !== "open") throw new TournamentError("Esse torneio não está aberto.");
  if (t.activatedAt) throw new TournamentError("O torneio já foi ativado; as chaves não mudam mais.");
  const entries = await prisma.tournamentEntry.findMany({ where: { tournamentId }, select: { userId: true } });
  if (entries.length < 2) throw new TournamentError("Precisa de pelo menos 2 inscritos.");

  const players = shuffle(entries.map((e) => e.userId));
  const half = Math.ceil(players.length / 2);
  const groups = { A: players.slice(0, half), B: players.slice(half) };

  await prisma.$transaction(
    async (tx) => {
      // Sortear de novo: apaga os duelos do sorteio anterior (jogadores primeiro)
      await tx.matchPlayer.deleteMany({ where: { match: { series: { tournamentId } } } });
      await tx.match.deleteMany({ where: { series: { tournamentId } } });
      await tx.tournamentSeries.deleteMany({ where: { tournamentId } });
      const final = await tx.tournamentSeries.create({ data: { tournamentId, stageKey: "final", round: 1, slot: 0 } });

      for (const [key, list] of Object.entries(groups) as ["A" | "B", string[]][]) {
        const side = key; // o campeão da Chave A entra do lado A da Final
        if (list.length === 1) {
          await tx.tournamentSeries.update({ where: { id: final.id }, data: side === "A" ? { playerAId: list[0] } : { playerBId: list[0] } });
          continue;
        }
        const size = nextPow2(list.length);
        const rounds = Math.log2(size);
        // Da última rodada da chave para a primeira, para cada confronto saber para onde o vencedor vai
        let next: { id: string }[] = [];
        for (let round = rounds; round >= 1; round--) {
          const count = size / 2 ** round;
          const created: { id: string }[] = [];
          for (let slot = 0; slot < count; slot++) {
            const isLast = round === rounds;
            const target = isLast ? { id: final.id, side } : { id: next[Math.floor(slot / 2)].id, side: slot % 2 === 0 ? "A" : "B" };
            // 1ª rodada: melhores posições enfrentam os "byes" (quem sobra avança direto)
            const pair = round === 1 ? { playerAId: list[slot] ?? null, playerBId: list[size - 1 - slot] ?? null } : {};
            created.push(
              await tx.tournamentSeries.create({
                data: { tournamentId, stageKey: key, round, slot, nextSeriesId: target.id, nextSide: target.side, ...pair },
              })
            );
          }
          next = created;
        }
      }
    },
    { maxWait: 10_000, timeout: 120_000 }
  );

  // Quem ficou sem adversário na 1ª rodada já avança
  const firstRound = await prisma.tournamentSeries.findMany({ where: { tournamentId, round: 1, stageKey: { not: "final" } }, select: { id: true } });
  for (const s of firstRound) await resolveAutoWin(s.id);
  return { players: players.length };
}

export async function activateBracket(tournamentId: string) {
  const t = await bracketTournament(tournamentId);
  if (!(await prisma.tournamentSeries.count({ where: { tournamentId } }))) throw new TournamentError("Sorteie as chaves antes de ativar.");
  if (t.activatedAt) throw new TournamentError("O torneio já está ativo.");
  await prisma.tournament.update({ where: { id: tournamentId }, data: { activatedAt: new Date(), pausedAt: null } });
}

export async function pauseBracket(tournamentId: string, paused: boolean) {
  await bracketTournament(tournamentId);
  await prisma.tournament.update({ where: { id: tournamentId }, data: { pausedAt: paused ? new Date() : null } });
}

/** Muda horários das chaves/final, vagas e o tempo de cada jogador. */
export async function updateBracketSettings(
  tournamentId: string,
  input: { stages?: { key: string; startsAt: Date }[]; maxEntrants?: number | null; clockSeconds?: number }
) {
  const t = await bracketTournament(tournamentId);
  if (input.maxEntrants != null) {
    const count = await prisma.tournamentEntry.count({ where: { tournamentId } });
    if (input.maxEntrants < Math.max(2, count)) throw new TournamentError(`Já há ${count} inscritos; as vagas não podem ser menos que isso.`);
  }
  if (input.clockSeconds != null && (input.clockSeconds < 30 || input.clockSeconds > 3600)) throw new TournamentError("O tempo do jogador vai de 30 segundos a 60 minutos.");
  await prisma.$transaction(async (tx) => {
    for (const stage of input.stages ?? []) {
      await tx.tournamentStage.upsert({
        where: { tournamentId_key: { tournamentId, key: stage.key } },
        update: { startsAt: stage.startsAt },
        create: { tournamentId, key: stage.key, name: STAGE_NAMES[stage.key] ?? stage.key, startsAt: stage.startsAt },
      });
    }
    const stages = await tx.tournamentStage.findMany({ where: { tournamentId } });
    const times = stages.map((s) => s.startsAt.getTime());
    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        ...(input.maxEntrants !== undefined ? { maxEntrants: input.maxEntrants } : {}),
        ...(input.clockSeconds != null ? { clockSeconds: input.clockSeconds } : {}),
        // Período do torneio: da primeira chave até um dia depois da Final
        ...(times.length ? { startsAt: new Date(Math.min(...times)), endsAt: new Date(Math.max(...times) + 86_400_000) } : {}),
      },
    });
  });
  return t;
}

// ---------------------------------------------------------------------------
// CONFRONTOS
// ---------------------------------------------------------------------------

/** Lado sem ninguém que nunca vai ter jogador (bye ou confronto anterior sem vencedor). */
async function sideIsDead(db: Db, seriesId: string, side: "A" | "B") {
  const feeder = await db.tournamentSeries.findFirst({ where: { nextSeriesId: seriesId, nextSide: side } });
  return !feeder || (feeder.status === "finished" && !feeder.winnerId);
}

/** Confronto com um lado vazio para sempre: quem está avança sem duelar. */
async function resolveAutoWin(seriesId: string) {
  const s = await prisma.tournamentSeries.findUnique({ where: { id: seriesId } });
  if (!s || s.status !== "pending") return;
  const deadA = !s.playerAId && (await sideIsDead(prisma, s.id, "A"));
  const deadB = !s.playerBId && (await sideIsDead(prisma, s.id, "B"));
  if (s.playerAId && deadB) await finishSeries(s.id, s.playerAId);
  else if (s.playerBId && deadA) await finishSeries(s.id, s.playerBId);
  else if (deadA && deadB) await finishSeries(s.id, null);
}

async function finishSeries(seriesId: string, winnerId: string | null) {
  const { count } = await prisma.tournamentSeries.updateMany({ where: { id: seriesId, status: { not: "finished" } }, data: { status: "finished", winnerId } });
  if (count === 0) return;
  const s = await prisma.tournamentSeries.findUniqueOrThrow({ where: { id: seriesId } });
  if (s.nextSeriesId) {
    if (winnerId) await prisma.tournamentSeries.update({ where: { id: s.nextSeriesId }, data: s.nextSide === "A" ? { playerAId: winnerId } : { playerBId: winnerId } });
    await resolveAutoWin(s.nextSeriesId);
  } else if (s.stageKey === "final") {
    await finalizeBracket(s.tournamentId).catch((err) => console.error("[brackets] finalizar", err));
  }
}

/** Abre o duelo N de um confronto. O 1º tem tela de espera de 5 min; os seguintes abrem na hora. */
async function openGame(seriesId: string, gameNumber: number) {
  const s = await prisma.tournamentSeries.findUniqueOrThrow({ where: { id: seriesId }, include: { tournament: true } });
  if (!s.playerAId || !s.playerBId) return;
  const opensAt = new Date(Date.now() + (gameNumber === 1 ? COUNTDOWN_MS : 0));
  try {
    await prisma.match.create({
      data: {
        format: s.tournament.format,
        tournamentId: s.tournamentId,
        seriesId: s.id,
        gameNumber,
        status: "waiting",
        currentPhase: "waiting",
        opensAt,
        woAt: new Date(opensAt.getTime() + s.tournament.clockSeconds * 1000),
        // O deck é o equipado no momento em que o jogador entra
        players: { create: [{ userId: s.playerAId, deckId: "" }, { userId: s.playerBId, deckId: "" }] },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return; // já aberto por outra requisição
    throw err;
  }
  await prisma.tournamentSeries.update({ where: { id: s.id }, data: { status: "live" } });
}

/** Começa o duelo quando os dois entraram (1º duelo: pedra-papel-tesoura; os outros: quem escolhe decide a ordem). */
async function tryStart(matchId: string) {
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true, series: true } });
  if (!m || m.status !== "waiting" || !m.series || m.players.some((p) => !p.joinedAt)) return;
  const data =
    m.gameNumber === 1
      ? { status: "rps", currentPhase: "rps", rpsDeadline: new Date(Date.now() + 15_000), startedAt: new Date() }
      : { status: "choosing", currentPhase: "choosing_order", rpsWinnerId: m.series.chooserId ?? m.players[randomInt(2)].userId, startedAt: new Date() };
  await prisma.match.updateMany({ where: { id: m.id, status: "waiting" }, data });
}

/** Tempo esgotado: quem não entrou perde este duelo por W.O. */
async function applyWalkover(matchId: string) {
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true } });
  if (!m || m.status !== "waiting" || !m.woAt || m.woAt > new Date()) return;
  const { count } = await prisma.match.updateMany({ where: { id: m.id, status: "waiting" }, data: { status: "finished", currentPhase: "finished", finishedAt: new Date() } });
  if (count === 0) return;
  for (const p of m.players) await prisma.matchPlayer.update({ where: { id: p.id }, data: { result: p.joinedAt ? "win" : "loss" } });
  await settleMatch(m.id).catch((err) => console.error("[brackets] settle W.O.", err));
  await onBracketGameFinished(m.id);
}

/**
 * Depois de cada duelo do confronto: conta as vitórias, decide o confronto
 * (2 vitórias) ou abre o próximo duelo. Pode ser chamada mais de uma vez.
 */
export async function onBracketGameFinished(matchId: string) {
  const m = await prisma.match.findUnique({ where: { id: matchId }, select: { seriesId: true } });
  if (!m?.seriesId) return;
  const s = await prisma.tournamentSeries.findUniqueOrThrow({ where: { id: m.seriesId } });
  if (s.status === "finished" || !s.playerAId || !s.playerBId) return;
  const games = await prisma.match.findMany({ where: { seriesId: s.id }, include: { players: true }, orderBy: { gameNumber: "asc" } });
  const finished = games.filter((g) => g.status === "finished");
  const winsOf = (userId: string) => finished.filter((g) => g.players.some((p) => p.userId === userId && p.result === "win")).length;
  const winsA = winsOf(s.playerAId);
  const winsB = winsOf(s.playerBId);
  await prisma.tournamentSeries.update({ where: { id: s.id }, data: { winsA, winsB } });

  if (winsA >= 2) return finishSeries(s.id, s.playerAId);
  if (winsB >= 2) return finishSeries(s.id, s.playerBId);

  const last = finished.at(-1);
  // Ninguém entrou: os dois estão fora
  if (last && last.players.every((p) => p.result === "loss")) return finishSeries(s.id, null);
  if (games.some((g) => OPEN_MATCH.includes(g.status)) || !last) return;

  // Quem escolhe a ordem do próximo duelo: quem venceu por W.O. ou quem perdeu o duelo jogado
  const wasWalkover = last.players.some((p) => !p.joinedAt);
  const chooser = last.players.find((p) => (wasWalkover ? p.result === "win" : p.result === "loss"))?.userId ?? null;
  await prisma.tournamentSeries.update({ where: { id: s.id }, data: { chooserId: chooser } });
  await openGame(s.id, (last.gameNumber ?? finished.length) + 1);
}

/** O jogador abriu a sala do duelo: confere o deck e marca que entrou. */
export async function joinBracketGame(matchId: string, userId: string) {
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true } });
  if (!m?.seriesId || m.status !== "waiting") return { issue: null };
  const me = m.players.find((p) => p.userId === userId);
  if (!me) return { issue: null };
  if (!me.joinedAt) {
    const { deck, issues } = await validateDeckForBanlist(userId, m.format);
    if (!deck) return { issue: "Equipe um deck no Deck Builder para entrar no duelo." };
    if (issues.length) return { issue: `Seu deck não vale na banlist do torneio: ${issues[0].message}` };
    await prisma.matchPlayer.update({ where: { id: me.id }, data: { joinedAt: new Date(), deckId: deck.id } });
  }
  await tryStart(m.id);
  await applyWalkover(m.id);
  return { issue: null };
}

let lastCheck = 0;
let running: Promise<void> | null = null;

/** Faz o torneio andar: abre duelos no horário, começa quando os dois entram, aplica W.O. */
export function processBrackets() {
  if (running) return running;
  if (Date.now() - lastCheck < CHECK_EVERY_MS) return Promise.resolve();
  lastCheck = Date.now();
  running = (async () => {
    try {
      const now = new Date();
      // Duelos esperando jogadores: começa ou dá W.O.
      const waiting = await prisma.match.findMany({ where: { status: "waiting", seriesId: { not: null } }, select: { id: true, woAt: true } });
      for (const m of waiting) {
        await tryStart(m.id);
        if (m.woAt && m.woAt <= now) await applyWalkover(m.id);
      }
      // Confrontos prontos (dois jogadores) numa chave que já começou
      const tournaments = await prisma.tournament.findMany({
        where: { structure: "bracket", status: "open", activatedAt: { not: null } },
        include: { stages: true },
      });
      for (const t of tournaments) {
        const started = t.stages.filter((st) => st.startsAt <= now).map((st) => st.key);
        const series = await prisma.tournamentSeries.findMany({
          where: { tournamentId: t.id, status: { in: ["pending", "live"] }, playerAId: { not: null }, playerBId: { not: null } },
          include: { matches: { select: { status: true } } },
        });
        for (const s of series) {
          if (s.status === "pending") {
            // Pausado: nenhum confronto novo começa (os que já estão rolando continuam)
            if (!t.pausedAt && started.includes(s.stageKey)) await openGame(s.id, 1);
          } else if (!s.matches.some((mm) => OPEN_MATCH.includes(mm.status))) {
            await onBracketGameFinished((await prisma.match.findFirst({ where: { seriesId: s.id }, orderBy: { gameNumber: "desc" }, select: { id: true } }))?.id ?? "");
          }
        }
      }
    } catch (err) {
      console.error("[brackets]", err);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Fim da Final: colocações, troféus (1º, 2º e os dois 3º), prêmios e o resultado no Jornal. */
export async function finalizeBracket(tournamentId: string) {
  const t = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const final = await prisma.tournamentSeries.findFirst({ where: { tournamentId, stageKey: "final" } });
  if (!final || final.status !== "finished") throw new TournamentError("A Final ainda não terminou.");
  const { count } = await prisma.tournament.updateMany({ where: { id: tournamentId, status: "open" }, data: { status: "finished", finishedAt: new Date() } });
  if (count === 0) return;

  const placements = new Map<string, number>();
  if (final.winnerId) placements.set(final.winnerId, 1);
  const runnerUp = [final.playerAId, final.playerBId].find((p) => p && p !== final.winnerId);
  if (runnerUp) placements.set(runnerUp, 2);
  // 3º lugar: quem perdeu a decisão de cada chave
  const stageFinals = await prisma.tournamentSeries.findMany({ where: { tournamentId, nextSeriesId: final.id } });
  for (const sf of stageFinals) {
    const loser = [sf.playerAId, sf.playerBId].find((p) => p && p !== sf.winnerId);
    if (loser && !placements.has(loser)) placements.set(loser, 3);
  }

  const typeInfo = TOURNAMENT_TYPES[(t.type as TournamentType) ?? "official"] ?? TOURNAMENT_TYPES.official;
  const prizes = parsePrizes(t.prizes);
  for (const [userId, placement] of placements) {
    await prisma.tournamentEntry.updateMany({ where: { tournamentId, userId }, data: { placement } });
    if (placement <= TROPHY_PLACES) {
      await prisma.trophy.create({ data: { userId, kind: t.type, title: t.name, placement, refType: "Tournament", refId: tournamentId } });
    }
    for (const reward of prizes.find((p) => p.placement === placement)?.rewards ?? []) {
      await deliverReward(t.createdById, userId, reward, "prize", `${typeInfo.trophy}: ${t.name} (${placement}º)`).catch((err) => console.error("[brackets] prêmio", err));
    }
  }
  // Resultado no Jornal (pontos da Competição: 3, 2 e 1)
  const results = [...placements].map(([userId, placement]) => ({ userId, placement, points: 4 - placement }));
  if (results.length) await createCompetitionWithResults(t.name, new Date(), results, `${typeInfo.trophy} · chaves melhor de 3`);
}

// ---------------------------------------------------------------------------
// TELAS
// ---------------------------------------------------------------------------

/** Chaves para mostrar (jogadores, placar, situação de cada confronto). */
export async function getBracketView(tournamentId: string) {
  const [stages, series] = await Promise.all([
    prisma.tournamentStage.findMany({ where: { tournamentId } }),
    prisma.tournamentSeries.findMany({ where: { tournamentId }, orderBy: [{ round: "asc" }, { slot: "asc" }], include: { matches: { select: { id: true, status: true, gameNumber: true } } } }),
  ]);
  const ids = [...new Set(series.flatMap((s) => [s.playerAId, s.playerBId]).filter((x): x is string => Boolean(x)))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, ...userAvatarSelect } });
  const person = (id: string | null) => {
    const u = users.find((x) => x.id === id);
    return u ? { userId: u.id, avatar: toAvatarProps(u), playerName: toPlayerNameProps(u) } : null;
  };
  const order = ["A", "B", "final"];
  return {
    stages: stages.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((s) => ({ key: s.key, name: s.name, startsAt: s.startsAt.toISOString() })),
    series: series.map((s) => ({
      id: s.id,
      stageKey: s.stageKey,
      round: s.round,
      slot: s.slot,
      a: person(s.playerAId),
      b: person(s.playerBId),
      winsA: s.winsA,
      winsB: s.winsB,
      winnerId: s.winnerId,
      status: s.status,
      liveMatchId: s.matches.find((m) => OPEN_MATCH.includes(m.status))?.id ?? null,
    })),
  };
}

/** Duelo de torneio do jogador agora (para o aviso no topo e o botão "Entrar"). */
export async function getMyBracketMatch(userId: string) {
  await processBrackets();
  const match = await prisma.match.findFirst({
    where: { seriesId: { not: null }, status: { in: OPEN_MATCH }, players: { some: { userId } } },
    include: { tournament: { select: { name: true } }, series: true, players: { select: { userId: true, joinedAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (match?.series) {
    const meA = match.series.playerAId === userId;
    return {
      kind: "match" as const,
      matchId: match.id,
      tournament: match.tournament?.name ?? "Torneio",
      stage: STAGE_NAMES[match.series.stageKey] ?? match.series.stageKey,
      gameNumber: match.gameNumber ?? 1,
      score: meA ? `${match.series.winsA}-${match.series.winsB}` : `${match.series.winsB}-${match.series.winsA}`,
      status: match.status,
      opensAt: match.opensAt?.toISOString() ?? null,
      woAt: match.woAt?.toISOString() ?? null,
      joined: Boolean(match.players.find((p) => p.userId === userId)?.joinedAt),
    };
  }
  // Venceu e espera o próximo adversário (o outro confronto ainda não acabou)
  const waiting = await prisma.tournamentSeries.findFirst({
    where: { status: "pending", tournament: { status: "open", activatedAt: { not: null } }, OR: [{ playerAId: userId, playerBId: null }, { playerBId: userId, playerAId: null }] },
    include: { tournament: { select: { name: true } } },
  });
  if (waiting) return { kind: "waiting" as const, tournament: waiting.tournament.name, stage: STAGE_NAMES[waiting.stageKey] ?? waiting.stageKey };
  return null;
}

/** Dados do confronto para a tela do duelo (espera, W.O., placar e o próximo duelo). */
export async function getBracketRoomInfo(matchId: string, userId: string, issue: string | null) {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: { series: { include: { tournament: { select: { name: true } } } }, players: { select: { userId: true, joinedAt: true } } },
  });
  if (!m?.series) return null;
  const s = m.series;
  const meA = s.playerAId === userId;
  const next = m.status === "finished" ? await prisma.match.findFirst({ where: { seriesId: s.id, gameNumber: (m.gameNumber ?? 1) + 1 }, select: { id: true } }) : null;
  return {
    tournament: s.tournament.name,
    stage: STAGE_NAMES[s.stageKey] ?? s.stageKey,
    gameNumber: m.gameNumber ?? 1,
    score: meA ? `${s.winsA}-${s.winsB}` : `${s.winsB}-${s.winsA}`,
    seriesFinished: s.status === "finished",
    seriesWon: s.winnerId === userId,
    opensAt: m.opensAt?.toISOString() ?? null,
    woAt: m.woAt?.toISOString() ?? null,
    meJoined: Boolean(m.players.find((p) => p.userId === userId)?.joinedAt),
    opponentJoined: Boolean(m.players.find((p) => p.userId !== userId)?.joinedAt),
    chooser: s.chooserId === userId,
    nextMatchId: next?.id ?? null,
    issue,
  };
}

/** Para testes e para o Admin: faz o torneio andar agora, sem esperar o intervalo. */
export async function processBracketsNow() {
  lastCheck = 0;
  if (running) await running;
  return processBrackets();
}
