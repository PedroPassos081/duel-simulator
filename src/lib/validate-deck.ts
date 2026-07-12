export type DeckSection = "main" | "extra" | "side";

export interface DeckCardEntry {
  cardId: number;
  section: DeckSection;
  quantity: number;
}

export interface BanlistInfo {
  cardId: number;
  status: "forbidden" | "limited" | "semi-limited" | "unlimited";
}

export interface OwnershipInfo {
  cardId: number;
  quantity: number;
}

export interface DeckIssue {
  level: "error" | "warning";
  message: string;
}

const MAX_COPIES_BY_STATUS: Record<BanlistInfo["status"], number> = {
  forbidden: 0,
  limited: 1,
  "semi-limited": 2,
  unlimited: 3,
};

// Ajuste esses números conforme a regra exata do formato Edison que for seguir.
const DECK_SIZE_RULES = {
  main: { min: 40, max: 60 },
  extra: { min: 0, max: 15 },
  side: { min: 0, max: 15 },
};

/**
 * Valida um deck contra:
 * - tamanho de cada seção
 * - limite de cópias por carta segundo a banlist do formato
 * - (opcional) posse de cartas do jogador — se ownerships for passado
 */
export function validateDeck(
  entries: DeckCardEntry[],
  banlist: BanlistInfo[],
  ownerships?: OwnershipInfo[]
): DeckIssue[] {
  const issues: DeckIssue[] = [];

  const banlistByCard = new Map(banlist.map((b) => [b.cardId, b.status]));
  const ownershipByCard = new Map(ownerships?.map((o) => [o.cardId, o.quantity]) ?? []);

  // tamanho por seção
  for (const section of ["main", "extra", "side"] as DeckSection[]) {
    const total = entries
      .filter((e) => e.section === section)
      .reduce((sum, e) => sum + e.quantity, 0);
    const rule = DECK_SIZE_RULES[section];
    if (total < rule.min || total > rule.max) {
      issues.push({
        level: "error",
        message: `Seção "${section}" tem ${total} cartas (permitido: ${rule.min}-${rule.max}).`,
      });
    }
  }

  // total de cópias por carta em TODO o deck (main + extra + side contam juntos para a banlist)
  const totalByCard = new Map<number, number>();
  for (const e of entries) {
    totalByCard.set(e.cardId, (totalByCard.get(e.cardId) ?? 0) + e.quantity);
  }

  for (const [cardId, total] of totalByCard) {
    const status = banlistByCard.get(cardId) ?? "unlimited";
    const maxAllowed = MAX_COPIES_BY_STATUS[status];
    if (total > maxAllowed) {
      issues.push({
        level: "error",
        message: `Carta ${cardId} está "${status}" no formato Edison (máx ${maxAllowed}), mas o deck tem ${total}.`,
      });
    }

    if (ownerships) {
      const owned = ownershipByCard.get(cardId) ?? 0;
      if (total > owned) {
        issues.push({
          level: "error",
          message: `Você possui ${owned} cópias da carta ${cardId}, mas o deck usa ${total}. Compre mais na loja.`,
        });
      }
    }
  }

  return issues;
}
