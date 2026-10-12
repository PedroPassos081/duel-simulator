import type { Prisma } from "@prisma/client";

export const duelUserSelect = {
  name: true, username: true, image: true,
  equippedCosmetics: {
    where: { type: { in: ["frame", "name_style", "sleeve", "playmat"] } },
    select: { type: true, cosmetic: { select: { imageUrl: true, effect: true } } },
  },
} satisfies Prisma.UserSelect;

type DuelUser = Prisma.UserGetPayload<{ select: typeof duelUserSelect }>;
export function duelAppearance(user?: DuelUser) {
  const equipped = (type: string) => user?.equippedCosmetics.find(item => item.type === type)?.cosmetic;
  return {
    nickname: user?.username ?? user?.name ?? "Duelista",
    image: user?.image ?? null,
    frameUrl: equipped("frame")?.imageUrl ?? null,
    nameEffect: equipped("name_style")?.effect ?? null,
    sleeveUrl: equipped("sleeve")?.imageUrl ?? null,
    playmatUrl: equipped("playmat")?.imageUrl ?? null,
    playmatEffect: equipped("playmat")?.effect ?? null,
  };
}
