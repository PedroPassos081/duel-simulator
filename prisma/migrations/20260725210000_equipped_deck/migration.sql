ALTER TABLE "Deck" ADD COLUMN "isEquipped" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Deck_userId_isEquipped_idx" ON "Deck"("userId", "isEquipped");
