-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "border" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "finish" TEXT NOT NULL DEFAULT 'normal';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspendedUntil" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

-- CreateTable
CREATE TABLE "UserCardVariant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "finish" TEXT NOT NULL,
    "border" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "UserCardVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserItem" (
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserItem_pkey" PRIMARY KEY ("userId","itemKey")
);

-- CreateTable
CREATE TABLE "ItemTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminGrant" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Punishment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Punishment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCardVariant_userId_cardId_idx" ON "UserCardVariant"("userId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCardVariant_userId_cardId_finish_border_key" ON "UserCardVariant"("userId", "cardId", "finish", "border");

-- CreateIndex
CREATE INDEX "ItemTransaction_userId_createdAt_idx" ON "ItemTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminGrant_createdAt_idx" ON "AdminGrant"("createdAt");

-- CreateIndex
CREATE INDEX "AdminGrant_targetUserId_idx" ON "AdminGrant"("targetUserId");

-- CreateIndex
CREATE INDEX "Punishment_userId_createdAt_idx" ON "Punishment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserCardVariant" ADD CONSTRAINT "UserCardVariant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCardVariant" ADD CONSTRAINT "UserCardVariant_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserItem" ADD CONSTRAINT "UserItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTransaction" ADD CONSTRAINT "ItemTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Punishment" ADD CONSTRAINT "Punishment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

