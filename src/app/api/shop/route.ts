import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ShopListing, UserCardOwnership } from "@prisma/client";
import { ROOM_BANLISTS } from "@/lib/banlist-shared";
import { getPools, isInPool } from "@/lib/card-pools";
import { getActivePromos, processDueReleases, promoPrice } from "@/lib/card-releases";

const ROOM_IDS = ROOM_BANLISTS.map((r) => r.id);

export async function GET() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  // Lançamentos que chegaram na data entram na loja agora
  await processDueReleases();
  const [pools, promos] = await Promise.all([getPools(ROOM_IDS), getActivePromos()]);

  const listings = await prisma.shopListing.findMany({
    // Cartas não lançadas ficam fora da loja
    where: { active: true, card: { released: true } },
    // Status nas banlists das salas: aparece na carta e no filtro "Limite de cópias"
    include: { card: { include: { banlistEntries: { where: { format: { in: ROOM_IDS } }, select: { format: true, status: true } } } } },
    orderBy: { card: { name: "asc" } },
  });

  let ownershipByCard = new Map<number, number>();
  // Cópias evoluídas do jogador (Rara, Ultra... + borda), para a loja oferecer "subir a raridade"
  const variantsByCard = new Map<number, { finish: string; border: string; quantity: number }[]>();
  if (userId) {
    const variants = await prisma.userCardVariant.findMany({ where: { userId, quantity: { gt: 0 } } });
    for (const v of variants) {
      variantsByCard.set(v.cardId, [...(variantsByCard.get(v.cardId) ?? []), { finish: v.finish, border: v.border, quantity: v.quantity }]);
    }
    const ownerships = await prisma.userCardOwnership.findMany({ where: { userId } });
    // Define explicitamente o tipo do parâmetro 'o' com base no modelo do Prisma
    ownershipByCard = new Map(
      ownerships.map((o: UserCardOwnership) => [o.cardId, o.quantity])
    );
  }

  // Define o tipo do parâmetro 'listing' combinando o modelo da tabela com a relação incluída do card
  const result = listings.map((listing: ShopListing & { card: any }) => {
    const owned = ownershipByCard.get(listing.cardId) ?? 0;
    const evolved = variantsByCard.get(listing.cardId) ?? [];
    const normal = owned - evolved.reduce((sum, v) => sum + v.quantity, 0);
    const promo = promos.get(listing.cardId);
    return {
      ...listing,
      // Preço já com o desconto da promoção de lançamento (o servidor cobra o mesmo)
      priceGold: promoPrice(listing.priceGold, promo),
      priceCash: promoPrice(listing.priceCash, promo),
      promo: promo ? { ...promo, priceGold: listing.priceGold, priceCash: listing.priceCash } : null,
      // Salas em que a carta existe (pool: Slifer até 2006, Obelisco Edison + adições)
      rooms: ROOM_IDS.filter((room) => isInPool(listing.card, pools.get(room)!)),
      ownedQuantity: owned,
      // Versões que o jogador tem desta carta (Normal = o que sobra do total)
      versions: [...(normal > 0 ? [{ finish: "normal", border: "none", quantity: normal }] : []), ...evolved],
    };
  });

  return NextResponse.json(result);
}