ALTER TABLE "Match"
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'waiting',
ADD COLUMN "currentTurn" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentPhase" TEXT NOT NULL DEFAULT 'waiting',
ADD COLUMN "engineState" JSONB;

CREATE INDEX "Match_status_createdAt_idx" ON "Match"("status", "createdAt");
CREATE INDEX "MatchPlayer_matchId_idx" ON "MatchPlayer"("matchId");
