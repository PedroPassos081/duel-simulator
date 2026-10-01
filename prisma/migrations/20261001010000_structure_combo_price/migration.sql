-- AlterTable
ALTER TABLE "StructureDeck" ADD COLUMN     "discountPercent" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "StructureDeckPurchase" ADD COLUMN     "amountCash" INTEGER NOT NULL DEFAULT 0;


-- Teto de crédito das cartas: 100 → 50 (todas as faixas pela metade)
UPDATE "ShopListing" SET "priceCash" = GREATEST(1, ROUND("priceCash" / 2.0)) WHERE "priceCash" IS NOT NULL;
-- Dinheiro: preço cheio riscado e 25% de desconto
UPDATE "StructureDeck" SET "moneyDiscountPercent" = 25;
