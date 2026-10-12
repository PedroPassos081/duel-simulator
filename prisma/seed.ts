import { PrismaClient } from "@prisma/client";
import { listingFor } from "../src/lib/card-prices";
import { getShopPricing } from "../src/lib/site-settings";
import { HIDDEN_CARD_NAMES, siteAddedAtForNewCard } from "../src/lib/site";

const prisma = new PrismaClient();

// Cartas liberadas fora do recorte histórico para testar interações complexas
// do OCGCore. Manter esta lista explícita evita importar o catálogo moderno
// inteiro junto do pool base do jogo.
const TEST_CARD_IDS = [
  55610595, // Blackwing - Pinaki the Waxing Moon
  49003716, // Blackwing - Bora the Spear
  58820853, // Blackwing - Shura the Blue Flame
  75498415, // Blackwing - Sirocco the Dawn
  2009101, // Blackwing - Gale the Whirlwind
  81105204, // Blackwing - Kris the Crack of Dawn
  22835145, // Blackwing - Blizzard the Far North
  14785765, // Blackwing - Zephyros the Elite
  85215458, // Blackwing - Kalut the Moon Shadow
  76913983, // Blackwing Armed Wing
  69031175, // Blackwing Armor Master
  33236860, // Blackwing - Silverwind the Ascendant
  1475311, // Allure of Darkness
  53567095, // Icarus Attack
  5318639, // Mystical Space Typhoon
  91351370, // Black Whirlwind
] as const;

type ApiCard = {
  id: number;
  name: string;
  type: string;
  race?: string;
  attribute?: string;
  atk?: number;
  def?: number;
  level?: number;
  desc?: string;
  card_images?: { image_url?: string }[];
  misc_info?: { tcg_date?: string }[]; // vem com &misc=yes
};

async function fetchCards(url: string, label: string): Promise<ApiCard[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao buscar ${label}: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { data?: ApiCard[] };
  if (!Array.isArray(payload.data)) {
    throw new Error(`A API não retornou cartas para ${label}.`);
  }
  return payload.data;
}

async function fetchOptionalCards(url: string, label: string): Promise<ApiCard[]> {
  try {
    return await fetchCards(url, label);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[SEED] Aviso: ${message}. Usando descrições em inglês.`);
    return [];
  }
}

function mergeCards(...catalogs: ApiCard[][]) {
  return [...new Map(catalogs.flat().map((card) => [card.id, card])).values()];
}

// Preços e limites da loja: por categoria e pelo NOME da carta, em src/lib/card-prices.ts
// (Topo 5000/100, Fortes 2500/50, comum 7+/Fusão 800/16, 5–6/Mágica/Armadilha 400/8, 1–4 200/4).

async function main() {
  console.log(`[SEED] Buscando catálogo TCG em Inglês (Nomes Oficiais)...`);
  const urlEn = `https://db.ygoprodeck.com/api/v7/cardinfo.php?enddate=2006-12-31&format=tcg&misc=yes`;
  const baseCardsEn = await fetchCards(urlEn, "catálogo TCG em inglês");

  console.log(`[SEED] Buscando pacote seletivo de teste dos Blackwing...`);
  const testIds = TEST_CARD_IDS.join(",");
  const testCardsEn = await fetchCards(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${testIds}&misc=yes`,
    "pacote Blackwing em inglês"
  );
  const returnedTestIds = new Set(testCardsEn.map((card) => card.id));
  const missingTestIds = TEST_CARD_IDS.filter((id) => !returnedTestIds.has(id));
  if (missingTestIds.length > 0) {
    throw new Error(`A API não retornou as cartas de teste: ${missingTestIds.join(", ")}.`);
  }
  const apiCardsEn = mergeCards(baseCardsEn, testCardsEn);

  console.log(`[SEED] Buscando catálogo TCG em Português (Efeitos/Descrições)...`);
  const urlPt = `https://db.ygoprodeck.com/api/v7/cardinfo.php?enddate=2006-12-31&format=tcg&language=pt`;
  const [baseCardsPt, testCardsPt] = await Promise.all([
    fetchOptionalCards(urlPt, "catálogo TCG em português"),
    fetchOptionalCards(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${testIds}&language=pt`,
      "pacote Blackwing em português"
    ),
  ]);

  // Mapeia as descrições traduzidas em Português usando o ID da carta
  const ptDescMap = new Map<number, string>();
  for (const card of mergeCards(baseCardsPt, testCardsPt)) {
    if (card.desc) ptDescMap.set(card.id, card.desc);
  }

  console.log(
    `[SEED] Processando ${apiCardsEn.length} cartas TCG (pool base + ${TEST_CARD_IDS.length} cartas de teste). Populando o banco...`
  );

  let importCount = 0;
  let customPriceCount = 0;

  // Preços das categorias definidos no painel do Admin; cartas com preço manual mantêm o preço
  const { tiers } = await getShopPricing();
  const manualPrice = new Set(
    (await prisma.shopListing.findMany({ where: { customPrice: true }, select: { cardId: true } })).map((l) => l.cardId)
  );

  for (const apiCard of apiCardsEn) {
    const cardType = apiCard.type.toLowerCase();

    // Filtro para ignorar mecânicas modernas pós-2006 e tokens
    if (cardType.includes("pendulum") || cardType.includes("link") || cardType.includes("token")) {
      continue;
    }

    // Pega a descrição em PT se existir; se não, usa a em EN como fallback
    const descriptionPt = ptDescMap.get(apiCard.id) || apiCard.desc || "";

    const cardData = {
      id: apiCard.id,
      name: apiCard.name, // Nome em INGLÊS (ex: "Blue-Eyes White Dragon")
      type: apiCard.type,
      race: apiCard.race || null,
      attribute: apiCard.attribute || null,
      atk: typeof apiCard.atk === "number" ? apiCard.atk : null,
      def: typeof apiCard.def === "number" ? apiCard.def : null,
      level: typeof apiCard.level === "number" ? apiCard.level : null,
      description: descriptionPt, // Efeito em PORTUGUÊS
      imageUrl: apiCard.card_images?.[0]?.image_url || null,
      releaseDate: apiCard.misc_info?.[0]?.tcg_date ? new Date(apiCard.misc_info[0].tcg_date) : null,
    };

    // Cria/Insere a carta no banco
    // siteAddedAt só na criação: depois do lançamento do site, marca quando a carta entrou no jogo
    await prisma.card.upsert({
      where: { id: cardData.id },
      update: cardData,
      create: { ...cardData, siteAddedAt: siteAddedAtForNewCard() },
    });

    // =========================================================================
    // 2. LÓGICA DE PRECIFICAÇÃO E LIMITES
    // =========================================================================
    const { priceGold, priceCash, maxTotal, maxGold, maxCash } = listingFor(cardData, tiers);
    if (priceGold >= 2500 || maxTotal < 3 || maxCash < 3) customPriceCount++;

    // Cria a listagem correspondente na loja
    await prisma.shopListing.upsert({
      where: { cardId: cardData.id },
      update: {
        ...(manualPrice.has(cardData.id) ? {} : { priceGold, priceCash }),
        maxTotal,
        maxGold,
        maxCash,
        cashOnly: false,
        // Registros vazios da YGOPRODeck (ex.: "???") não aparecem na loja
        active: !HIDDEN_CARD_NAMES.includes(cardData.name)
      },
      create: {
        cardId: cardData.id,
        priceGold,
        priceCash,
        maxTotal,
        maxGold,
        maxCash,
        cashOnly: false,
        // Registros vazios da YGOPRODeck (ex.: "???") não aparecem na loja
        active: !HIDDEN_CARD_NAMES.includes(cardData.name)
      },
    });

    importCount++;
  }

  console.log(`\n=== LOJA ATUALIZADA COM SUCESSO ===`);
  console.log(`✓ Total de cartas TCG inseridas: ${importCount}`);
  console.log(`✓ Cartas no Topo/Fortes ou com limite especial: ${customPriceCount}\n`);
}

main()
  .catch((e) => {
    console.error("\n[ERRO NO SEED]:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
