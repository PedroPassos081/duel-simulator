import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    ownershipByCard = new Map(ownerships.map((o) => [o.cardId, o.quantity]));
  }

  const result = listings.map((listing) => ({
    ...listing,
    ownedQuantity: ownershipByCard.get(listing.cardId) ?? 0,
  }));

  return NextResponse.json(result);
}
