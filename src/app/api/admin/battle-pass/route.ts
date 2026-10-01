import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { rewardSchema } from "@/lib/reward-schema";
import { BattlePassError, createPass, getPassRewardsForAdmin, listPassCosmetics, listPasses, setCosmeticShop, setPassReward, updatePass } from "@/lib/battle-pass";

// Aba Passe do Admin: temporadas do passe e o prêmio de cada nível
export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const params = new URL(req.url).searchParams;
  // Cosméticos dos passes para colocar na vitrine da loja
  if (params.get("cosmetics")) return NextResponse.json(await listPassCosmetics());
  const passId = params.get("rewards");
  if (passId) return NextResponse.json(await getPassRewardsForAdmin(passId));
  return NextResponse.json(await listPasses());
}

const passFields = {
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  artCardId: z.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  levels: z.number().int().min(1).max(200),
  xpPerLevel: z.number().int().min(1).max(100_000),
  xpWin: z.number().int().min(0).max(100_000),
  xpLoss: z.number().int().min(0).max(100_000),
  premiumPriceCash: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
};
const passReward = z.union([
  rewardSchema,
  z.object({ kind: z.literal("mystery_card"), finish: z.enum(["normal", "rara", "ultra", "secreta"]).optional() }),
  z.object({ kind: z.literal("choice_cosmetic"), options: z.array(z.string().min(1)).min(2).max(6) }),
]);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...passFields }),
  z.object({ action: z.literal("update"), id: z.string(), ...passFields }),
  z.object({ action: z.literal("cosmetic_shop"), cosmeticId: z.string(), inShop: z.boolean(), priceCash: z.number().int().min(1).max(1_000_000), shopUnlockAt: z.coerce.date().nullable() }),
  z.object({ action: z.literal("reward"), passId: z.string(), level: z.number().int().min(1).max(200), track: z.enum(["free", "premium"]), reward: passReward.nullable() }),
]);

export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira os campos." }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.action === "create") {
      const { action, ...input } = body;
      void action;
      return NextResponse.json({ message: "Passe criado.", pass: await createPass(input) });
    }
    if (body.action === "update") {
      const { action, id, ...input } = body;
      void action;
      await updatePass(id, input);
      return NextResponse.json({ message: "Passe salvo." });
    }
    if (body.action === "cosmetic_shop") {
      await setCosmeticShop(body.cosmeticId, { inShop: body.inShop, priceCash: body.priceCash, shopUnlockAt: body.shopUnlockAt });
      return NextResponse.json({ message: body.inShop ? "Na vitrine da loja." : "Fora da vitrine." });
    }
    await setPassReward(body.passId, body.level, body.track, body.reward);
    return NextResponse.json({ message: body.reward ? `Prêmio do nível ${body.level} salvo.` : `Prêmio do nível ${body.level} removido.` });
  } catch (err) {
    if (err instanceof BattlePassError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
