// Reaplica na loja os preços por categoria (definidos no painel do Admin) e preenche a
// data de lançamento no TCG das cartas que ainda não têm. Não apaga nada.
//
//   npm run prisma:apply-prices
//
import { PrismaClient } from "@prisma/client";
import { PRICE_TIERS } from "../src/lib/card-prices";
import { applyTierPrices } from "../src/lib/admin-pricing";
import { getShopPricing } from "../src/lib/site-settings";
import { HIDDEN_CARD_NAMES } from "../src/lib/site";

const prisma = new PrismaClient();
const CHUNK = 150; // cartas por requisição à YGOPRODeck

// Preços da categoria definidos no painel do Admin; cartas com preço manual ficam de fora
async function applyPrices() {
  const { changed, total, custom, byTier } = await applyTierPrices();
  const { tiers } = await getShopPricing();
  console.log(`✓ Preços: ${changed} de ${total} cartas atualizadas (${custom} com preço manual não foram mexidas)`);
  for (const [tier, count] of Object.entries(byTier)) {
    const t = tiers[tier as keyof typeof tiers];
    console.log(`   ${PRICE_TIERS[tier as keyof typeof PRICE_TIERS].label.padEnd(38)} ${String(count).padStart(5)} cartas  (${t.gold} gold / ${t.cash} crédito)`);
  }
}

async function backfillReleaseDates() {
  const cards = await prisma.card.findMany({ where: { releaseDate: null }, select: { id: true } });
  // data do TCG -> cartas com essa data
  const byDate = new Map<string, number[]>();
  for (let i = 0; i < cards.length; i += CHUNK) {
    const ids = cards.slice(i, i + CHUNK).map((c) => c.id);
    const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes&id=${ids.join(",")}`);
    if (!res.ok) {
      console.warn(`   aviso: a YGOPRODeck respondeu ${res.status} para um lote; ele fica para a próxima vez.`);
      continue;
    }
    const data = ((await res.json()) as { data?: { id: number; misc_info?: { tcg_date?: string }[] }[] }).data ?? [];
    for (const c of data) {
      const date = c.misc_info?.[0]?.tcg_date;
      if (!date) continue;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(c.id);
    }
  }
  let filled = 0;
  for (const [date, ids] of byDate) {
    const { count } = await prisma.card.updateMany({ where: { id: { in: ids } }, data: { releaseDate: new Date(date) } });
    filled += count;
  }
  console.log(`✓ Datas de lançamento no TCG: ${filled} de ${cards.length} cartas sem data foram preenchidas`);
}

// Registros vazios da YGOPRODeck (ex.: "???") saem da loja
async function hideEmptyCards() {
  const { count } = await prisma.shopListing.updateMany({
    where: { active: true, card: { name: { in: HIDDEN_CARD_NAMES } } },
    data: { active: false },
  });
  console.log(`✓ Escondidas da loja: ${count} (${HIDDEN_CARD_NAMES.join(", ")})`);
}

async function main() {
  await hideEmptyCards();
  await applyPrices();
  await backfillReleaseDates();
}

main()
  .catch((e) => {
    console.error("\n[ERRO]:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
