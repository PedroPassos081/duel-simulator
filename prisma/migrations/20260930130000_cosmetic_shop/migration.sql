-- AlterTable
ALTER TABLE "Cosmetic" ADD COLUMN     "inShop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shopUnlockAt" TIMESTAMP(3);

