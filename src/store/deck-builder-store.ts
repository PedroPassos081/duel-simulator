import { create } from "zustand";
import type { Card, DeckCardUI, DeckSection } from "@/types/card";

interface DeckBuilderState {
  deckName: string;
  main: DeckCardUI[];
  extra: DeckCardUI[];
  side: DeckCardUI[];
  setDeckName: (name: string) => void;
  addCard: (card: Card, section: DeckSection) => void;
  removeCard: (cardId: number, section: DeckSection) => void;
  loadFromEntries: (
    entries: { cardId: number; section: DeckSection; quantity: number }[],
    cardsById: Map<number, Card>
  ) => void;
  reset: () => void;
}

const MAX_COPIES_IN_DECK = 3;

function sectionKey(section: DeckSection): "main" | "extra" | "side" {
  return section;
}

export const useDeckBuilderStore = create<DeckBuilderState>((set, get) => ({
  deckName: "Novo Deck",
  main: [],
  extra: [],
  side: [],

  setDeckName: (name) => set({ deckName: name }),

  addCard: (card, section) => {
    const list = get()[sectionKey(section)];
    const existing = list.find((e) => e.card.id === card.id);

    if (existing) {
      if (existing.quantity >= MAX_COPIES_IN_DECK) return; // trava visual, backend valida de verdade
      set({
        [section]: list.map((e) =>
          e.card.id === card.id ? { ...e, quantity: e.quantity + 1 } : e
        ),
      } as Partial<DeckBuilderState>);
    } else {
      set({
        [section]: [...list, { card, section, quantity: 1 }],
      } as Partial<DeckBuilderState>);
    }
  },

  removeCard: (cardId, section) => {
    const list = get()[sectionKey(section)];
    const existing = list.find((e) => e.card.id === cardId);
    if (!existing) return;

    if (existing.quantity <= 1) {
      set({
        [section]: list.filter((e) => e.card.id !== cardId),
      } as Partial<DeckBuilderState>);
    } else {
      set({
        [section]: list.map((e) =>
          e.card.id === cardId ? { ...e, quantity: e.quantity - 1 } : e
        ),
      } as Partial<DeckBuilderState>);
    }
  },

  loadFromEntries: (entries, cardsById) => {
    const build = (section: DeckSection): DeckCardUI[] =>
      entries
        .filter((e) => e.section === section)
        .map((e) => {
          const card = cardsById.get(e.cardId);
          if (!card) return null;
          return { card, section, quantity: e.quantity };
        })
        .filter((x): x is DeckCardUI => x !== null);

    set({
      main: build("main"),
      extra: build("extra"),
      side: build("side"),
    });
  },

  reset: () => set({ deckName: "Novo Deck", main: [], extra: [], side: [] }),
}));
