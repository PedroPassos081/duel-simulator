-- AlterTable
ALTER TABLE "Cosmetic" ADD COLUMN     "structureDeckId" TEXT;

-- CreateTable
CREATE TABLE "StructureDeck" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverCardId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceCash" INTEGER,
    "priceGold" INTEGER,
    "premiumPriceCash" INTEGER,
    "premiumPriceGold" INTEGER,
    "moneyPriceCents" INTEGER,
    "premiumMoneyPriceCents" INTEGER,
    "moneyDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructureDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureDeckCard" (
    "id" TEXT NOT NULL,
    "structureDeckId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StructureDeckCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureDeckPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "structureDeckId" TEXT NOT NULL,
    "edition" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructureDeckPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StructureDeck_name_key" ON "StructureDeck"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StructureDeckCard_structureDeckId_cardId_section_key" ON "StructureDeckCard"("structureDeckId", "cardId", "section");

-- CreateIndex
CREATE INDEX "StructureDeckPurchase_userId_structureDeckId_idx" ON "StructureDeckPurchase"("userId", "structureDeckId");

-- AddForeignKey
ALTER TABLE "Cosmetic" ADD CONSTRAINT "Cosmetic_structureDeckId_fkey" FOREIGN KEY ("structureDeckId") REFERENCES "StructureDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureDeckCard" ADD CONSTRAINT "StructureDeckCard_structureDeckId_fkey" FOREIGN KEY ("structureDeckId") REFERENCES "StructureDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureDeckCard" ADD CONSTRAINT "StructureDeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureDeckPurchase" ADD CONSTRAINT "StructureDeckPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureDeckPurchase" ADD CONSTRAINT "StructureDeckPurchase_structureDeckId_fkey" FOREIGN KEY ("structureDeckId") REFERENCES "StructureDeck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

