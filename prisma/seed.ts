import { PrismaClient } from "@prisma/client";

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

function mergeCards(...catalogs: ApiCard[][]) {
  return [...new Map(catalogs.flat().map((card) => [card.id, card])).values()];
}

// =========================================================================
// 1. TABELA DE PREÇOS MANUAIS E LIMITES POR CARTA
// As cartas aqui recebem os teus valores e travas exatas.
// Se a carta NÃO estiver nesta tabela, o script usará o preço automático padrão.
// =========================================================================
const tabelaDePrecosExcecoes: Record<
  number,
  { gold: number; cash: number; maxTotal?: number; maxGold?: number; maxCash?: number }
> = {
  // --- MONSTROS CLÁSSICOS / EFEITO ---
  89631139: { gold: 2000, cash: 200, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Blue-Eyes White Dragon
  46986414: { gold: 1500, cash: 150, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Dark Magician
  70781052: { gold: 400, cash: 40, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Summoned Skull
  52097679: { gold: 500, cash: 50, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Cyber Dragon
  44519536: { gold: 600, cash: 60, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Elemental HERO Stratos

  // --- MONSTROS DO EXTRA DECK ---
  70903359: { gold: 1200, cash: 120, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Stardust Dragon
  25788011: { gold: 1000, cash: 100, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Number 39: Utopia
  63646218: { gold: 800, cash: 80, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Elemental HERO Flame Wingman

  // --- MÁGICAS ---
  83764718: { gold: 1000, cash: 100, maxTotal: 1, maxGold: 1, maxCash: 1 }, // Monster Reborn (Limitada 1x)
  242146: { gold: 400, cash: 40, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Mystical Space Typhoon
  78651105: { gold: 300, cash: 30, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Polymerization
  14087893: { gold: 500, cash: 50, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Book of Moon

  // --- ARMADILHAS ---
  41420027: { gold: 1200, cash: 120, maxTotal: 3, maxGold: 2, maxCash: 1 }, // Solemn Judgment
  18045289: { gold: 600, cash: 60, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Mirror Force
  4734313: { gold: 600, cash: 60, maxTotal: 3, maxGold: 3, maxCash: 3 }, // Torrential Tribute
};

async function main() {
  console.log(`\n[SEED] Limpando dados antigos da loja e cartas...`);
  // Deleta listagens e cartas antigas em cascata para garantir que não fiquem resíduos
  await prisma.shopListing.deleteMany();
  await prisma.card.deleteMany();

  console.log(`[SEED] Buscando catálogo TCG em Inglês (Nomes Oficiais)...`);
  const urlEn = `https://db.ygoprodeck.com/api/v7/cardinfo.php?enddate=2006-12-31&format=tcg`;
  const baseCardsEn = await fetchCards(urlEn, "catálogo TCG em inglês");

  console.log(`[SEED] Buscando pacote seletivo de teste dos Blackwing...`);
  const testIds = TEST_CARD_IDS.join(",");
  const testCardsEn = await fetchCards(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${testIds}`,
    "pacote Blackwing em inglês"
  );
  const apiCardsEn = mergeCards(baseCardsEn, testCardsEn);

  console.log(`[SEED] Buscando catálogo TCG em Português (Efeitos/Descrições)...`);
  const urlPt = `https://db.ygoprodeck.com/api/v7/cardinfo.php?enddate=2006-12-31&format=tcg&language=pt`;
  const [baseCardsPt, testCardsPt] = await Promise.all([
    fetchCards(urlPt, "catálogo TCG em português"),
    fetchCards(
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
    };

    // Cria/Insere a carta no banco
    await prisma.card.upsert({
      where: { id: cardData.id },
      update: cardData,
      create: cardData,
    });

    // =========================================================================
    // 2. LÓGICA DE PRECIFICAÇÃO E LIMITES
    // =========================================================================
    let priceGold = 200;
    let priceCash = 20;
    let maxTotal = 3;
    let maxGold = 3;
    let maxCash = 3;

    if (tabelaDePrecosExcecoes[cardData.id]) {
      const config = tabelaDePrecosExcecoes[cardData.id];
      priceGold = config.gold;
      priceCash = config.cash;
      maxTotal = config.maxTotal ?? 3;
      maxGold = config.maxGold ?? 3;
      maxCash = config.maxCash ?? 3;
      customPriceCount++;
    } else {
      // Regra de precificação padrão por tipo e nível
      const level = cardData.level || 0;
      if (cardType.includes("fusion") || level >= 7) {
        priceGold = 800;
        priceCash = 80;
      } else if (level === 5 || level === 6 || cardType.includes("spell") || cardType.includes("trap")) {
        priceGold = 400;
        priceCash = 40;
      }
    }

    // Cria a listagem correspondente na loja
    await prisma.shopListing.upsert({
      where: { cardId: cardData.id },
      update: {
        priceGold,
        priceCash,
        maxTotal,
        maxGold,
        maxCash,
        cashOnly: false,
        active: true
      },
      create: {
        cardId: cardData.id,
        priceGold,
        priceCash,
        maxTotal,
        maxGold,
        maxCash,
        cashOnly: false,
        active: true
      },
    });

    importCount++;
  }

  console.log(`\n=== LOJA ATUALIZADA COM SUCESSO ===`);
  console.log(`✓ Total de cartas TCG inseridas: ${importCount}`);
  console.log(`✓ Cartas com preços/limites customizados: ${customPriceCount}\n`);
}

main()
  .catch((e) => {
    console.error("\n[ERRO NO SEED]:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
