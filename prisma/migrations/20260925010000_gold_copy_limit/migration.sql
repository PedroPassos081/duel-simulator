-- A 3ª cópia de qualquer carta passa a ser sempre em crédito (cash)
ALTER TABLE "ShopListing" ALTER COLUMN "maxGold" SET DEFAULT 2;

UPDATE "ShopListing" SET "maxGold" = LEAST("maxGold", 2);
