import { z } from "zod";
import { BORDERS, FINISHES, ITEMS, type Border, type Finish, type ItemKey } from "@/lib/card-finish";

// Formato de um prêmio (envio do Admin e premiação dos torneios)
const enumOf = <T extends string>(obj: Record<T, unknown>) => z.enum(Object.keys(obj) as [T, ...T[]]);

export const rewardSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("currency"), currency: z.enum(["gold", "cash"]), amount: z.number().int().min(1).max(10_000_000) }),
  z.object({
    kind: z.literal("card"),
    cardId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
    variant: z.object({ finish: enumOf<Finish>(FINISHES), border: enumOf<Border>(BORDERS) }),
  }),
  z.object({ kind: z.literal("cosmetic"), cosmeticId: z.string().min(1) }),
  z.object({ kind: z.literal("item"), itemKey: enumOf<ItemKey>(ITEMS), quantity: z.number().int().min(1).max(999) }),
  z.object({ kind: z.literal("structure"), structureDeckId: z.string().min(1), edition: z.enum(["base", "premium"]) }),
  z.object({ kind: z.literal("vip"), days: z.number().int().min(1).max(3650) }),
]);

// Para quem vai o envio
export const targetSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("users"), input: z.string().min(1, "Informe pelo menos um @usuário.") }),
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("clan"), clanId: z.string().min(1, "Escolha o clã.") }),
]);
