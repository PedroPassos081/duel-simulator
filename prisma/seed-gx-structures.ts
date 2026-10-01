import { PrismaClient } from "@prisma/client";

// Structure Decks da era GX: "Dragão Arco-Íris" (Bestas de Cristal do Jesse) e
// "Roid do Syrus" (Vehicroids), no mesmo modelo do Chama Alada: edição Base e
// Premium (sleeve, tapete e moldura exclusivos + itens), mesmos preços, e as
// cartas principais com raridade (3 Secretas + 1 Rara, como no Chama Alada).
// Idempotente: pode rodar de novo para ajustar cartas, preços ou textos.
//   npm run prisma:seed-gx
const prisma = new PrismaClient();

const cropped = (id: number) => `https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg`;

type Entry = [cardId: number, quantity: number, name: string];
type Finish = "rara" | "ultra" | "secreta";

interface DeckSeed {
  name: string;
  description: string;
  coverCardId: number;
  main: Entry[];
  extra: Entry[];
  finish: Record<number, Finish>;
  cosmetics: { type: string; name: string; description: string; imageUrl: string; effect?: string; rarity: string }[];
}

const DECKS: DeckSeed[] = [
  {
    name: "Crystal Beast: Dragão Arco-Íris",
    description:
      "As sete Bestas de Cristal do Jesse: jogue as gemas, encha a zona de Magia/Armadilha e invoque o lendário Rainbow Dragon. Válido na Sala Obelisco (as Bestas de Cristal são de 2007). A edição Premium acompanha sleeve, tapete e moldura exclusivos.",
    coverCardId: 79856792, // Rainbow Dragon
    main: [
      // Monstros (21)
      [32710364, 3, "Crystal Beast Ruby Carbuncle"],
      [32933942, 2, "Crystal Beast Amethyst Cat"],
      [68215963, 2, "Crystal Beast Emerald Tortoise"],
      [95600067, 2, "Crystal Beast Topaz Tiger"],
      [69937550, 2, "Crystal Beast Amber Mammoth"],
      [21698716, 2, "Crystal Beast Cobalt Eagle"],
      [7093411, 3, "Crystal Beast Sapphire Pegasus"],
      [82099401, 2, "Crystal Seer"],
      [79856792, 3, "Rainbow Dragon"],
      // Magias (12)
      [35486099, 2, "Crystal Blessing"],
      [72881007, 1, "Crystal Abundance"],
      [8275702, 2, "Crystal Promise"],
      [95326659, 2, "Crystal Beacon"],
      [60876124, 1, "Rare Value"],
      [34487429, 2, "Ancient City - Rainbow Ruins"],
      [10004783, 1, "Crystal Release"],
      [47408488, 1, "Crystal Tree"],
      // Armadilhas (7)
      [96331676, 2, "Crystal Raigeki"],
      [47121070, 2, "Crystal Pair"],
      [7617253, 1, "Rainbow Path"],
      [34002992, 1, "Rainbow Life"],
      [63806265, 1, "Rainbow Gravity"],
    ],
    // O Rainbow Neos: a fusão do encontro do Jaden com o Jesse
    extra: [[86346643, 1, "Rainbow Neos"]],
    finish: {
      79856792: "secreta", // Rainbow Dragon x3
      86346643: "rara", // Rainbow Neos
    },
    cosmetics: [
      {
        type: "sleeve",
        name: "Sleeve Dragão Arco-Íris",
        description: "O Rainbow Dragon abrindo as asas de cristal.",
        imageUrl: cropped(79856792), // Rainbow Dragon
        rarity: "epic",
      },
      {
        type: "playmat",
        name: "Tapete Cidade Arco-Íris",
        description: "As ruínas da Cidade Arco-Íris, onde as sete gemas brilham juntas.",
        imageUrl: cropped(34487429), // Ancient City - Rainbow Ruins (arte diferente da sleeve)
        effect: "arcoiris",
        rarity: "legendary",
      },
      {
        type: "frame",
        name: "Moldura Sete Cristais",
        description: "Anel de arco-íris com as sete gemas das Bestas de Cristal.",
        imageUrl: "/assets/frames/rainbow-dragon.svg",
        rarity: "epic",
      },
    ],
  },
  {
    name: "Vehicroid: Roid do Syrus",
    description:
      "Os veículos do Syrus: Steamroid, Drillroid, Power Bond e as fusões Vehicroid, com o gigante Super Vehicroid Jumbo Drill. Só cartas até 2006: vale na Sala Slifer e na Obelisco. A edição Premium acompanha sleeve, tapete e moldura exclusivos.",
    coverCardId: 36256625, // Super Vehicroid Jumbo Drill
    main: [
      // Monstros (23)
      [44729197, 3, "Steamroid"],
      [71218746, 3, "Drillroid"],
      [18325492, 2, "Gyroid"],
      [99861526, 2, "Submarineroid"],
      [71930383, 2, "Patroid"],
      [45945685, 2, "Cycroid"],
      [43697559, 2, "Jetroid"],
      [24311595, 2, "Rescueroid"],
      [36378213, 2, "Ambulanceroid"],
      [7602840, 2, "UFOroid"],
      [25034083, 1, "Decoyroid"],
      // Magias (12)
      [24094653, 3, "Polymerization"],
      [37630732, 2, "Power Bond"],
      [23299957, 2, "Vehicroid Connection Zone"],
      [18511384, 2, "Fusion Recovery"],
      [95286165, 1, "De-Fusion"],
      [53046408, 1, "Emergency Provisions"],
      [23171610, 1, "Limiter Removal"],
      // Armadilhas (5)
      [97705809, 3, "Supercharge"],
      [97077563, 1, "Call of the Haunted"],
      [56120475, 1, "Sakuretsu Armor"],
    ],
    extra: [
      [36256625, 3, "Super Vehicroid Jumbo Drill"],
      [98927491, 1, "Ambulance Rescueroid"],
      [5368615, 2, "Steam Gyroid"],
      [32752319, 2, "UFOroid Fighter"],
    ],
    finish: {
      36256625: "secreta", // Super Vehicroid Jumbo Drill x3
      98927491: "rara", // Ambulance Rescueroid
    },
    cosmetics: [
      {
        type: "sleeve",
        name: "Sleeve Steamroid",
        description: "O Steamroid, a locomotiva sorridente do Syrus, a todo vapor.",
        imageUrl: cropped(44729197), // Steamroid
        rarity: "epic",
      },
      {
        type: "playmat",
        name: "Tapete Zona de Conexão",
        description: "A oficina onde os Vehicroids se unem: engrenagens, trilhos e muito aço.",
        imageUrl: cropped(23299957), // Vehicroid Connection Zone (arte diferente da sleeve)
        effect: "roid",
        rarity: "legendary",
      },
      {
        type: "frame",
        name: "Moldura Engrenagem Roid",
        description: "Engrenagem de aço azul com rodas e parafusos dourados.",
        imageUrl: "/assets/frames/vehicroid.svg",
        rarity: "epic",
      },
    ],
  },
];

// Mesmos preços e itens do Chama Alada
const PRICES = {
  priceGold: 6000,
  priceCash: 250,
  premiumPriceGold: 9000,
  premiumPriceCash: 400,
  moneyPriceCents: 3990,
  premiumMoneyPriceCents: 6990,
  moneyDiscountPercent: 25, // dinheiro: cheio riscado e 25% off
  discountPercent: 30, // gold + crédito: 30% sobre as cartas avulsas
  premiumItems: [
    { item: "po_milenio_raro", quantity: 2 },
    { item: "moldura_prata", quantity: 1 },
  ],
};

async function seedDeck(d: DeckSeed) {
  const mainTotal = d.main.reduce((n, [, q]) => n + q, 0);
  const extraTotal = d.extra.reduce((n, [, q]) => n + q, 0);
  if (mainTotal !== 40) throw new Error(`${d.name}: o Main Deck precisa ter 40 cartas, mas tem ${mainTotal}.`);
  if (extraTotal > 15) throw new Error(`${d.name}: o Extra Deck passa de 15 cartas (${extraTotal}).`);

  const cards = [
    ...d.main.map(([cardId, quantity]) => ({ cardId, section: "main", quantity, finish: d.finish[cardId] ?? "normal" })),
    ...d.extra.map(([cardId, quantity]) => ({ cardId, section: "extra", quantity, finish: d.finish[cardId] ?? "normal" })),
  ];
  const found = await prisma.card.findMany({ where: { id: { in: cards.map((c) => c.cardId) } }, select: { id: true, released: true, name: true } });
  const missing = cards.filter((c) => !found.some((f) => f.id === c.cardId));
  if (missing.length) throw new Error(`${d.name}: cartas ausentes no catálogo: ${missing.map((m) => m.cardId).join(", ")}.`);
  const blocked = found.filter((f) => !f.released);
  if (blocked.length) throw new Error(`${d.name}: cartas ainda não lançadas: ${blocked.map((b) => b.name).join(", ")}.`);

  const data = { description: d.description, coverCardId: d.coverCardId, ...PRICES, active: true };
  const deck = await prisma.structureDeck.upsert({ where: { name: d.name }, update: data, create: { name: d.name, ...data } });

  await prisma.structureDeckCard.deleteMany({ where: { structureDeckId: deck.id } });
  await prisma.structureDeckCard.createMany({ data: cards.map((c) => ({ ...c, structureDeckId: deck.id })) });

  for (const c of d.cosmetics) {
    const existing = await prisma.cosmetic.findFirst({ where: { name: c.name, structureDeckId: deck.id } });
    const values = { ...c, effect: c.effect ?? null, priceGold: null, priceCash: null, active: true, structureDeckId: deck.id };
    if (existing) await prisma.cosmetic.update({ where: { id: existing.id }, data: values });
    else await prisma.cosmetic.create({ data: values });
  }
  console.log(`✓ ${d.name}: ${mainTotal} no Main, ${extraTotal} no Extra, ${d.cosmetics.length} cosméticos (Premium).`);
}

async function main() {
  // Nenhuma arte de sleeve/tapete repetida entre os Structure Decks
  const arts = DECKS.flatMap((d) => d.cosmetics.filter((c) => c.type !== "frame").map((c) => c.imageUrl));
  const existingArts = await prisma.cosmetic.findMany({ where: { type: { in: ["sleeve", "playmat"] }, structureDeckId: { not: null }, name: { notIn: DECKS.flatMap((d) => d.cosmetics.map((c) => c.name)) } }, select: { imageUrl: true, name: true } });
  const repeated = arts.filter((a, i) => arts.indexOf(a) !== i || existingArts.some((e) => e.imageUrl === a));
  if (repeated.length) throw new Error(`Arte repetida: ${repeated.join(", ")}`);

  for (const d of DECKS) await seedDeck(d);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
