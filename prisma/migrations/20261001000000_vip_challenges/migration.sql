-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vipUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChallengeClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChallengeClaim_userId_idx" ON "ChallengeClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeClaim_userId_key_periodKey_key" ON "ChallengeClaim"("userId", "key", "periodKey");

