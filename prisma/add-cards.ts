/**
 * Adiciona cartas ao jogo pelo nome (YGOPRODeck), como NÃO LANÇADAS e prontas
 * para lançar na aba Lançamentos do Admin. Opcionalmente libera no pool de uma sala.
 *
 *   npx tsx --env-file=.env prisma/add-cards.ts --room obelisk "Gear Gigant X" "Catapult Zone"
 *
 * Carta que já existe no jogo não muda (só entra no pool da sala, se pedido).
 */
import { PrismaClient } from "@prisma/client";
import { listingFor } from "../src/lib/card-prices";
import { getShopPricing } from "../src/lib/site-settings";
import { siteAddedAtForNewCard } from "../src/lib/site";

const prisma = new PrismaClient();
const API = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

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
  misc_info?: { tcg_date?: string }[];
};

async function fetchCards(query: string): Promise<ApiCard[]> {
  const res = await fetch(`${API}?${query}`);
  if (!res.ok) return [];
  return ((await res.json()) as { data?: ApiCard[] }).data ?? [];
}

async function main() {
  const args = process.argv.slice(2);
  const roomIndex = args.indexOf("--room");
  const room = roomIndex >= 0 ? args[roomIndex + 1] : null;
  const names = args.filter((_, i) => i !== roomIndex && i !== roomIndex + 1);
  if (names.length === 0) throw new Error('Informe os nomes das cartas, ex.: "Gear Gigant X"');
  if (room && !(await prisma.banlist.findUnique({ where: { id: room } }))) throw new Error(`Sala/banlist "${room}" não existe.`);

  const found = await fetchCards(`misc=yes&name=${encodeURIComponent(names.join("|"))}`);
  const missing = names.filter((n) => !found.some((c) => c.name.toLowerCase() === n.toLowerCase()));
  if (missing.length) throw new Error(`Não encontrei na YGOPRODeck (confira o nome em inglês): ${missing.join(", ")}`);
  const pt = new Map((await fetchCards(`language=pt&id=${found.map((c) => c.id).join(",")}`)).map((c) => [c.id, c.desc ?? ""]));
  const { tiers } = await getShopPricing();

  for (const api of found) {
    const data = {
      id: api.id,
      name: api.name,
      type: api.type,
      race: api.race || null,
      attribute: api.attribute || null,
      atk: typeof api.atk === "number" ? api.atk : null,
      def: typeof api.def === "number" ? api.def : null,
      level: typeof api.level === "number" ? api.level : null,
      description: pt.get(api.id) || api.desc || "",
      imageUrl: api.card_images?.[0]?.image_url || null,
      releaseDate: api.misc_info?.[0]?.tcg_date ? new Date(api.misc_info[0].tcg_date) : null,
    };
    const exists = await prisma.card.findUnique({ where: { id: api.id }, select: { released: true } });
    if (!exists) {
      await prisma.card.create({ data: { ...data, siteAddedAt: siteAddedAtForNewCard(), released: false } });
      const { priceGold, priceCash, maxTotal, maxGold, maxCash } = listingFor(data, tiers);
      await prisma.shopListing.create({ data: { cardId: api.id, priceGold, priceCash, maxTotal, maxGold, maxCash } });
    }
    if (room) await prisma.banlistExtraCard.createMany({ data: [{ format: room, cardId: api.id }], skipDuplicates: true });
    console.log(`${api.name}: ${exists ? "já existia" : "adicionada (não lançada)"}${room ? ` · no pool da ${room}` : ""}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
