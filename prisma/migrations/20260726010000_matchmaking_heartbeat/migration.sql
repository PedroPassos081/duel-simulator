ALTER TABLE "MatchPlayer"
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "MatchPlayer_lastSeenAt_idx" ON "MatchPlayer"("lastSeenAt");
