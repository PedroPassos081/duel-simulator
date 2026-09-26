-- CreateTable
CREATE TABLE "MatchQueueEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchQueueEntry_room_createdAt_idx" ON "MatchQueueEntry"("room", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchQueueEntry_userId_room_key" ON "MatchQueueEntry"("userId", "room");

-- AddForeignKey
ALTER TABLE "MatchQueueEntry" ADD CONSTRAINT "MatchQueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

