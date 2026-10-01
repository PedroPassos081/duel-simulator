-- CreateTable
CREATE TABLE "RankingClosing" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "newsPostId" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankingClosing_kind_endsAt_idx" ON "RankingClosing"("kind", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "RankingClosing_kind_periodKey_key" ON "RankingClosing"("kind", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Season_startsAt_key" ON "Season"("startsAt");

