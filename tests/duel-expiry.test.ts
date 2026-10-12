import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  DUEL_MAX_AGE_MS,
  expireDuel,
  expiredDuelWhere,
} from "../src/lib/duel/expiry";
const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || !url.pathname.endsWith("_review"))
  throw Error("Use a dedicated local *_review database");
after(() => prisma.$disconnect());
const now = new Date("2030-01-01T12:00:00Z");
const old = new Date(now.getTime() - DUEL_MAX_AGE_MS);
async function room(data: Record<string, unknown> = {}) {
  return prisma.match.create({
    data: {
      status: "active",
      format: "slifer",
      createdAt: old,
      startedAt: old,
      ...data,
    },
  });
}
test("exactly two hours cancels without settlement or prizes", async () => {
  const u = await prisma.user.create({
    data: { email: `${randomUUID()}@example.invalid` },
  });
  await prisma.wallet.create({ data: { userId: u.id, gold: 123 } });
  const m = await room({
    players: { create: { userId: u.id, deckId: "test" } },
  });
  assert.equal(await expireDuel(m.id, now), true);
  const closed = await prisma.match.findUniqueOrThrow({
    where: { id: m.id },
    include: { players: true },
  });
  assert.equal(closed.status, "cancelled");
  assert.equal(closed.currentPhase, "expired");
  assert.equal(closed.settledAt, null);
  assert.equal(closed.players[0].result, null);
  assert.equal(
    await prisma.currencyTransaction.count({ where: { refId: m.id } }),
    0,
  );
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: u.id } })).gold,
    123,
  );
  assert.equal(await expireDuel(m.id, now), false);
});
test("under two hours stays open", async () => {
  const m = await room({ startedAt: new Date(old.getTime() + 1) });
  assert.equal(await expireDuel(m.id, now), false);
});
test("waiting rooms expire from creation time", async () => {
  const m = await room({ status: "waiting", startedAt: null });
  assert.equal(await expireDuel(m.id, now), true);
});
test("recently started duel does not expire from an older lobby creation", async () => {
  const m = await room({ startedAt: new Date(now.getTime() - 60000) });
  assert.equal(await expireDuel(m.id, now), false);
});
test("finished matches retain their result", async () => {
  const m = await room({ status: "finished", finishedAt: old });
  assert.equal(await expireDuel(m.id, now), false);
  assert.equal(
    (await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).status,
    "finished",
  );
});
test("concurrent expiration closes only once", async () => {
  const m = await room();
  const results = await Promise.all([
    expireDuel(m.id, now),
    expireDuel(m.id, now),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
});
test("bracket expiry pauses its tournament instead of assigning a winner", async () => {
  const t = await prisma.tournament.create({
    data: {
      name: "Expiry test",
      format: "slifer",
      type: "quick",
      startsAt: old,
      endsAt: now,
      createdById: "system",
    },
  });
  const s = await prisma.tournamentSeries.create({
    data: { tournamentId: t.id, stageKey: "A", round: 1, slot: 1 },
  });
  const m = await room({ tournamentId: t.id, seriesId: s.id, gameNumber: 1 });
  assert.equal(await expireDuel(m.id, now), true);
  assert.ok(
    (await prisma.tournament.findUniqueOrThrow({ where: { id: t.id } }))
      .pausedAt,
  );
  assert.equal(
    (await prisma.tournamentSeries.findUniqueOrThrow({ where: { id: s.id } }))
      .winnerId,
    null,
  );
});
