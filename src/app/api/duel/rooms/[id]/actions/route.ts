import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isDuelGameState,
  type DuelGameState,
  type DuelPlayerState,
} from "@/lib/duel/game-state";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("next_phase") }),
  z.object({ type: z.literal("end_turn") }),
  z.object({
    type: z.enum(["summon", "set_monster", "set_spell_trap", "activate"]),
    cardId: z.number().int().positive(),
  }),
]);

function isMonster(type: string) {
  const normalized = type.toLowerCase();
  return !normalized.includes("spell") && !normalized.includes("trap");
}

function nextPhase(current: string, turn: number) {
  if (current === "draw") return "standby";
  if (current === "standby") return "main1";
  if (current === "main1") return turn === 1 ? "end" : "battle";
  if (current === "battle") return "main2";
  if (current === "main2") return "end";
  return null;
}

function startNextTurn(
  state: DuelGameState,
  playerIds: string[]
): { state: DuelGameState; phase: string } {
  const nextPlayerId = playerIds.find((id) => id !== state.turnPlayerId)!;
  const nextPlayer = state.players[nextPlayerId];
  const drawn = nextPlayer.deck.shift();
  if (drawn) nextPlayer.hand.push(drawn);
  nextPlayer.normalSummoned = false;
  state.turnPlayerId = nextPlayerId;
  state.turn += 1;
  return { state, phase: "draw" };
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
  } else if (parsed.data.type === "end_turn") {
    if (!["main1", "main2", "end"].includes(phase)) {
      return NextResponse.json(
        { error: "Não é possível terminar o turno nesta fase." },
        { status: 409 }
      );
    }
    phase = startNextTurn(
      state,
      room.players.map((entry) => entry.userId)
    ).phase;
  } else {
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
      parsed.data.type === "set_spell_trap" ||
      parsed.data.type === "activate"
    ) {
      const normalizedType = card.type.toLowerCase();
      if (
        isMonster(card.type) ||
        player.spellTraps.length >= 5 ||
        (parsed.data.type === "activate" && !normalizedType.includes("spell"))
      ) {
        return NextResponse.json(
          { error: "Não é possível colocar esta carta nesta zona." },
          { status: 409 }
        );
      }
      player.spellTraps.push({
        cardId: card.id,
        position:
          parsed.data.type === "activate" ? "face_up_attack" : "face_down",
      });
    } else {
      if (!isMonster(card.type) || player.monsters.length >= 5) {
        return NextResponse.json(
          { error: "Não é possível colocar este monstro no campo." },
          { status: 409 }
        );
      }
      if (player.normalSummoned) {
        return NextResponse.json(
          { error: "Você já fez sua invocação normal neste turno." },
          { status: 409 }
        );
      }
      player.normalSummoned = true;
      player.monsters.push({
        cardId: card.id,
        position:
          parsed.data.type === "summon"
            ? "face_up_attack"
            : "face_down_defense",
      });
    }
    player.hand.splice(handIndex, 1);
  }

  await prisma.match.update({
    where: { id: room.id },
    data: {
      engineState: state,
      currentTurn: state.turn,
      currentPhase: phase,
    },
  });
  return NextResponse.json({ ok: true, currentTurn: state.turn, currentPhase: phase });
}
