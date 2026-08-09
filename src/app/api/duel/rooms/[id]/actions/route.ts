import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isDuelGameState,
  type DuelGameState,
  type DuelPlayerState,
} from "@/lib/duel/game-state";
import {
  passOcgChain,
  performOcgEndTurn,
  performOcgPhaseChange,
  performOcgMonsterAction,
  performOcgSpellAction,
  type OcgStateEvent,
} from "@/lib/duel/ocgcore-session";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("next_phase") }),
  z.object({
    type: z.literal("select_phase"),
    phase: z.enum(["standby", "main1", "battle", "main2"]),
  }),
  z.object({ type: z.literal("end_turn") }),
  z.object({ type: z.literal("pass_chain") }),
  z.object({
    type: z.enum(["summon", "set_monster", "set_spell_trap", "activate"]),
    cardId: z.number().int().positive(),
    zone: z.number().int().min(0).max(5),
  }),
]);

function nextPhase(current: string, turn: number) {
  if (current === "draw") return "standby";
  if (current === "standby") return "main1";
  if (current === "main1") return turn === 1 ? "end" : "battle";
  if (current === "battle") return "main2";
  if (current === "main2") return "end";
  return null;
}

function phaseFromOcg(value: number) {
  if (value === 1) return "draw";
  if (value === 2) return "standby";
  if (value === 4) return "main1";
  if ([8, 16, 32, 64, 128].includes(value)) return "battle";
  if (value === 256) return "main2";
  if (value === 512) return "end";
  return null;
}

function removeCardFromLocation(
  player: DuelPlayerState,
  location: number,
  cardId: number,
  sequence: number
) {
  if (location === 1) {
    const index = player.deck.indexOf(cardId);
    if (index >= 0) player.deck.splice(index, 1);
  } else if (location === 2) {
    const index = player.hand.indexOf(cardId);
    if (index >= 0) player.hand.splice(index, 1);
  } else if (location === 4) {
    const index = player.monsters.findIndex((card) => card.zone === sequence);
    if (index >= 0) player.monsters.splice(index, 1);
  } else if (location === 8 || location === 256) {
    const zone = location === 256 ? 5 : sequence;
    const index = player.spellTraps.findIndex((card) => card.zone === zone);
    if (index >= 0) player.spellTraps.splice(index, 1);
  } else if (location === 16) {
    const index = player.graveyard.indexOf(cardId);
    if (index >= 0) player.graveyard.splice(index, 1);
  } else if (location === 64) {
    const index = player.extra.indexOf(cardId);
    if (index >= 0) player.extra.splice(index, 1);
  } else if (location === 32) {
    const index = player.banished?.indexOf(cardId) ?? -1;
    if (index >= 0) player.banished.splice(index, 1);
  }
}

function applyOcgEvents(state: DuelGameState, events: OcgStateEvent[]) {
  let phase: string | null = null;
  for (const event of events) {
    if (event.type === "draw") {
      const player = state.players[event.playerId];
      if (!player) continue;
      for (const cardId of event.cards) {
        removeCardFromLocation(player, 1, cardId, 0);
        player.hand.push(cardId);
      }
      continue;
    }

    if (event.type === "position") {
      const player = state.players[event.playerId];
      if (!player) continue;
      const list = event.location === 4 ? player.monsters : player.spellTraps;
      const card = list.find((entry) => entry.zone === event.sequence);
      if (card) {
        card.position =
          event.position === 8
            ? "face_down_defense"
            : event.position === 4
              ? "face_up_defense"
              : event.position === 1
                ? "face_up_attack"
                : "face_down";
      }
      continue;
    }

    if (event.type === "life_points") {
      const player = state.players[event.playerId];
      if (!player) continue;
      const current = player.lifePoints ?? 8_000;
      player.lifePoints = Math.max(
        0,
        event.absolute ? event.value : current + event.value
      );
      continue;
    }

    if (event.type === "turn") {
      if (state.turnPlayerId !== event.playerId) state.turn += 1;
      state.turnPlayerId = event.playerId;
      const player = state.players[event.playerId];
      if (player) player.normalSummoned = false;
      continue;
    }

    if (event.type === "phase") {
      phase = phaseFromOcg(event.phase) ?? phase;
      continue;
    }

    if (event.type === "win") {
      state.winnerId = event.playerId;
      state.winReason = event.reason;
      continue;
    }

    const fromPlayer = state.players[event.from.playerId];
    const toPlayer = state.players[event.to.playerId];
    if (!fromPlayer || !toPlayer) continue;
    removeCardFromLocation(
      fromPlayer,
      event.from.location,
      event.cardId,
      event.from.sequence
    );
    if (event.to.location === 2) {
      toPlayer.hand.push(event.cardId);
    } else if (event.to.location === 16) {
      toPlayer.graveyard.push(event.cardId);
    } else if (event.to.location === 32) {
      toPlayer.banished ??= [];
      toPlayer.banished.push(event.cardId);
    } else if (event.to.location === 1) {
      toPlayer.deck.push(event.cardId);
    } else if (event.to.location === 64) {
      toPlayer.extra.push(event.cardId);
    } else if (event.to.location === 4) {
      toPlayer.monsters.push({
        cardId: event.cardId,
        zone: event.to.sequence,
        position:
          event.to.position === 8
            ? "face_down_defense"
            : event.to.position === 4
              ? "face_up_defense"
              : "face_up_attack",
      });
    } else if (event.to.location === 8 || event.to.location === 256) {
      toPlayer.spellTraps.push({
        cardId: event.cardId,
        zone: event.to.location === 256 ? 5 : event.to.sequence,
        position: event.to.position === 8 ? "face_down" : "face_up_attack",
      });
    }
  }
  return phase;
}

async function persistDuelState(
  matchId: string,
  state: DuelGameState,
  phase?: string | null
) {
  if (!state.winnerId) {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        engineState: state,
        currentTurn: state.turn,
        ...(phase ? { currentPhase: phase } : {}),
      },
    });
    return;
  }

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        status: "finished",
        finishedAt: new Date(),
        engineState: state,
        currentTurn: state.turn,
        currentPhase: "finished",
      },
    }),
    prisma.matchPlayer.updateMany({
      where: { matchId, userId: state.winnerId },
      data: { result: "win" },
    }),
    prisma.matchPlayer.updateMany({
      where: { matchId, userId: { not: state.winnerId } },
      data: { result: "loss" },
    }),
  ]);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const room = await prisma.match.findFirst({
    where: { id: params.id, status: "active", players: { some: { userId } } },
    include: { players: true },
  });
  if (!room || !isDuelGameState(room.engineState)) {
    return NextResponse.json({ error: "Duelo indisponível." }, { status: 409 });
  }

  const state = structuredClone(room.engineState) as DuelGameState;
  if (state.chain) {
    if (
      parsed.data.type !== "pass_chain" ||
      state.chain.awaitingPlayerId !== userId
    ) {
      return NextResponse.json(
        { error: "A corrente está aguardando a resposta do outro jogador." },
        { status: 409 }
      );
    }

    const link = state.chain.links[state.chain.links.length - 1];
    const ocgResult = await passOcgChain(room.id, userId);
    if (!ocgResult) {
      return NextResponse.json(
        { error: "A sessão do OCGCore não está aguardando essa resposta." },
        { status: 409 }
      );
    }
    const ocgEvents = ocgResult?.events ?? [];
    const resolvedPhase = applyOcgEvents(state, ocgEvents);
    const controller = state.players[link.playerId];
    const card = await prisma.card.findUnique({ where: { id: link.cardId } });
    if (!card) {
      return NextResponse.json({ error: "Carta não encontrada." }, { status: 404 });
    }
    const persistent = ["continuous", "field", "equip"].some((kind) =>
      card.type.toLowerCase().includes(kind)
    );
    const movedByCore = ocgEvents.some(
      (event) =>
        event.type === "move" &&
        event.cardId === link.cardId &&
        event.to.location === 16
    );
    if (!persistent && !movedByCore) {
      const fieldIndex = controller.spellTraps.findIndex(
        (entry) => entry.cardId === link.cardId
      );
      if (fieldIndex >= 0) controller.spellTraps.splice(fieldIndex, 1);
      controller.graveyard.push(link.cardId);
    }
    delete state.chain;

    await persistDuelState(room.id, state, resolvedPhase);
    return NextResponse.json({ ok: true, chainResolved: true });
  }

  if (parsed.data.type === "pass_chain") {
    return NextResponse.json(
      { error: "Não existe uma corrente aguardando resposta." },
      { status: 409 }
    );
  }

  if (state.turnPlayerId !== userId) {
    return NextResponse.json({ error: "Aguarde o seu turno." }, { status: 409 });
  }
  const player = state.players[userId] as DuelPlayerState;
  let phase = room.currentPhase;

  if (parsed.data.type === "next_phase") {
    const next = nextPhase(phase, state.turn);
    if (!next) {
      return NextResponse.json(
        { error: "Use Terminar turno para continuar." },
        { status: 409 }
      );
    }
    phase = next;
  } else if (parsed.data.type === "select_phase") {
    const allowedTargets: Record<string, string[]> = {
      draw: ["standby"],
      standby: ["main1"],
      main1: state.turn === 1 ? [] : ["battle"],
      battle: ["main2"],
    };
    if (!allowedTargets[phase]?.includes(parsed.data.phase)) {
      return NextResponse.json(
        { error: "Não é possível avançar para essa fase agora." },
        { status: 409 }
      );
    }
    if (parsed.data.phase === "battle" || parsed.data.phase === "main2") {
      try {
        const ocgResult = await performOcgPhaseChange(
          room.id,
          userId,
          parsed.data.phase
        );
        if (!ocgResult) throw new Error("A sessão do OCGCore não está ativa.");
        const corePhase = applyOcgEvents(state, ocgResult?.events ?? []);
        if (corePhase) phase = corePhase;
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "O OCGCore recusou a mudança de fase.",
          },
          { status: 409 }
        );
      }
    }
    phase = parsed.data.phase;
  } else if (parsed.data.type === "end_turn") {
    if (!["main1", "battle", "main2", "end"].includes(phase)) {
      return NextResponse.json(
        { error: "Não é possível terminar o turno nesta fase." },
        { status: 409 }
      );
    }
    try {
      const ocgResult = await performOcgEndTurn(room.id, userId);
      if (!ocgResult) throw new Error("A sessão do OCGCore não está ativa.");
      const corePhase = applyOcgEvents(state, ocgResult?.events ?? []);
      phase = corePhase ?? "draw";
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "O OCGCore não permitiu terminar o turno.",
        },
        { status: 409 }
      );
    }
  } else {
    const selectedZone =
      "zone" in parsed.data ? parsed.data.zone : -1;
    let ocgAwaitingPlayerId: string | null = null;
    let ocgEvents: OcgStateEvent[] = [];
    if (!["main1", "main2"].includes(phase)) {
      return NextResponse.json(
        { error: "Esta ação só pode ser feita em uma Main Phase." },
        { status: 409 }
      );
    }
    const handIndex = player.hand.indexOf(parsed.data.cardId);
    if (handIndex < 0) {
      return NextResponse.json(
        { error: "Esta carta não está na sua mão." },
        { status: 409 }
      );
    }
    const card = await prisma.card.findUnique({
      where: { id: parsed.data.cardId },
    });
    if (!card) {
      return NextResponse.json({ error: "Carta não encontrada." }, { status: 404 });
    }

    if (
      parsed.data.type === "summon" ||
      parsed.data.type === "set_monster"
    ) {
      try {
        const ocgResult = await performOcgMonsterAction({
          matchId: room.id,
          userId,
          action: parsed.data.type,
          cardId: parsed.data.cardId,
          zone: selectedZone,
        });
        if (!ocgResult) throw new Error("A sessão do OCGCore não está ativa.");
        ocgEvents = ocgResult?.events ?? [];
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "O OCGCore recusou essa ação.",
          },
          { status: 409 }
        );
      }
    }
    if (
      parsed.data.type === "set_spell_trap" ||
      parsed.data.type === "activate"
    ) {
      const fieldSpell = `${card.type} ${card.race ?? ""}`
        .toLowerCase()
        .includes("field");
      if ((fieldSpell && selectedZone !== 5) || (!fieldSpell && selectedZone === 5)) {
        return NextResponse.json(
          {
            error: fieldSpell
              ? "Magias de Campo devem ser colocadas na Zona de Campo."
              : "Esta carta deve usar uma zona de Spell/Trap.",
          },
          { status: 409 }
        );
      }
      try {
        const ocgResult = await performOcgSpellAction({
          matchId: room.id,
          userId,
          action: parsed.data.type,
          cardId: parsed.data.cardId,
          zone: selectedZone,
          fieldSpell,
        });
        if (!ocgResult) throw new Error("A sessão do OCGCore não está ativa.");
        ocgAwaitingPlayerId = ocgResult?.pendingPlayerId ?? null;
        ocgEvents = ocgResult?.events ?? [];
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "O OCGCore recusou essa ação.",
          },
          { status: 409 }
        );
      }
    }

    const corePhase = applyOcgEvents(state, ocgEvents);
    if (corePhase) phase = corePhase;
    if (parsed.data.type === "activate") {
      const opponentId = room.players.find(
        (entry) => entry.userId !== userId
      )!.userId;
      state.chain = {
        links: [{ playerId: userId, cardId: card.id }],
        awaitingPlayerId: ocgAwaitingPlayerId ?? opponentId,
      };
    }
  }

  await persistDuelState(room.id, state, phase);
  return NextResponse.json({ ok: true, currentTurn: state.turn, currentPhase: phase });
}
