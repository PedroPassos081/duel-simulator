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
  banlistEntries?: { status: string }[];
}

export type DeckSection = "main" | "extra" | "side";

export interface DeckCardUI {
  card: Card;
  section: DeckSection;
  quantity: number;
}
