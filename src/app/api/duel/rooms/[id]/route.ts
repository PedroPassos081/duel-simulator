import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDuelGameState, type DuelChainState } from "@/lib/duel/game-state";
import { getBracketRoomInfo, joinBracketGame } from "@/lib/brackets";
import { settleMatch } from "@/lib/match-results";
import { checkClockTimeout, clockView, isDuelClock, syncClock } from "@/lib/duel/clock";
import {
  getOcgDuelSessionSnapshot,
  getOcgAttackableMonsters,
  getOcgLegalActions,
  getOcgPendingDecision,
} from "@/lib/duel/ocgcore-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE_SELECT_CHAIN = 16;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  await prisma.matchPlayer.updateMany({
    where: { matchId: params.id, userId },
    data: { lastSeenAt: new Date() },
  });

  // Torneio em chaves: entrar na sala marca presença (e confere o deck); começa ou dá W.O.
  const bracketJoin = await joinBracketGame(params.id, userId);
  const bracket = await getBracketRoomInfo(params.id, userId, bracketJoin.issue);
  // Relógio: quem zerou o tempo perde (vale também no pedra-papel-tesoura)
  if (userId) await checkClockTimeout(params.id);

  let room = await prisma.match.findFirst({
    where: { id: params.id, players: { some: { userId } } },
    include: {
      players: {
        select: {
          userId: true,
          result: true,
          rpsChoice: true,
          user: { select: { name: true, username: true, image: true } },
        },
      },
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
  }

  // Duelo da fila em que um jogador nunca abriu a sala (saiu e não voltou):
  // passado o prazo do pedra-papel-tesoura, quem não apareceu perde por W.O. e
  // quem estava aqui vence (pontos e gold normais). Torneio em chaves tem o W.O. próprio.
  let walkover = false;
  if (room.status === "rps" && room.rpsDeadline && room.rpsDeadline.getTime() <= Date.now()) {
    const seen = await prisma.match.findUnique({
      where: { id: room.id },
      select: { createdAt: true, seriesId: true, players: { select: { id: true, userId: true, lastSeenAt: true, rpsChoice: true } } },
    });
    const absent = seen?.players.filter((p) => !p.rpsChoice && p.lastSeenAt.getTime() <= seen.createdAt.getTime() + 3_000) ?? [];
    if (seen && !seen.seriesId && absent.length > 0) {
      const { count } = await prisma.match.updateMany({
        where: { id: room.id, status: "rps" },
        data: { status: "finished", currentPhase: "walkover", finishedAt: new Date(), rpsDeadline: null },
      });
      walkover = true;
      if (count > 0) {
        for (const p of seen.players) {
          await prisma.matchPlayer.update({ where: { id: p.id }, data: { result: absent.some((a) => a.id === p.id) ? "loss" : "win" } });
        }
        await settleMatch(room.id).catch((err) => console.error("[W.O.]", room!.id, err));
      }
    }
  }

  // Duelo decidido por W.O. (alguém não apareceu): tela própria, sem tabuleiro
  if (walkover || room.status === "finished") {
    const wo = await prisma.match.findUnique({
      where: { id: room.id },
      select: { currentPhase: true, engineState: true, players: { select: { userId: true, result: true } } },
    });
    // Tempo zerado antes do duelo começar (pedra-papel-tesoura / escolha da ordem): mesma tela do W.O.
    const timeoutBeforeDuel = wo?.currentPhase === "timeout" && !isDuelGameState(wo.engineState);
    if (wo?.currentPhase === "walkover" || timeoutBeforeDuel) {
      return NextResponse.json(
        {
          id: room.id,
          status: "walkover",
          reason: timeoutBeforeDuel ? "timeout" : "absent",
          meId: userId,
          players: [],
          rpsRound: room.rpsRound,
          youWon: wo!.players.find((p) => p.userId === userId)?.result === "win",
        },
        { headers: NO_CACHE_HEADERS }
      );
    }
  }

  if (
    room.status === "rps" &&
    room.rpsDeadline &&
    room.rpsDeadline.getTime() <= Date.now()
  ) {
    const submitted = room.players.filter((player) => player.rpsChoice);

    if (submitted.length === 1) {
      room = await prisma.match.update({
        where: { id: room.id },
        data: {
          status: "choosing",
          currentPhase: "choosing_order",
          rpsWinnerId: submitted[0].userId,
          rpsDeadline: null,
        },
        include: {
          players: {
            select: {
              userId: true,
              result: true,
              rpsChoice: true,
              user: { select: { name: true, username: true, image: true } },
            },
          },
        },
      });
    } else if (submitted.length === 0) {
      room = await prisma.$transaction(async (tx) => {
        await tx.matchPlayer.updateMany({
          where: { matchId: room!.id },
          data: { rpsChoice: null },
        });
        return tx.match.update({
          where: { id: room!.id },
          data: {
            rpsRound: { increment: 1 },
            rpsDeadline: new Date(Date.now() + 15_000),
          },
          include: {
            players: {
              select: {
                userId: true,
                result: true,
                rpsChoice: true,
                user: { select: { name: true, username: true, image: true } },
              },
            },
          },
        });
      });
    }
  }

  // Cria o relógio na primeira vez e acompanha o pedra-papel-tesoura resolvido acima
  let clock = room.clock;
  if (["rps", "choosing", "active"].includes(room.status)) {
    const prev = isDuelClock(clock) ? clock : null;
    const rpsPending = room.status === "rps" ? room.players.filter((p) => !p.rpsChoice).map((p) => p.userId).sort().join() : null;
    const runningNow = prev ? [...prev.running].sort().join() : null;
    const stale =
      !prev ||
      (room.status === "rps" && runningNow !== rpsPending) ||
      (room.status === "choosing" && runningNow !== (room.rpsWinnerId ?? ""));
    if (stale) clock = ((await syncClock(room.id)) as unknown as typeof clock) ?? clock;
  }

  const storedState = isDuelGameState(room.engineState)
    ? room.engineState
    : null;
  const ownState = storedState?.players[userId];
  const opponentPlayer = room.players.find((player) => player.userId !== userId);
  const opponentState = opponentPlayer
    ? storedState?.players[opponentPlayer.userId]
    : undefined;
  const pendingDecision = getOcgPendingDecision(room.id, userId);
  const ocgLegalActions = getOcgLegalActions(room.id, userId);
  const attackableMonsters = getOcgAttackableMonsters(room.id, userId);
  const ocgSnapshot = getOcgDuelSessionSnapshot(room.id);
  // Janela de resposta: a corrente salva ou, se o motor está esperando uma
  // SELECT_CHAIN que ainda não foi registrada, uma janela sem elos.
  const chainState: DuelChainState | undefined =
    storedState?.chain ??
    (ocgSnapshot?.pendingMessageType === MESSAGE_SELECT_CHAIN &&
    ocgSnapshot.pendingPlayerId
      ? { links: [], awaitingPlayerId: ocgSnapshot.pendingPlayerId }
      : undefined);
  const chainOptionIds =
    chainState?.awaitingPlayerId === userId
      ? Object.entries(ocgLegalActions ?? {})
          .filter(([, actions]) => actions.includes("activate"))
          .map(([cardId]) => Number(cardId))
          .filter(Number.isInteger)
      : [];
  const specialSummonCardIds = Object.entries(ocgLegalActions ?? {})
    .filter(([, actions]) => actions.includes("special_summon"))
    .map(([cardId]) => Number(cardId))
    .filter(Number.isInteger);
  const decisionCardIds = pendingDecision
    ? pendingDecision.type === "cards" ||
      pendingDecision.type === "tributes" ||
      pendingDecision.type === "battle_targets"
      ? pendingDecision.candidates.map((candidate) => candidate.cardId)
      : pendingDecision.type === "sum"
        ? [
            ...pendingDecision.mustCards.map((candidate) => candidate.cardId),
            ...pendingDecision.candidates.map((candidate) => candidate.cardId),
          ]
        : pendingDecision.type === "unselect"
          ? [
              ...pendingDecision.selectable.map((candidate) => candidate.cardId),
              ...pendingDecision.selected.map((candidate) => candidate.cardId),
            ]
          : "cardId" in pendingDecision
            ? typeof pendingDecision.cardId === "number"
              ? [pendingDecision.cardId]
              : []
            : []
    : [];
  const visibleCardIds = ownState
    ? [
        ...ownState.hand,
        ...ownState.monsters.map((entry) => entry.cardId),
        ...ownState.spellTraps.map((entry) => entry.cardId),
        ...(opponentState?.monsters
          .filter((entry) => !entry.position.startsWith("face_down"))
          .map((entry) => entry.cardId) ?? []),
        ...(opponentState?.spellTraps
          .filter((entry) => !entry.position.startsWith("face_down"))
          .map((entry) => entry.cardId) ?? []),
        ...decisionCardIds,
        ...specialSummonCardIds,
        // Cartas ativadas numa corrente são públicas; as opções de resposta
        // são sempre do próprio jogador.
        ...(chainState?.links.map((link) => link.cardId) ?? []),
        ...chainOptionIds,
        // Cemitério e zona de banimento são públicos para os dois jogadores.
        ...ownState.graveyard,
        ...ownState.banished,
        ...(opponentState?.graveyard ?? []),
        ...(opponentState?.banished ?? []),
      ]
    : [];
  const visibleCards = ownState
    ? await prisma.card.findMany({ where: { id: { in: visibleCardIds } } })
    : [];
  const cardById = new Map(visibleCards.map((card) => [card.id, card]));
  const isYourTurn = storedState?.turnPlayerId === userId;
  const inMainPhase = ["main1", "main2"].includes(room.currentPhase);
  const legalActions: Record<string, string[]> = {};
  if (ownState) {
    for (const cardId of ownState.hand) {
      const card = cardById.get(cardId);
      if (!card) continue;
      const type = card.type.toLowerCase();
      const monster = !type.includes("spell") && !type.includes("trap");
      const actions: string[] = [];
      if (isYourTurn && inMainPhase && !storedState?.chain) {
        if (
          monster &&
          !ownState.normalSummoned &&
          ownState.monsters.length < 5
        ) {
          actions.push("summon", "set_monster");
        }
        if (!monster && ownState.spellTraps.length < 5) {
          actions.push("set_spell_trap");
          if (type.includes("spell")) {
            actions.unshift("activate");
          }
        }
      }
      legalActions[String(cardId)] = actions;
    }
  }

  const lastChainLink = chainState?.links[chainState.links.length - 1];
  const chainView = chainState
    ? {
        card: lastChainLink ? cardById.get(lastChainLink.cardId) ?? null : null,
        linkCount: chainState.links.length,
        awaitingYou: chainState.awaitingPlayerId === userId,
        controllerId: lastChainLink?.playerId ?? null,
        awaitingPlayerId: chainState.awaitingPlayerId,
        options: chainOptionIds
          .map((cardId) => cardById.get(cardId))
          .filter(Boolean),
      }
    : null;

  const fieldView = (
    entries: NonNullable<typeof ownState>["monsters"],
    revealFaceDown: boolean
  ) =>
    entries.map((entry) => {
      const faceDown = entry.position.startsWith("face_down");
      return {
        card: !faceDown || revealFaceDown ? cardById.get(entry.cardId) : undefined,
        faceDown,
        position: entry.position,
        zone: entry.zone,
      };
    });

  return NextResponse.json({
    id: room.id,
    status: room.status,
    currentTurn: room.currentTurn,
    currentPhase: room.currentPhase,
    meId: userId,
    rpsRound: room.rpsRound,
    rpsDeadline: room.rpsDeadline?.toISOString() ?? null,
    rpsWinnerId: room.rpsWinnerId,
    firstPlayerId: room.firstPlayerId,
    bracket,
    clock: clockView(clock),
    endReason: room.currentPhase === "timeout" ? "timeout" : null,
    ocgCore: ocgSnapshot,
    game:
      ["active", "finished"].includes(room.status) && ownState
        ? {
            meId: userId,
            ownHand: ownState.hand
              .map((cardId) => cardById.get(cardId))
              .filter(Boolean),
            ownMonsters: fieldView(ownState.monsters, true),
            ownSpellTraps: fieldView(ownState.spellTraps, true),
            opponentMonsters: opponentState
              ? fieldView(opponentState.monsters, false)
              : [],
            opponentSpellTraps: opponentState
              ? fieldView(opponentState.spellTraps, false)
              : [],
            ownDeckCount: ownState.deck.length,
            ownExtraCount: ownState.extra.length,
            ownGraveyard: ownState.graveyard
              .map((cardId) => cardById.get(cardId))
              .filter(Boolean),
            ownBanished: ownState.banished
              .map((cardId) => cardById.get(cardId))
              .filter(Boolean),
            opponentHandCount: opponentState?.hand.length ?? 0,
            opponentDeckCount: opponentState?.deck.length ?? 0,
            opponentExtraCount: opponentState?.extra.length ?? 0,
            opponentGraveyard: (opponentState?.graveyard ?? [])
              .map((cardId) => cardById.get(cardId))
              .filter(Boolean),
            opponentBanished: (opponentState?.banished ?? [])
              .map((cardId) => cardById.get(cardId))
              .filter(Boolean),
            ownLifePoints: ownState.lifePoints ?? 8_000,
            opponentLifePoints: opponentState?.lifePoints ?? 8_000,
            ownUser: {
              nickname:
                room.players.find((player) => player.userId === userId)?.user
                  .username ??
                room.players.find((player) => player.userId === userId)?.user
                  .name ??
                "Duelista",
              image:
                room.players.find((player) => player.userId === userId)?.user
                  .image ?? null,
            },
            opponentUser: {
              nickname:
                opponentPlayer?.user.username ??
                opponentPlayer?.user.name ??
                "Oponente",
              image: opponentPlayer?.user.image ?? null,
            },
            winnerId: storedState.winnerId ?? null,
            youWon: storedState.winnerId
              ? storedState.winnerId === userId
              : null,
            isYourTurn,
            currentTurn: storedState.turn,
            currentPhase: room.currentPhase,
            legalActions: ocgLegalActions ?? legalActions,
            attackableMonsters,
            specialSummonCandidates: specialSummonCardIds
              .map((cardId) => cardById.get(cardId))
              .filter(Boolean),
            decision: pendingDecision
              ? pendingDecision.type === "cards" ||
                pendingDecision.type === "tributes" ||
                pendingDecision.type === "battle_targets"
                ? {
                    ...pendingDecision,
                    candidates: pendingDecision.candidates.map((candidate) => ({
                      ...candidate,
                      card: cardById.get(candidate.cardId) ?? null,
                    })),
                  }
                : pendingDecision.type === "position"
                  ? {
                      ...pendingDecision,
                      card: cardById.get(pendingDecision.cardId) ?? null,
                    }
                  : pendingDecision.type === "sum"
                    ? {
                        ...pendingDecision,
                        mustCards: pendingDecision.mustCards.map((candidate) => ({
                          ...candidate,
                          card: cardById.get(candidate.cardId) ?? null,
                        })),
                        candidates: pendingDecision.candidates.map((candidate) => ({
                          ...candidate,
                          card: cardById.get(candidate.cardId) ?? null,
                        })),
                      }
                    : pendingDecision.type === "unselect"
                      ? {
                          ...pendingDecision,
                          selectable: pendingDecision.selectable.map((candidate) => ({
                            ...candidate,
                            card: cardById.get(candidate.cardId) ?? null,
                          })),
                          selected: pendingDecision.selected.map((candidate) => ({
                            ...candidate,
                            card: cardById.get(candidate.cardId) ?? null,
                          })),
                        }
                      : pendingDecision.type === "yes_no"
                        ? {
                            ...pendingDecision,
                            card:
                              typeof pendingDecision.cardId === "number"
                                ? cardById.get(pendingDecision.cardId) ?? null
                                : null,
                          }
                        : pendingDecision
              : null,
            chain: chainView,
            clock: clockView(clock),
            endReason: room.currentPhase === "timeout" ? "timeout" : null,
          }
        : null,
    players: room.players.map((player) => ({
      id: player.userId,
      nickname: player.user.username ?? player.user.name ?? "Duelista",
      image: player.user.image,
      result: player.result,
      choiceSubmitted: Boolean(player.rpsChoice),
      rpsChoice:
        room.status === "choosing" || room.status === "active"
          ? player.rpsChoice
          : undefined,
    })),
  }, { headers: NO_CACHE_HEADERS });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const room = await tx.match.findFirst({
      where: {
        id: params.id,
        status: "waiting",
        players: { some: { userId } },
      },
      include: { players: true },
    });
    if (!room || room.players.length !== 1) return false;

    await tx.matchPlayer.deleteMany({ where: { matchId: room.id } });
    await tx.match.delete({ where: { id: room.id } });
    return true;
  });

  if (!cancelled) {
    return NextResponse.json(
      { error: "A busca já terminou e não pode mais ser cancelada." },
      { status: 409 }
    );
  }

  return NextResponse.json({ cancelled: true });
}
