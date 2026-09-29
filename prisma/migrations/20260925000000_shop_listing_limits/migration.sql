-- AlterTable
-- Estas colunas já são criadas por 20260725181743_sync_auth_schema na branch do
-- duelo. IF NOT EXISTS deixa esta migração segura nos dois bancos: no que já
-- tem as colunas ela não faz nada, e no que não tem ela as cria.
ALTER TABLE "ShopListing" ADD COLUMN IF NOT EXISTS "maxCash" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "maxGold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "maxTotal" INTEGER NOT NULL DEFAULT 3;
