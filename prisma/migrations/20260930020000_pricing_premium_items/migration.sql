-- AlterTable
ALTER TABLE "ShopListing" ADD COLUMN     "customPrice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StructureDeck" ADD COLUMN     "premiumItems" JSONB;

