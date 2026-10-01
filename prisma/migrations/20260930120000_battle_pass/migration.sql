-- CreateTable
CREATE TABLE "BattlePass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "artCardId" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "levels" INTEGER NOT NULL DEFAULT 50,
    "xpPerLevel" INTEGER NOT NULL DEFAULT 500,
    "xpWin" INTEGER NOT NULL DEFAULT 100,
    "xpLoss" INTEGER NOT NULL DEFAULT 40,
    "premiumPriceCash" INTEGER NOT NULL DEFAULT 300,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattlePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattlePassReward" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    "reward" JSONB NOT NULL,

    CONSTRAINT "BattlePassReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattlePassProgress" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "premiumAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattlePassProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattlePassClaim" (
    "id" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattlePassClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattlePassMissionClaim" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattlePassMissionClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BattlePassReward_passId_level_track_key" ON "BattlePassReward"("passId", "level", "track");

-- CreateIndex
CREATE UNIQUE INDEX "BattlePassProgress_passId_userId_key" ON "BattlePassProgress"("passId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BattlePassClaim_progressId_level_track_key" ON "BattlePassClaim"("progressId", "level", "track");

-- CreateIndex
CREATE UNIQUE INDEX "BattlePassMissionClaim_passId_userId_missionKey_periodKey_key" ON "BattlePassMissionClaim"("passId", "userId", "missionKey", "periodKey");

-- AddForeignKey
ALTER TABLE "BattlePassReward" ADD CONSTRAINT "BattlePassReward_passId_fkey" FOREIGN KEY ("passId") REFERENCES "BattlePass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattlePassProgress" ADD CONSTRAINT "BattlePassProgress_passId_fkey" FOREIGN KEY ("passId") REFERENCES "BattlePass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattlePassClaim" ADD CONSTRAINT "BattlePassClaim_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "BattlePassProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

