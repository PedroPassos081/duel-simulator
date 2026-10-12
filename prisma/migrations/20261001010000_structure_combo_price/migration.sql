-- AlterTable
ALTER TABLE "StructureDeck" ADD COLUMN     "discountPercent" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "StructureDeckPurchase" ADD COLUMN     "amountCash" INTEGER NOT NULL DEFAULT 0;


-- Existing shop prices and configured discounts are preserved.
