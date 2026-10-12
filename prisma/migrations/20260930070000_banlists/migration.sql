-- CreateTable
CREATE TABLE "Banlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'tournament',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanlistChange" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "announcedAt" TIMESTAMP(3),

    CONSTRAINT "BanlistChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BanlistChange_format_announcedAt_idx" ON "BanlistChange"("format", "announcedAt");


-- Banlists das salas
INSERT INTO "Banlist" ("id", "name", "kind", "description", "updatedAt") VALUES
  ('slifer', 'Sala Slifer', 'room', 'Perto do Tag Force 1: cartas até 2006 e adições escolhidas.', CURRENT_TIMESTAMP),
  ('obelisk', 'Sala Obelisco', 'room', 'Edison sem o meta, com XYZ e adições escolhidas.', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
