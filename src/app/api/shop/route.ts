import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ShopListing, UserCardOwnership } from "@prisma/client";

export async function GET() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  const listings = await prisma.shopListing.findMany({
    where: { active: true },
    include: { card: true },
    orderBy: { card: { name: "asc" } },
  });

  let ownershipByCard = new Map<number, number>();
  if (userId) {
    const ownerships = await prisma.userCardOwnership.findMany({ where: { userId } });
    // Define explicitamente o tipo do parâmetro 'o' com base no modelo do Prisma
    ownershipByCard = new Map(
      ownerships.map((o: UserCardOwnership) => [o.cardId, o.quantity])
    );
  }

  // Define o tipo do parâmetro 'listing' combinando o modelo da tabela com a relação incluída do card
  const result = listings.map((listing: ShopListing & { card: any }) => ({
    ...listing,
    ownedQuantity: ownershipByCard.get(listing.cardId) ?? 0,
  }));

  return NextResponse.json(result);
}