import { prisma } from "../src/lib/prisma";
import { expireOldDuels } from "../src/lib/duel/expiry";
expireOldDuels()
  .then((count) =>
    console.log(`${count} duelo(s) expirado(s) cancelado(s), sem recompensas.`),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
