import { PrismaClient } from "@prisma/client";

// Structure Deck "Elemental HERO: Chama Alada" + cosméticos exclusivos da edição Premium.
// Idempotente: pode rodar de novo para ajustar cartas, preços ou textos (não duplica nada).
//   npm run prisma:seed-hero
const prisma = new PrismaClient();

const NAME = "Elemental HERO: Chama Alada";

const cropped = (id: number) => `https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg`;

// Main Deck: 40 cartas, quase todas do arquétipo. Genéricas só as baratas (MST, Call of the Haunted...).
const MAIN: [cardId: number, quantity: number, name: string][] = [
  // Monstros (20)
  [21844576, 3, "Elemental HERO Avian"],
  [58932615, 3, "Elemental HERO Burstinatrix"],
  [84327329, 3, "Elemental HERO Clayman"],
  [20721928, 3, "Elemental HERO Sparkman"],
  [79979666, 3, "Elemental HERO Bubbleman"],
  [86188410, 3, "Elemental HERO Wildheart"],
  [89252153, 1, "Elemental HERO Necroshade"],
  [5285665, 1, "Elemental HERO Neo Bubbleman"],
  // Magias de fusão e suporte HERO (17)
  [24094653, 3, "Polymerization"],
  [45906428, 3, "Miracle Fusion"],
  [33550694, 1, "Fusion Gate"],
  [18511384, 2, "Fusion Recovery"],
  [26902560, 2, "Fusion Sage"],
  [77565204, 2, "Future Fusion"],
  [32807846, 2, "Reinforcement of the Army"],
  [5318639, 2, "Mystical Space Typhoon"],
  // Armadilhas baratas (3)
  [97077563, 1, "Call of the Haunted"],
  [29401950, 1, "Bottomless Trap Hole"],
  [56120475, 1, "Sakuretsu Armor"],
];

// Raridade das cópias que vêm no deck (o resto vem Normal)
const FINISH: Record<number, "rara" | "ultra" | "secreta"> = {
  35809262: "secreta", // Elemental HERO Flame Wingman
  25366484: "rara", // Elemental HERO Shining Flare Wingman
};

// Extra Deck: 13 fusões, com o Flame Wingman em destaque.
const EXTRA: [cardId: number, quantity: number, name: string][] = [
  [35809262, 3, "Elemental HERO Flame Wingman"],
  [25366484, 1, "Elemental HERO Shining Flare Wingman"],
  [55615891, 1, "Elemental HERO Wild Wingman"],
  [61204971, 2, "Elemental HERO Thunder Giant"],
  [47737087, 1, "Elemental HERO Rampart Blaster"],
  [81197327, 1, "Elemental HERO Steam Healer"],
  [14225239, 1, "Elemental HERO Mariner"],
  [81003500, 1, "Elemental HERO Necroid Shaman"],
  [52031567, 1, "Elemental HERO Mudballman"],
  [41436536, 1, "Elemental HERO Phoenix Enforcer"],
];

// Cosméticos: não vão para a loja (sem preço); só vêm na edição Premium do deck.
const COSMETICS = [
  {
    type: "sleeve",
    name: "Sleeve Chama Alada",
    description: "O Flame Wingman em outra arte, de frente, com as asas abertas sob a lua cheia.",
    // Arte alternativa do Flame Wingman (carta "Favorite HERO Flame Wingman"), diferente da do tapete
    imageUrl: cropped(13243124),
    rarity: "epic",
  },
  {
    type: "playmat",
    name: "Tapete Chama Alada · Nacional Brasil",
    description: "Tapete de campeonato com o Flame Wingman e as cores do Brasil.",
    imageUrl: cropped(35809262),
    effect: "brasil",
    rarity: "legendary",
  },
  {
    type: "frame",
    name: "Moldura Chama Alada",
    description: "Anel de fogo com as asas do Flame Wingman em volta da sua foto de perfil.",
    imageUrl: "/assets/frames/flame-wingman.svg",
    rarity: "epic",
  },
] as const;

async function main() {
  const cards = [
    ...MAIN.map(([cardId, quantity]) => ({ cardId, section: "main", quantity, finish: FINISH[cardId] ?? "normal" })),
    ...EXTRA.map(([cardId, quantity]) => ({ cardId, section: "extra", quantity, finish: FINISH[cardId] ?? "normal" })),
  ];

  const mainTotal = MAIN.reduce((n, [, q]) => n + q, 0);
  const extraTotal = EXTRA.reduce((n, [, q]) => n + q, 0);
  if (mainTotal !== 40) throw new Error(`O Main Deck precisa ter 40 cartas, mas tem ${mainTotal}.`);
  if (extraTotal > 15) throw new Error(`O Extra Deck passa de 15 cartas (${extraTotal}).`);

  const found = await prisma.card.findMany({ where: { id: { in: cards.map((c) => c.cardId) } }, select: { id: true } });
  const missing = cards.filter((c) => !found.some((f) => f.id === c.cardId));
  if (missing.length > 0) throw new Error(`Cartas ausentes no catálogo: ${missing.map((m) => m.cardId).join(", ")}. Rode o seed da loja antes.`);

  const data = {
    description:
      "Um deck completo de Elemental HERO: fusões flamejantes, Miracle Fusion e o poderoso Flame Wingman. Poucas cartas genéricas e nenhuma cara. A edição Premium acompanha sleeve, tapete e moldura exclusivos.",
    coverCardId: 35809262,
    // Valores iniciais (ajuste aqui e rode de novo)
    priceGold: 6000,
    priceCash: 250,
    premiumPriceGold: 9000,
    premiumPriceCash: 400,
    moneyPriceCents: 3990,
    premiumMoneyPriceCents: 6990,
    moneyDiscountPercent: 25, // dinheiro: cheio riscado e 25% off
    discountPercent: 30, // gold + crédito: 30% sobre as cartas avulsas
    // Itens que vêm em toda compra Premium
    premiumItems: [
      { item: "po_milenio_raro", quantity: 2 },
      { item: "moldura_prata", quantity: 1 },
    ],
    active: true,
  };

  const deck = await prisma.structureDeck.upsert({ where: { name: NAME }, update: data, create: { name: NAME, ...data } });

  // Recria a lista de cartas (o deck é o dono da lista; compras antigas já copiaram as cartas)
  await prisma.structureDeckCard.deleteMany({ where: { structureDeckId: deck.id } });
  await prisma.structureDeckCard.createMany({ data: cards.map((c) => ({ ...c, structureDeckId: deck.id })) });

  for (const c of COSMETICS) {
    const existing = await prisma.cosmetic.findFirst({ where: { name: c.name, structureDeckId: deck.id } });
    const values = { ...c, effect: "effect" in c ? c.effect : null, priceGold: null, priceCash: null, active: true, structureDeckId: deck.id };
    if (existing) await prisma.cosmetic.update({ where: { id: existing.id }, data: values });
    else await prisma.cosmetic.create({ data: values });
  }

  console.log(`✓ ${NAME}: ${mainTotal} no Main, ${extraTotal} no Extra, ${COSMETICS.length} cosméticos (Premium).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
