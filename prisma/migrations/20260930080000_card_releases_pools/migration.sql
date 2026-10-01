-- AlterTable
ALTER TABLE "Banlist" ADD COLUMN     "poolUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "releaseId" TEXT,
ADD COLUMN     "released" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BanlistExtraCard" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,

    CONSTRAINT "BanlistExtraCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardRelease" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "releaseAt" TIMESTAMP(3),
    "promoPercent" INTEGER NOT NULL DEFAULT 0,
    "promoHours" INTEGER NOT NULL DEFAULT 0,
    "releasedAt" TIMESTAMP(3),
    "calendarEventId" TEXT,
    "newsPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BanlistExtraCard_format_cardId_key" ON "BanlistExtraCard"("format", "cardId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "CardRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanlistExtraCard" ADD CONSTRAINT "BanlistExtraCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Pool das salas: Slifer até o fim de 2006 (Tag Force 1); Obelisco até o fim do Edison
UPDATE "Banlist" SET "poolUntil" = '2007-01-01 03:00:00' WHERE "id" = 'slifer';
UPDATE "Banlist" SET "poolUntil" = '2010-04-01 03:00:00' WHERE "id" = 'obelisk';
