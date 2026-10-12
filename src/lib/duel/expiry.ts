import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withRoomLock } from "@/lib/duel/room-lock";

export const DUEL_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const OPEN = ["waiting", "rps", "choosing", "active"];

export function expiredDuelWhere(now = new Date()): Prisma.MatchWhereInput {
  const cutoff = new Date(now.getTime() - DUEL_MAX_AGE_MS);
  return {
    status: { in: OPEN },
    finishedAt: null,
    OR: [
      { startedAt: { lte: cutoff } },
      { startedAt: null, createdAt: { lte: cutoff } },
    ],
  };
}

// Cancellation is distinct from a played draw: no ranking or reward settlement.
export async function expireDuel(id: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Match" WHERE id = ${id} FOR UPDATE`;
    const match = await tx.match.findFirst({
      where: { id, ...expiredDuelWhere(now) },
      select: { id: true, seriesId: true, tournamentId: true },
    });
    if (!match) return false;
    await tx.match.update({
      where: { id },
      data: {
        status: "cancelled",
        currentPhase: "expired",
        finishedAt: now,
        rpsDeadline: null,
      },
    });
    // A bracket needs an admin decision, rather than inventing a winner.
    if (match.seriesId && match.tournamentId) {
      await tx.tournament.updateMany({
        where: { id: match.tournamentId, status: "open", pausedAt: null },
        data: { pausedAt: now },
      });
    }
    return true;
  });
}

export async function expireOldDuels(now = new Date()) {
  const matches = await prisma.match.findMany({
    where: expiredDuelWhere(now),
    select: { id: true },
    take: 200,
    orderBy: { createdAt: "asc" },
  });
  let closed = 0;
  for (const match of matches) {
    if (await withRoomLock(match.id, () => expireDuel(match.id, now))) closed++;
  }
  return closed;
}
