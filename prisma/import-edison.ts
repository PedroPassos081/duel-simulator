/**
 * Traz para o jogo o pool do formato Edison (YGOPRODeck, format=edison) e as
 * cartas do lançamento "Aesir vs os Cavaleiros da Constelação".
 *
 *   npx tsx --env-file=.env prisma/import-edison.ts            (só mostra o que vai fazer)
 *   npx tsx --env-file=.env prisma/import-edison.ts --apply    (grava)
 *
 * - Cartas novas entram com preço da categoria (src/lib/card-prices.ts).
 * - Blackwing, Frog, Lightsworn e Elemental HERO Absolute Zero ficam NÃO LANÇADAS
 *   (existem, mas ficam fora da loja até o Admin lançar na aba Lançamentos).
 * - As cartas do lançamento ficam não lançadas e presas ao lançamento programado.
 * - Cartas do Edison com data depois do fim do pool viram "extras" da Obelisco,
 *   e as do lançamento também (a Obelisco aceita XYZ e adições).
 * Pode rodar de novo: não duplica nada e não mexe em preço manual.
 */
import { PrismaClient } from "@prisma/client";
import { listingFor } from "../src/lib/card-prices";
import { getShopPricing } from "../src/lib/site-settings";
import { HIDDEN_CARD_NAMES, siteAddedAtForNewCard } from "../src/lib/site";

const prisma = new PrismaClient();
const API = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

// Arquétipos e cartas que ficam bloqueados no lançamento do jogo
const BLOCKED_ARCHETYPES = ["Blackwing", "Frog", "Lightsworn"];
const BLOCKED_NAMES = ["Elemental HERO Absolute Zero", "T.A.D.P.O.L.E."];

const RELEASE_NAME = "Aesir vs os Cavaleiros da Constelação";
const RELEASE_DESCRIPTION = "Os deuses nórdicos descem para enfrentar os Cavaleiros da Constelação: chegam os Aesir, as Bestas e os Alfar nórdicos, e os Constellar com seus XYZ.";
const RELEASE_CARDS = [
  // Constellar
  "Constellar Algiedi", "Constellar Kaus", "Constellar Pollux", "Constellar Siat", "Constellar Sombre",
  "Constellar Acubens", "Constellar Leonis", "Constellar Aldebaran", "Constellar Hyades", "Constellar Praesepe",
  "Constellar Star Cradle", "Constellar Meteor", "Constellar Omega", "Constellar Star Chart",
  // Nórdicos
  "Guldfaxe of the Nordic Beasts", "Tanngnjostr of the Nordic Beasts", "Tanngrisnir of the Nordic Beasts",
  "Valkyrie of the Nordic Ascendant", "Garmr of the Nordic Beasts", "Dverg of the Nordic Alfar",
  "Ljosalf of the Nordic Alfar", "Svartalf of the Nordic Alfar", "Thor, Lord of the Aesir", "Odin, Father of the Aesir",
  "Loki, Lord of the Aesir", "Gleipnir, the Fetters of Fenrir", "Nordic Relic Megingjord", "Nordic Relic Gungnir",
  "Nordic Relic Brisingamen",
];

type ApiCard = {
  id: number;
  name: string;
  type: string;
  race?: string;
  attribute?: string;
  archetype?: string;
  atk?: number;
  def?: number;
  level?: number;
  desc?: string;
  card_images?: { image_url?: string }[];
  misc_info?: { tcg_date?: string }[];
};

async function fetchCards(query: string, optional = false): Promise<ApiCard[]> {
  const res = await fetch(`${API}?${query}`);
  if (!res.ok) {
    if (optional) return [];
    throw new Error(`YGOPRODeck respondeu ${res.status} para ${query}`);
  }
  return ((await res.json()) as { data?: ApiCard[] }).data ?? [];
}

const isBlocked = (c: ApiCard) =>
  BLOCKED_NAMES.includes(c.name) || BLOCKED_ARCHETYPES.some((a) => c.archetype === a || c.name.includes(a));

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("Buscando o pool do Edison e as cartas do lançamento...");
  const [edison, edisonPt, releaseCards] = await Promise.all([
    fetchCards("format=edison&misc=yes"),
    fetchCards("format=edison&language=pt", true),
    fetchCards(`misc=yes&name=${encodeURIComponent(RELEASE_CARDS.join("|"))}`),
  ]);
  const missing = RELEASE_CARDS.filter((n) => !releaseCards.some((c) => c.name === n));
  if (missing.length) throw new Error(`Não encontrei na YGOPRODeck: ${missing.join(", ")}`);
  const releasePtById = await fetchCards(`language=pt&id=${releaseCards.map((c) => c.id).join(",")}`, true);

  const ptById = new Map([...edisonPt, ...releasePtById].map((c) => [c.id, c.desc ?? ""]));
  // Sem mecânicas modernas nem fichas
  const usable = (c: ApiCard) => !/pendulum|link|token/i.test(c.type);
  const pool = edison.filter(usable);
  const releaseIds = new Set(releaseCards.map((c) => c.id));
  const all = [...pool.filter((c) => !releaseIds.has(c.id)), ...releaseCards];

  const existing = new Set((await prisma.card.findMany({ select: { id: true } })).map((c) => c.id));
  const obelisk = await prisma.banlist.findUniqueOrThrow({ where: { id: "obelisk" } });
  const poolUntil = obelisk.poolUntil ?? new Date("2010-04-01T03:00:00Z");
  const date = (c: ApiCard) => (c.misc_info?.[0]?.tcg_date ? new Date(c.misc_info[0].tcg_date) : null);

  const newCards = all.filter((c) => !existing.has(c.id));
  const blocked = all.filter(isBlocked);
  // Cartas já no jogo antes (ex.: Blackwings de teste) também ficam bloqueadas
  const blockedExisting = await prisma.card.findMany({
    where: {
      released: true,
      OR: [{ name: { in: BLOCKED_NAMES } }, ...BLOCKED_ARCHETYPES.map((a) => ({ name: { contains: a } }))],
    },
    select: { id: true, name: true },
  });
  const lateEdison = pool.filter((c) => (date(c) ?? new Date(0)) >= poolUntil);

  console.log(`Pool Edison: ${pool.length} cartas · lançamento: ${releaseCards.length}`);
  console.log(`Novas no jogo: ${newCards.length}`);
  console.log(`Bloqueadas (não lançadas): ${blocked.length} do pool/lançamento + nomes já existentes: ${blockedExisting.map((c) => c.name).join(", ") || "nenhum"}`);
  console.log(`Extras da Obelisco (depois de ${poolUntil.toISOString().slice(0, 10)}): ${lateEdison.map((c) => c.name).join(", ")} + ${releaseCards.length} do lançamento`);
  if (!apply) return console.log("\nNada foi gravado. Rode com --apply para gravar.");

  const { tiers } = await getShopPricing();
  const manualPrice = new Set((await prisma.shopListing.findMany({ where: { customPrice: true }, select: { cardId: true } })).map((l) => l.cardId));

  let release = await prisma.cardRelease.findFirst({ where: { name: RELEASE_NAME } });
  if (!release) release = await prisma.cardRelease.create({ data: { name: RELEASE_NAME, description: RELEASE_DESCRIPTION } });

  // Em lotes: o banco é remoto e uma carta por vez levaria horas
  const toData = (api: ApiCard) => ({
    id: api.id,
    name: api.name,
    type: api.type,
    race: api.race || null,
    attribute: api.attribute || null,
    atk: typeof api.atk === "number" ? api.atk : null,
    def: typeof api.def === "number" ? api.def : null,
    level: typeof api.level === "number" ? api.level : null,
    description: ptById.get(api.id) || api.desc || "",
    imageUrl: api.card_images?.[0]?.image_url || null,
    releaseDate: date(api),
  });
  const hold = (api: ApiCard) => releaseIds.has(api.id) || isBlocked(api);
  const siteAddedAt = siteAddedAtForNewCard();
  const chunks = <T,>(list: T[], size = 400) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

  for (const part of chunks(newCards)) {
    await prisma.card.createMany({
      data: part.map((api) => ({ ...toData(api), siteAddedAt, released: !hold(api), releaseId: releaseIds.has(api.id) ? release!.id : null })),
      skipDuplicates: true,
    });
    await prisma.shopListing.createMany({
      data: part.map((api) => {
        const { priceGold, priceCash, maxTotal, maxGold, maxCash } = listingFor(toData(api), tiers);
        return { cardId: api.id, priceGold, priceCash, maxTotal, maxGold, maxCash, cashOnly: false, active: !HIDDEN_CARD_NAMES.includes(api.name) };
      }),
      skipDuplicates: true,
    });
    console.log(`  +${part.length} cartas`);
  }
  void manualPrice;

  // Cartas que já estavam no jogo e agora ficam bloqueadas ou no lançamento
  const heldExisting = all.filter((api) => existing.has(api.id) && hold(api));
  await prisma.card.updateMany({ where: { id: { in: heldExisting.filter((a) => !releaseIds.has(a.id)).map((a) => a.id) } }, data: { released: false } });
  await prisma.card.updateMany({ where: { id: { in: heldExisting.filter((a) => releaseIds.has(a.id)).map((a) => a.id) } }, data: { released: false, releaseId: release.id } });
  const done = all.length;
  await prisma.card.updateMany({ where: { id: { in: blockedExisting.map((c) => c.id) } }, data: { released: false } });
  await prisma.banlistExtraCard.createMany({
    data: [...lateEdison, ...releaseCards].map((c) => ({ format: "obelisk", cardId: c.id })),
    skipDuplicates: true,
  });
  console.log(`\nPronto: ${done} cartas processadas, ${newCards.length} novas. Lançamento "${RELEASE_NAME}" com ${releaseCards.length} cartas.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
