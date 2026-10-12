import { PrismaClient } from "@prisma/client";

// Passe de Batalha · modelo base (Temporada 1): Dark Magician x Blue-Eyes, para a Sala Slifer
// (só cartas até 2006, respeitando a banlist da Slifer).
// - Grátis: um set do Dark Magician incompleto, a Dark Magician Girl Rara, 1 Moldura Prata,
//   7.000 de gold e 50 de crédito; o último prêmio é um Dark Magician Secreta.
// - Premium: o set do Blue-Eyes completo (3 Blue-Eyes Secreta + o Ultimate de 3 cabeças) e o que
//   falta do Dark Magician (2 Dark Magician Secreta), 2 Molduras Prata + 1 Dourada, Pó do Milênio
//   (1 Secret, 1 Ultra, 2 Raro), 15.000 de gold, 100 de crédito, 2 nicks, 2 molduras de perfil e a
//   escolha de 1 playmat e 1 sleeve (entre 3 de cada).
// Os playmats e sleeves também vão para a vitrine da loja: trancados por 2 meses, 150 de crédito
// (o Admin muda na aba Passe).
// Idempotente: roda de novo para ajustar (não mexe no progresso dos jogadores).
//   npm run prisma:seed-pass
const prisma = new PrismaClient();

const NAME = "Temporada 1 · O Despertar do Faraó";
const cropped = (id: number) => `https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg`;
const split = (a: number, b: number) => `split:${cropped(a)}|${cropped(b)}`;
const SHOP_PRICE = 150;
const SHOP_UNLOCK = new Date(Date.now() + 61 * 86_400_000); // ~2 meses

// Cosméticos (nenhuma arte repetida)
const COSMETICS = {
  sleeveDM: { type: "sleeve", name: "Sleeve Dark Magician", description: "O Mago Negro com o cetro em punho.", imageUrl: cropped(46986415), rarity: "epic" },
  sleeveBE: { type: "sleeve", name: "Sleeve Blue-Eyes", description: "O Blue-Eyes White Dragon carregando o Raio da Destruição.", imageUrl: cropped(89631142), rarity: "epic" },
  sleeveVS: { type: "sleeve", name: "Sleeve Dark Magician vs Blue-Eyes", description: "O duelo eterno: o Mago Negro de um lado, o Dragão Branco do outro.", imageUrl: split(46986418, 89631147), rarity: "legendary" },
  playmatDM: { type: "playmat", name: "Tapete Dark Magician", description: "A magia negra do servo do Faraó cobrindo o campo.", imageUrl: cropped(46986420), effect: "darkmagician", rarity: "epic" },
  playmatBE: { type: "playmat", name: "Tapete Blue-Eyes", description: "O Blue-Eyes abrindo as asas sobre o campo.", imageUrl: cropped(89631145), effect: "blueeyes", rarity: "epic" },
  playmatVS: { type: "playmat", name: "Tapete Dark Magician vs Blue-Eyes", description: "Yugi contra Kaiba no seu campo de duelo.", imageUrl: split(46986421, 89631144), effect: "versus", rarity: "legendary" },
  frameBE: { type: "frame", name: "Moldura Blue-Eyes", description: "Anel de gelo com as asas e o olho do Dragão Branco.", imageUrl: "/assets/frames/blue-eyes.svg", rarity: "epic" },
  frameVS: { type: "frame", name: "Moldura Dark Magician vs Blue-Eyes", description: "Metade magia negra, metade dragão branco.", imageUrl: "/assets/frames/dark-magician-blue-eyes.svg", rarity: "legendary" },
  nickDM: { type: "name_style", name: "Nick Dark Magician", description: "Seu nome em roxo e magenta, com brilho de magia negra.", imageUrl: null, effect: "darkmagician", rarity: "epic" },
  nickBE: { type: "name_style", name: "Nick Blue-Eyes", description: "Seu nome em azul-gelo, com o brilho do Dragão Branco.", imageUrl: null, effect: "blueeyes", rarity: "epic" },
} as const;
type CosmeticKey = keyof typeof COSMETICS;
const SHOP_KEYS: CosmeticKey[] = ["sleeveDM", "sleeveBE", "sleeveVS", "playmatDM", "playmatBE", "playmatVS"];
// Cosméticos da versão anterior da temporada (saem de circulação)
const RETIRED = ["Sleeve Mago do Faraó", "Sleeve Kuriboh", "Tapete Templo dos Reis", "Moldura Olho do Milênio", "Nick Faraó"];

type Reward =
  | { kind: "currency"; currency: "gold" | "cash"; amount: number }
  | { kind: "card"; cardId: number; quantity: number; variant: { finish: string; border: string } }
  | { kind: "cosmetic"; cosmeticId: string }
  | { kind: "choice_cosmetic"; options: string[] }
  | { kind: "item"; itemKey: string; quantity: number };

const gold = (amount: number): Reward => ({ kind: "currency", currency: "gold", amount });
const credit = (amount: number): Reward => ({ kind: "currency", currency: "cash", amount });
const item = (itemKey: string, quantity = 1): Reward => ({ kind: "item", itemKey, quantity });
const card = (cardId: number, finish = "normal"): Reward => ({ kind: "card", cardId, quantity: 1, variant: { finish, border: "none" } });

// Cartas (todas da Sala Slifer: lançadas até 2006)
const C = {
  darkMagician: 46986414,
  darkMagicianGirl: 38033121,
  valkyria: 80304126,
  skilled: 73752131,
  apprentice: 9156135,
  oldVindictive: 45141844,
  mysticalElf: 15025844,
  breaker: 71413901,
  gemini: 69140098,
  library: 70791313,
  chaosCommand: 72630549,
  mandragola: 7802006,
  sorcerer: 88619463,
  kycoo: 88240808,
  bookOfSecretArts: 91595718,
  sagesStone: 13604200,
  magePower: 83746708,
  thousandKnives: 63391643,
  magicalDimension: 28553439,
  diffusion: 87880531,
  spellAbsorption: 51481927,
  magicalHats: 81210420,
  mirrorWall: 22359980,
  negateAttack: 14315573,
  magiciansCircle: 50755,
  trapHole: 4206964,
  dustTornado: 60082869,
  darkMagicAttack: 2314238,
  knightsTitle: 87210505,
  darkMagicianKnight: 50725996,
  darkPaladin: 98502113,
  busterBlader: 78193831,
  swords: 72302403,
  magicCylinder: 62279055,
  blueEyes: 89631139,
  ultimate: 23995346,
  lordOfD: 17985575,
  flute: 43973174,
  polymerization: 24094653,
  paladin: 73398797,
  whiteDragonRitual: 9786492,
  shining: 53347303,
  burstStream: 17655904,
  kaiserGlider: 52824910,
  luster: 11091375,
  luster2: 17658803,
  masked: 39191307,
  stamping: 81385346,
};

async function main() {
  // Cosméticos do passe (+ vitrine da loja para playmats e sleeves)
  const ids = {} as Record<CosmeticKey, string>;
  for (const [key, c] of Object.entries(COSMETICS) as [CosmeticKey, (typeof COSMETICS)[CosmeticKey]][]) {
    const inShopSlot = SHOP_KEYS.includes(key);
    const existing = await prisma.cosmetic.findFirst({ where: { name: c.name, structureDeckId: null } });
    const data = {
      ...c,
      effect: "effect" in c ? c.effect : null,
      priceGold: null,
      priceCash: inShopSlot ? (existing?.priceCash ?? SHOP_PRICE) : null,
      active: true,
      ...(inShopSlot && !existing ? { inShop: true, shopUnlockAt: SHOP_UNLOCK } : {}),
    };
    ids[key] = existing ? (await prisma.cosmetic.update({ where: { id: existing.id }, data })).id : (await prisma.cosmetic.create({ data })).id;
  }
  await prisma.cosmetic.updateMany({ where: { name: { in: RETIRED }, structureDeckId: null }, data: { active: false } });

  const data = {
    description:
      "Dark Magician contra Blue-Eyes, para a Sala Slifer! A trilha grátis monta o deck do Mago Negro; a Premium completa o Blue-Eyes (com 3 Secretas e o Ultimate de 3 cabeças), fecha o Dark Magician e traz nicks, molduras e o seu playmat e sleeve à escolha.",
    artCardId: 10000010, // The Winged Dragon of Ra
    endsAt: new Date("2026-11-01T03:00:00Z"),
    levels: 50,
    xpPerLevel: 500,
    xpWin: 100,
    xpLoss: 40,
    premiumPriceCash: 300,
    active: true,
  };
  const existing = await prisma.battlePass.findFirst({ where: { name: NAME } });
  const pass = existing ? await prisma.battlePass.update({ where: { id: existing.id }, data }) : await prisma.battlePass.create({ data: { name: NAME, startsAt: new Date(), ...data } });

  // GRÁTIS: 7.000 gold (14 x 500), 50 crédito (2 x 25), Moldura Prata, DMG Rara e o set do DM incompleto
  const FREE: Record<number, Reward> = {
    1: card(C.mysticalElf), 2: gold(500), 3: card(C.oldVindictive), 4: gold(500), 5: card(C.apprentice),
    6: card(C.bookOfSecretArts), 7: gold(500), 8: card(C.gemini), 9: gold(500), 10: card(C.skilled),
    11: card(C.sagesStone), 12: gold(500), 13: card(C.mysticalElf), 14: gold(500), 15: card(C.magicalHats),
    16: card(C.apprentice), 17: gold(500), 18: card(C.valkyria), 19: gold(500), 20: card(C.thousandKnives),
    21: credit(25), 22: card(C.library), 23: gold(500), 24: card(C.magePower), 25: card(C.darkMagicianGirl, "rara"),
    26: card(C.mandragola), 27: gold(500), 28: card(C.oldVindictive), 29: card(C.mirrorWall), 30: item("moldura_prata"),
    31: card(C.negateAttack), 32: gold(500), 33: card(C.magiciansCircle), 34: card(C.sorcerer), 35: card(C.skilled),
    36: card(C.chaosCommand), 37: gold(500), 38: card(C.diffusion), 39: card(C.kycoo), 40: card(C.magicalDimension),
    41: credit(25), 42: gold(500), 43: card(C.spellAbsorption), 44: card(C.trapHole), 45: card(C.sagesStone),
    46: card(C.dustTornado), 47: gold(500), 48: card(C.breaker), 49: card(C.magiciansCircle), 50: card(C.darkMagician, "secreta"),
  };

  // PREMIUM: 15.000 gold (6 x 2.500), 100 crédito (2 x 50), molduras, Pó, 5 Secretas, cosméticos e o resto dos sets
  const PREMIUM: Record<number, Reward> = {
    1: { kind: "choice_cosmetic", options: [ids.sleeveDM, ids.sleeveBE, ids.sleeveVS] },
    2: card(C.lordOfD), 3: card(C.flute), 4: gold(2500), 5: card(C.polymerization),
    6: item("po_milenio_raro"), 7: card(C.luster), 8: card(C.valkyria), 9: item("moldura_prata"), 10: card(C.blueEyes, "secreta"),
    11: card(C.lordOfD), 12: gold(2500), 13: { kind: "cosmetic", cosmeticId: ids.nickDM }, 14: card(C.paladin), 15: credit(50),
    16: card(C.whiteDragonRitual), 17: { kind: "cosmetic", cosmeticId: ids.frameBE }, 18: card(C.darkMagicAttack), 19: gold(2500), 20: card(C.darkMagician, "secreta"),
    21: card(C.flute), 22: item("po_milenio_raro"), 23: card(C.kaiserGlider),
    24: { kind: "choice_cosmetic", options: [ids.playmatDM, ids.playmatBE, ids.playmatVS] },
    25: card(C.knightsTitle), 26: { kind: "cosmetic", cosmeticId: ids.nickBE }, 27: gold(2500), 28: card(C.darkMagicianKnight), 29: item("moldura_prata"), 30: card(C.blueEyes, "secreta"),
    31: card(C.burstStream), 32: item("po_milenio_ultra"), 33: card(C.polymerization), 34: gold(2500), 35: credit(50),
    36: card(C.swords), 37: card(C.busterBlader), 38: { kind: "cosmetic", cosmeticId: ids.frameVS }, 39: card(C.shining), 40: card(C.blueEyes, "secreta"),
    41: card(C.magicCylinder), 42: gold(2500), 43: card(C.darkPaladin), 44: item("moldura_dourada"), 45: card(C.ultimate, "ultra"),
    46: card(C.masked), 47: item("po_milenio_secret"), 48: card(C.stamping), 49: card(C.luster2), 50: card(C.darkMagician, "secreta"),
  };

  // Confere as contas pedidas antes de gravar
  const sum = (track: Record<number, Reward>, currency: "gold" | "cash") =>
    Object.values(track).reduce((n, r) => n + (r.kind === "currency" && r.currency === currency ? r.amount : 0), 0);
  const secrets = Object.values(PREMIUM).filter((r) => r.kind === "card" && r.variant.finish === "secreta").length;
  if (Object.keys(FREE).length !== 50 || Object.keys(PREMIUM).length !== 50) throw new Error("Precisa de 50 prêmios em cada trilha.");
  if (sum(FREE, "gold") !== 7000 || sum(FREE, "cash") !== 50) throw new Error("Grátis: 7.000 gold e 50 crédito.");
  if (sum(PREMIUM, "gold") !== 15000 || sum(PREMIUM, "cash") !== 100) throw new Error("Premium: 15.000 gold e 100 crédito.");
  if (secrets !== 5) throw new Error(`Premium: 5 Secretas (tem ${secrets}).`);

  const cardIds = [...Object.values(FREE), ...Object.values(PREMIUM)].flatMap((r) => (r.kind === "card" ? [r.cardId] : []));
  const found = await prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, released: true, releaseDate: true, name: true } });
  const bad = cardIds.filter((id) => {
    const c = found.find((f) => f.id === id);
    return !c || !c.released || (c.releaseDate && c.releaseDate >= new Date("2007-01-01T03:00:00Z"));
  });
  if (bad.length) throw new Error(`Cartas fora da Slifer ou ausentes: ${[...new Set(bad)].join(", ")}`);

  for (let level = 1; level <= data.levels; level++) {
    for (const [track, reward] of [["free", FREE[level]], ["premium", PREMIUM[level]]] as const) {
      await prisma.battlePassReward.upsert({
        where: { passId_level_track: { passId: pass.id, level, track } },
        update: { reward },
        create: { passId: pass.id, level, track, reward },
      });
    }
  }
  console.log(`✓ ${NAME}: modelo Dark Magician x Blue-Eyes gravado (${Object.keys(COSMETICS).length} cosméticos; playmats e sleeves na vitrine, trancados até ${SHOP_UNLOCK.toLocaleDateString("pt-BR")}).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
