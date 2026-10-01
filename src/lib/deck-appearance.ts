import { prisma } from "@/lib/prisma";

export class DeckAppearanceError extends Error {}

export interface DeckAppearance {
  sleeveId?: string | null;
  playmatId?: string | null;
}

/**
 * Confere que a sleeve e o playmat escolhidos para o deck são do jogador e do
 * tipo certo. null = "Padrão da conta" (usa o que está equipado em Personalizar).
 * Campos ausentes (undefined) não são alterados.
 */
export async function validateDeckAppearance(userId: string, appearance: DeckAppearance) {
  const checks: [keyof DeckAppearance, string, string][] = [
    ["sleeveId", "sleeve", "Essa sleeve"],
    ["playmatId", "playmat", "Esse playmat"],
  ];
  for (const [field, type, label] of checks) {
    const cosmeticId = appearance[field];
    if (!cosmeticId) continue;
    const owned = await prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId } },
      include: { cosmetic: { select: { type: true } } },
    });
    if (!owned || owned.cosmetic.type !== type) {
      throw new DeckAppearanceError(`${label} não é sua.`);
    }
  }
  return {
    ...(appearance.sleeveId !== undefined && { sleeveId: appearance.sleeveId }),
    ...(appearance.playmatId !== undefined && { playmatId: appearance.playmatId }),
  };
}
