-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "gameNumber" INTEGER,
ADD COLUMN     "opensAt" TIMESTAMP(3),
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "woAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MatchPlayer" ADD COLUMN     "joinedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "clockSeconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "maxEntrants" INTEGER,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "structure" TEXT NOT NULL DEFAULT 'points';

-- CreateTable
CREATE TABLE "TournamentStage" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentSeries" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "playerAId" TEXT,
    "playerBId" TEXT,
    "winsA" INTEGER NOT NULL DEFAULT 0,
    "winsB" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "nextSeriesId" TEXT,
    "nextSide" TEXT,
    "chooserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentStage_tournamentId_key_key" ON "TournamentStage"("tournamentId", "key");

-- CreateIndex
CREATE INDEX "TournamentSeries_tournamentId_stageKey_round_idx" ON "TournamentSeries"("tournamentId", "stageKey", "round");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TournamentSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentStage" ADD CONSTRAINT "TournamentStage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentSeries" ADD CONSTRAINT "TournamentSeries_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

