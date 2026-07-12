import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Conjunto pequeno de cartas de exemplo, formato Edison.
// Troque pelos dados reais na fase 2 (integração com base real de cartas).
const cards = [
  {
    id: 1,
    name: "Elemental HERO Stratos",
    type: "Monster",
    race: "Warrior",
    attribute: "WIND",
    atk: 1800,
    def: 300,
    level: 4,
    description: "Quando este card é Normal ou Special Invocado: você pode comprar 1 card.",
    imageUrl: null,
  },
  {
    id: 2,
    name: "Destiny Draw",
    type: "Spell",
    race: null,
    attribute: null,
    atk: null,
    def: null,
    level: null,
    description: "Envie 1 'Destiny Hero' da sua mão ao Cemitério; compre 2 cards.",
    imageUrl: null,
  },
  {
    id: 3,
    name: "Dark Armed Dragon",
    type: "Monster",
    race: "Dragon",
    attribute: "DARK",
    atk: 2800,
    def: 1000,
    level: 8,
    description: "Precisa de 3 monstros DARK no Cemitério para Special Summon.",
    imageUrl: null,
  },
  {
    id: 4,
    name: "Reinforcement of the Army",
    type: "Spell",
    race: null,
    attribute: null,
    atk: null,
    def: null,
    level: null,
    description: "Adicione 1 monstro Warrior de Nível 4 ou menor da sua Deck à sua mão.",
    imageUrl: null,
  },
  {
    id: 5,
    name: "Mystic Tomato",
    type: "Monster",
    race: "Plant",
    attribute: "DARK",
    atk: 1400,
    def: 1100,
    level: 4,
    description: "Quando destruído em batalha: Special Summon 1 monstro DARK de 1500 ATK ou menos da Deck.",
    imageUrl: null,
  },
];

const banlist = [
  { cardId: 3, format: "edison", status: "limited" }, // Dark Armed Dragon
  { cardId: 2, format: "edison", status: "semi-limited" }, // Destiny Draw
];

// Preço em gold/cash. Cartas mais fortes tendem a custar mais ou serem cash-only.
const shopListings = [
  { cardId: 1, priceGold: 500, priceCash: null, cashOnly: false },
  { cardId: 2, priceGold: 300, priceCash: null, cashOnly: false },
  { cardId: 3, priceGold: null, priceCash: 150, cashOnly: true }, // carta forte, só com cash
  { cardId: 4, priceGold: 200, priceCash: 20, cashOnly: false },
  { cardId: 5, priceGold: 100, priceCash: null, cashOnly: false },
];

async function main() {
  for (const card of cards) {
    await prisma.card.upsert({
      where: { id: card.id },
      update: card,
      create: card,
    });
  }

  for (const entry of banlist) {
    await prisma.banlistEntry.upsert({
      where: { cardId_format: { cardId: entry.cardId, format: entry.format } },
      update: entry,
      create: entry,
    });
  }

  for (const listing of shopListings) {
    await prisma.shopListing.upsert({
      where: { cardId: listing.cardId },
      update: listing,
      create: listing,
    });
  }

  console.log(`Seed concluído: ${cards.length} cartas, ${banlist.length} entradas de banlist, ${shopListings.length} itens na loja.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
