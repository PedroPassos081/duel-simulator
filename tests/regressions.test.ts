import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma, atomicWork } from "../src/lib/prisma";
import { grantCurrency, purchaseCard, purchaseCards } from "../src/lib/economy";
import { grantDepositBonus, evolveCard } from "../src/lib/collection";
import { withRoomLock } from "../src/lib/duel/room-lock";
import { copySaleValue, quoteCardSale } from "../src/lib/card-sale-rules";
const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || !url.pathname.endsWith("_review"))
  throw new Error("Use a dedicated local *_review database.");
let nextCard = 1900000000 + Math.floor(Math.random() * 1000000);
async function user(gold = 0) {
  const u = await prisma.user.create({
    data: { email: `${randomUUID()}@example.invalid` },
  });
  await prisma.wallet.create({ data: { userId: u.id, gold } });
  return u.id;
}
async function card(price = 80) {
  const c = await prisma.card.create({
    data: {
      id: nextCard++,
      name: "Regression card",
      type: "Normal Monster",
      description: "Test",
      shopListing: { create: { priceGold: price, priceCash: 20 } },
    },
  });
  return c.id;
}
after(async () => {
  await prisma.$disconnect();
});
test("same reward reference pays once under concurrent requests", async () => {
  const id = await user();
  await Promise.all(
    Array.from({ length: 8 }, () =>
      grantCurrency(id, "gold", 100, "test", "Test", "same"),
    ),
  );
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: id } })).gold,
    100,
  );
  assert.equal(
    await prisma.currencyTransaction.count({ where: { userId: id } }),
    1,
  );
});
test("distinct rewards accumulate without lost balances", async () => {
  const id = await user();
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      grantCurrency(id, "gold", 10, "test", "Test", String(i)),
    ),
  );
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: id } })).gold,
    80,
  );
});
test("concurrent purchases cannot overspend", async () => {
  const id = await user(100),
    a = await card(),
    b = await card();
  const r = await Promise.allSettled([
    purchaseCard(id, a, "gold"),
    purchaseCard(id, b, "gold"),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: id } })).gold,
    20,
  );
});
test("gold copy limit survives concurrent purchases", async () => {
  const id = await user(1000),
    c = await card();
  const r = await Promise.allSettled(
    Array.from({ length: 6 }, () => purchaseCard(id, c, "gold")),
  );
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 2);
  assert.equal(
    (
      await prisma.userCardOwnership.findUniqueOrThrow({
        where: { userId_cardId: { userId: id, cardId: c } },
      })
    ).quantity,
    2,
  );
});
test("failed bulk purchase rolls back earlier cards and money", async () => {
  const id = await user(1000),
    c = await card();
  await assert.rejects(
    purchaseCards(
      id,
      [
        { cardId: c, finish: "normal", border: "none" },
        { cardId: -999, finish: "normal", border: "none" },
      ],
      "gold",
    ),
  );
  assert.equal(await prisma.purchase.count({ where: { userId: id } }), 0);
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: id } })).gold,
    1000,
  );
});
test("nested services roll back rewards when later delivery fails", async () => {
  const id = await user();
  await assert.rejects(
    atomicWork(["economy"], async () => {
      await grantCurrency(id, "gold", 100, "test");
      throw new Error("delivery failed");
    }),
  );
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: id } })).gold,
    0,
  );
  assert.equal(
    await prisma.currencyTransaction.count({ where: { userId: id } }),
    0,
  );
});
test("deposit bonus is idempotent", async () => {
  const id = await user();
  await Promise.all(
    Array.from({ length: 5 }, () => grantDepositBonus(id, 300, "test-deposit")),
  );
  assert.equal(
    (
      await prisma.userItem.findUniqueOrThrow({
        where: { userId_itemKey: { userId: id, itemKey: "po_milenio_raro" } },
      })
    ).quantity,
    1,
  );
});
test("one normal copy cannot evolve twice concurrently", async () => {
  const id = await user(),
    c = await card();
  await prisma.userCardOwnership.create({
    data: { userId: id, cardId: c, quantity: 1 },
  });
  await prisma.userItem.create({
    data: { userId: id, itemKey: "po_milenio_raro", quantity: 2 },
  });
  const r = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      evolveCard(
        id,
        c,
        { finish: "normal", border: "none" },
        "po_milenio_raro",
      ),
    ),
  );
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (
      await prisma.userCardVariant.aggregate({
        where: { userId: id, cardId: c },
        _sum: { quantity: true },
      })
    )._sum.quantity,
    1,
  );
});
test("room queue serializes actions and releases failed requests", async () => {
  const events: string[] = [];
  await Promise.allSettled([
    withRoomLock("test", async () => {
      events.push("a");
      await new Promise((r) => setTimeout(r, 20));
      events.push("b");
      throw Error("test");
    }),
    withRoomLock("test", async () => {
      events.push("c");
    }),
  ]);
  assert.deepEqual(events, ["a", "b", "c"]);
  await withRoomLock("test", async () => events.push("d"));
  assert.equal(events.at(-1), "d");
});
test("free prices never mint resale money and invalid quantities fail", () => {
  assert.equal(
    copySaleValue({ priceGold: 0, priceCash: 0 }, "free", 40).amount,
    0,
  );
  assert.throws(() =>
    quoteCardSale(
      {
        listing: { priceGold: 10, priceCash: 10 },
        versions: [],
        origins: { cash: 0, gold: 0, free: 0 },
        sellable: 0,
      },
      -1,
      40,
    ),
  );
});
import { claimReward } from "../src/lib/battle-pass";
import { spentMs, isDuelClock, clockNow } from "../src/lib/duel/clock";
test("failed pass reward stays unclaimed and can be retried once", async () => {
  const id = await user();
  await prisma.battlePass.updateMany({ data: { active: false } });
  const pass = await prisma.battlePass.create({
    data: {
      name: "Regression pass",
      startsAt: new Date(Date.now() - 10000),
      endsAt: new Date(Date.now() + 600000),
      xpPerLevel: 100,
    },
  });
  const progress = await prisma.battlePassProgress.create({
    data: { passId: pass.id, userId: id, xp: 1000 },
  });
  const reward = await prisma.battlePassReward.create({
    data: {
      passId: pass.id,
      level: 1,
      track: "free",
      reward: { kind: "cosmetic", cosmeticId: "missing-test-cosmetic" },
    },
  });
  await assert.rejects(claimReward(id, 1, "free"));
  assert.equal(
    await prisma.battlePassClaim.count({ where: { progressId: progress.id } }),
    0,
  );
  await prisma.battlePassReward.update({
    where: { id: reward.id },
    data: { reward: { kind: "currency", currency: "gold", amount: 50 } },
  });
  const results = await Promise.allSettled([
    claimReward(id, 1, "free"),
    claimReward(id, 1, "free"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: id } })).gold,
    50,
  );
  await prisma.battlePass.delete({ where: { id: pass.id } });
});
test("clock rejects corrupt values and applies inactivity penalty only to acting player", () => {
  assert.equal(
    isDuelClock({
      remaining: { a: -1 },
      running: ["a"],
      since: new Date().toISOString(),
    }),
    false,
  );
  assert.equal(
    isDuelClock({
      remaining: { a: 1 },
      running: ["b"],
      since: new Date().toISOString(),
    }),
    false,
  );
  assert.equal(spentMs(40000), 60000);
  const since = Date.now();
  assert.deepEqual(
    clockNow(
      {
        remaining: { a: 210000, b: 210000 },
        running: ["a"],
        since: new Date(since).toISOString(),
      },
      since + 40000,
    ),
    { a: 150000, b: 210000 },
  );
});
import { settleMatch } from "../src/lib/match-results";
import { createTournament } from "../src/lib/tournaments";
test("failed match payout rolls back settlement and scoring, then retries once", async () => {
  const a = await user(2147483647),
    b = await user();
  const m = await prisma.match.create({
    data: {
      format: "slifer",
      status: "finished",
      finishedAt: new Date(),
      players: {
        create: [
          { userId: a, deckId: "test", result: "win" },
          { userId: b, deckId: "test", result: "loss" },
        ],
      },
    },
  });
  await assert.rejects(settleMatch(m.id));
  assert.equal(
    (await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).settledAt,
    null,
  );
  assert.equal(
    await prisma.currencyTransaction.count({ where: { refId: m.id } }),
    0,
  );
  assert.equal(
    (
      await prisma.matchPlayer.findUniqueOrThrow({
        where: { matchId_userId: { matchId: m.id, userId: a } },
      })
    ).points,
    null,
  );
  await prisma.wallet.update({ where: { userId: a }, data: { gold: 0 } });
  const results = await Promise.all([settleMatch(m.id), settleMatch(m.id)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: a } })).gold,
    50,
  );
  assert.equal(
    (await prisma.wallet.findUniqueOrThrow({ where: { userId: b } })).gold,
    20,
  );
});
test("duplicate tournament stages are rejected before creating records", async () => {
  await assert.rejects(
    createTournament("system", {
      name: "Invalid bracket",
      type: "quick",
      format: "missing",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 100000),
      structure: "bracket",
      stages: Array.from({ length: 3 }, () => ({
        key: "A",
        startsAt: new Date(),
      })),
      prizes: [],
    }),
    /sem repetir/,
  );
});
