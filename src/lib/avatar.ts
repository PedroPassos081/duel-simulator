import type { Prisma } from "@prisma/client";

// A foto de perfil e o nick aparecem em vários lugares (navbar, perfil, duelo,
// ranking, pódio de títulos, jornal) sempre com a moldura e o estilo de nick
// equipados. Para qualquer tela nova:
//
//   const user = await prisma.user.findUnique({ where: { id }, select: userAvatarSelect });
//   <Avatar {...toAvatarProps(user)} size={48} />
//   <PlayerName {...toPlayerNameProps(user)} />
//
// Assim a moldura e o estilo do nick aparecem automaticamente em todo lugar.
export const userAvatarSelect = {
  name: true,
  username: true,
  image: true,
  equippedCosmetics: {
    where: { type: { in: ["frame", "name_style"] } },
    select: { type: true, cosmetic: { select: { imageUrl: true, effect: true } } },
  },
} satisfies Prisma.UserSelect;

type UserAvatarData = Prisma.UserGetPayload<{ select: typeof userAvatarSelect }>;

function equipped(user: UserAvatarData, type: string) {
  return user.equippedCosmetics.find((e) => e.type === type)?.cosmetic;
}

export function toAvatarProps(user: UserAvatarData) {
  return {
    image: user.image,
    name: user.username ?? user.name,
    frameUrl: equipped(user, "frame")?.imageUrl ?? null,
  };
}

export function toPlayerNameProps(user: UserAvatarData) {
  return {
    name: user.username ?? user.name,
    effect: equipped(user, "name_style")?.effect ?? null,
    // O nome vira link para o perfil público (/perfil/@nick)
    profile: user.username ?? null,
  };
}
