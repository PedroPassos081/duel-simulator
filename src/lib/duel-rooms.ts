// Salas do Random. Cada sala usa a própria banlist: entradas de BanlistEntry
// com `format` igual ao id da sala ("slifer" ou "obelisk").
//
// Para proibir na Slifer uma carta permitida na Obelisco, crie uma BanlistEntry
// { cardId, format: "slifer", status: "forbidden" }.
export const DUEL_ROOMS = [
  {
    id: "slifer",
    name: "Sala Slifer",
    title: "O Dragão Celeste",
    level: "Iniciante",
    tagline: "No clima do Tag Force",
    // Arte de fundo do quadro da sala (YGOPRODeck, mesma fonte das imagens de cartas)
    artUrl: "https://images.ygoprodeck.com/images/cards_cropped/10000020.jpg",
    description: "Para quem está começando. Banlist mais restrita, duelos mais equilibrados.",
    theme: "red",
  },
  {
    id: "obelisk",
    name: "Sala Obelisco",
    title: "O Atormentador",
    level: "Avançada",
    tagline: "Para duelistas experientes",
    artUrl: "https://images.ygoprodeck.com/images/cards_cropped/10000000.jpg",
    description: "Banlist mais aberta: cartas e estratégias mais fortes são permitidas.",
    theme: "blue",
  },
] as const;

export type DuelRoomId = (typeof DUEL_ROOMS)[number]["id"];

export function isDuelRoomId(value: string): value is DuelRoomId {
  return DUEL_ROOMS.some((r) => r.id === value);
}

export function getDuelRoom(id: string) {
  return DUEL_ROOMS.find((r) => r.id === id);
}
