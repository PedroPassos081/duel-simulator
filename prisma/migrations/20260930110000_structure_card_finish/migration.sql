-- AlterTable
ALTER TABLE "StructureDeckCard" ADD COLUMN     "finish" TEXT NOT NULL DEFAULT 'normal';


-- Chama Alada: o Flame Wingman vem Secreta e o Shining Flare Wingman, Rara
UPDATE "StructureDeckCard" SET "finish" = 'secreta' WHERE "cardId" = 35809262;
UPDATE "StructureDeckCard" SET "finish" = 'rara' WHERE "cardId" = 25366484;
