import { prisma } from "@/lib/prisma";

// Pool de cartas de cada banlist: quais cartas EXISTEM nela.
// Slifer: lançadas no TCG até 2006 (Tag Force 1) + adições fora de data.
// Obelisco: pool do Edison + XYZ e adições (BanlistExtraCard).

export interface CardPool {
  format: string;
  poolUntil: Date | null;
  extras: Set<number>;
}

type PoolCard = { id: number; releaseDate: Date | string | null };

/** A carta existe nesta banlist? (sem data de corte, vale tudo) */
export function isInPool(card: PoolCard, pool: CardPool) {
  if (!pool.poolUntil || pool.extras.has(card.id)) return true;
  if (!card.releaseDate) return true;
  return new Date(card.releaseDate) < pool.poolUntil;
}

export async function getPools(formats: string[]): Promise<Map<string, CardPool>> {
  const [lists, extras] = await Promise.all([
    prisma.banlist.findMany({ where: { id: { in: formats } }, select: { id: true, poolUntil: true } }),
    prisma.banlistExtraCard.findMany({ where: { format: { in: formats } }, select: { format: true, cardId: true } }),
  ]);
  return new Map(
    formats.map((format) => [
      format,
      {
        format,
        poolUntil: lists.find((l) => l.id === format)?.poolUntil ?? null,
        extras: new Set(extras.filter((e) => e.format === format).map((e) => e.cardId)),
      },
    ])
  );
}

export async function getPool(format: string) {
  return (await getPools([format])).get(format)!;
}
