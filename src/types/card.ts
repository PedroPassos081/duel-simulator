export interface Card {
  id: number;
  name: string;
  type: string;
  race: string | null;
  attribute: string | null;
  atk: number | null;
  def: number | null;
  level: number | null;
  description: string;
  imageUrl: string | null;
  banlistEntries?: { format?: string; status: string }[]; // status nas salas (slifer, obelisk)
  rooms?: string[]; // salas em que a carta existe (pool); ausente = todas
  ownedQuantity?: number;
  maxTotal?: number; // limite de cópias da loja (vem de /api/cards)
  // Melhor versão que o jogador tem (Rara, Secreta... + borda), vinda de /api/cards
  bestVariant?: { finish: import("@/lib/card-finish").Finish; border: import("@/lib/card-finish").Border };
}

export type DeckSection = "main" | "extra" | "side";

export interface DeckCardUI {
  card: Card;
  section: DeckSection;
  quantity: number;
}
