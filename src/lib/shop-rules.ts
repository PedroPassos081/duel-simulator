// Regras de compra da loja, compartilhadas entre servidor (validação) e UI (avisos).

// Nome provisório da moeda roxa (campo `cash` no banco). Trocar aqui quando o nome for decidido.
export const CREDIT_LABEL = "Crédito";
export const CREDIT_LABEL_PLURAL = "Créditos";

// Por padrão só as 2 primeiras cópias podem ser compradas em gold; a 3ª é sempre em crédito.
export const DEFAULT_MAX_GOLD_COPIES = 2;

export interface ListingLimits {
  maxTotal: number;
  maxGold: number;
  cashOnly: boolean;
}

/** Quantas cópias (as primeiras) desta carta podem ser compradas com gold. */
export function goldCopyLimit(listing: ListingLimits) {
  if (listing.cashOnly) return 0;
  return Math.min(listing.maxGold, listing.maxTotal);
}

/** A próxima cópia (ownedQuantity + 1) pode ser comprada com gold? */
export function canBuyNextWithGold(listing: ListingLimits, ownedQuantity: number) {
  return ownedQuantity < goldCopyLimit(listing) && ownedQuantity < listing.maxTotal;
}

/** Texto curto do aviso de limite de gold exibido na carta. */
export function goldLimitNotice(listing: ListingLimits) {
  const limit = goldCopyLimit(listing);
  if (limit === 0) return `Somente ${CREDIT_LABEL.toLowerCase()}`;
  if (limit >= listing.maxTotal) return null;
  if (limit === 1) return `A partir da 2ª cópia: só ${CREDIT_LABEL.toLowerCase()}`;
  return `A partir da ${limit + 1}ª cópia: só ${CREDIT_LABEL.toLowerCase()}`;
}
