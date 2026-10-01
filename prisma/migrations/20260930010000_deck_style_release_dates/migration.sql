-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "releaseDate" TIMESTAMP(3),
ADD COLUMN     "siteAddedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN     "playmatId" TEXT,
ADD COLUMN     "sleeveId" TEXT;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_sleeveId_fkey" FOREIGN KEY ("sleeveId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_playmatId_fkey" FOREIGN KEY ("playmatId") REFERENCES "Cosmetic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

