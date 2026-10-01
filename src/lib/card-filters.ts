// Filtros e ordenação de cartas, usados na Loja e no Deck Builder (código puro, roda no navegador).
import { mostPermissiveCopies } from "@/lib/banlist-shared";

export interface FilterableCard {
  name: string;
  type: string;
  race: string | null;
  attribute: string | null;
  atk: number | null;
  def: number | null;
  level: number | null; // nos monstros XYZ, é o Rank
  releaseDate?: string | null; // lançamento no TCG
  siteAddedAt?: string | null; // entrada no jogo (vazio = até o lançamento do site)
  banlistEntries?: { format?: string; status: string }[]; // status nas banlists das salas
}

export interface FilterableItem {
  card: FilterableCard;
  priceGold?: number | null;
  priceCash?: number | null;
  ownedQuantity: number;
  /** Limite de cópias da loja (ausente = só vale a banlist). */
  maxTotal?: number;
}

/** Onde o filtro está: a loja mostra preço e coleção; o Deck Builder não. */
export type FilterMode = "shop" | "deck";

export const SORTS = {
  name_asc: "Nome A–Z",
  name_desc: "Nome Z–A",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  date_new: "Lançamento: mais recentes",
  date_old: "Lançamento: mais antigas",
  // Lançamento = quando a carta entrou no jogo. As que entraram até o lançamento
  // do site têm a mesma data; entre elas vale a data do TCG.
} as const;
export type Sort = keyof typeof SORTS;
export const PRICE_SORTS: Sort[] = ["price_asc", "price_desc"];

export const CATEGORIES = { ALL: "Todas", MONSTER: "Monstros", SPELL: "Mágicas", TRAP: "Armadilhas" } as const;
export type Category = keyof typeof CATEGORIES;

// Classe do monstro (pelo texto de "type" da carta, ex.: "Fusion Monster", "Flip Effect Monster")
export const MONSTER_KINDS = {
  normal: { label: "Normal", test: (t: string) => t.includes("Normal") },
  effect: { label: "Efeito", test: (t: string) => /Effect|Spirit|Toon|Union|Gemini|Flip/.test(t) },
  ritual: { label: "Ritual", test: (t: string) => t.includes("Ritual") },
  fusion: { label: "Fusão", test: (t: string) => t.includes("Fusion") },
  synchro: { label: "Synchro", test: (t: string) => t.includes("Synchro") },
  xyz: { label: "XYZ", test: (t: string) => t.includes("XYZ") },
  tuner: { label: "Tuner", test: (t: string) => t.includes("Tuner") },
  flip: { label: "Flip", test: (t: string) => t.includes("Flip") },
  toon: { label: "Toon", test: (t: string) => t.includes("Toon") },
  spirit: { label: "Spirit", test: (t: string) => t.includes("Spirit") },
  union: { label: "Union", test: (t: string) => t.includes("Union") },
  gemini: { label: "Gemini", test: (t: string) => t.includes("Gemini") },
} as const;
export type MonsterKind = keyof typeof MONSTER_KINDS;

export const ATTRIBUTES = ["LIGHT", "DARK", "WATER", "FIRE", "EARTH", "WIND", "DIVINE"] as const;

// Tipo do monstro (campo "race" da carta) em português
export const MONSTER_TYPE_LABELS: Record<string, string> = {
  Aqua: "Aqua",
  Beast: "Besta",
  "Beast-Warrior": "Besta-Guerreira",
  "Creator-God": "Deus Criador",
  Cyberse: "Ciberso",
  Dinosaur: "Dinossauro",
  "Divine-Beast": "Besta Divina",
  Dragon: "Dragão",
  Fairy: "Fada",
  Fiend: "Demônio",
  Fish: "Peixe",
  Illusion: "Ilusão",
  Insect: "Inseto",
  Machine: "Máquina",
  Plant: "Planta",
  Psychic: "Psíquico",
  Pyro: "Piro",
  Reptile: "Réptil",
  Rock: "Rocha",
  "Sea Serpent": "Serpente Marinha",
  Spellcaster: "Mago",
  Thunder: "Trovão",
  Warrior: "Guerreiro",
  "Winged Beast": "Besta Alada",
  Wyrm: "Wyrm",
  Zombie: "Zumbi",
};
export const monsterTypeLabel = (race: string) => (MONSTER_TYPE_LABELS[race] ? `${MONSTER_TYPE_LABELS[race]} (${race})` : race);

/** Tipos de monstro que aparecem nessas cartas (para o filtro "Tipo"). */
export function monsterTypesOf(cards: FilterableCard[]) {
  return [...new Set(cards.filter((c) => c.type.includes("Monster") && c.race).map((c) => c.race!))].sort((a, b) =>
    monsterTypeLabel(a).localeCompare(monsterTypeLabel(b))
  );
}

// Atalhos de faixa de nível (os antigos "tributos")
export const LEVEL_PRESETS = [
  { label: "1–4", min: "1", max: "4" },
  { label: "5–6", min: "5", max: "6" },
  { label: "7+", min: "7", max: "" },
] as const;
export const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const SPELL_TYPES = ["Normal", "Quick-Play", "Continuous", "Equip", "Field", "Ritual"] as const;
// Subtipo de Mágica/Armadilha (campo "race" dessas cartas) em português
export const SPELL_TRAP_LABELS: Record<string, string> = {
  Normal: "Normal",
  "Quick-Play": "Rápida",
  Continuous: "Contínua",
  Equip: "Equipamento",
  Field: "Campo",
  Ritual: "Ritual",
  Counter: "Resposta",
};
export const TRAP_TYPES = ["Normal", "Continuous", "Counter"] as const;

export const OWNERSHIP = { all: "Todas", owned: "Que tenho", not_owned: "Que não tenho", buyable: "Posso comprar mais" } as const;
export type Ownership = keyof typeof OWNERSHIP;

// Limite de cópias: 1 (limitada), 2 (semilimitada) ou 3 (livre)
export const COPY_LIMITS = [1, 2, 3] as const;
/**
 * Quantas cópias a carta permite: o menor entre o limite da loja e a sala mais
 * aberta (uma carta proibida na Slifer ainda pode ser usada na Obelisco).
 */
export function copyLimit(item: FilterableItem) {
  return Math.min(mostPermissiveCopies(item.card.banlistEntries), item.maxTotal ?? 3);
}

export type Range = { min: string; max: string };
const emptyRange = (): Range => ({ min: "", max: "" });

export interface Filters {
  search: string;
  sort: Sort;
  category: Category;
  kinds: MonsterKind[];
  extraOnly: boolean;
  attributes: string[];
  race: string;
  // Nível/Rank: níveis exatos escolhidos OU uma faixa (de–até)
  levelMode: "exact" | "range";
  levels: number[];
  level: Range;
  atk: Range;
  def: Range;
  spellTypes: string[];
  trapTypes: string[];
  price: Range; // gold
  priceCash: Range; // crédito
  limits: number[];
  ownership: Ownership;
}

export const DEFAULT_FILTERS: Filters = {
  search: "",
  sort: "name_asc",
  category: "ALL",
  kinds: [],
  extraOnly: false,
  attributes: [],
  race: "",
  levelMode: "exact",
  levels: [],
  level: emptyRange(),
  atk: emptyRange(),
  def: emptyRange(),
  spellTypes: [],
  trapTypes: [],
  price: emptyRange(),
  priceCash: emptyRange(),
  limits: [],
  ownership: "all",
};

const isMonster = (type: string) => type.includes("Monster");
export const isExtraDeck = (type: string) => /Fusion|Synchro|XYZ|Link/i.test(type);
const rangeActive = (r: Range) => r.min !== "" || r.max !== "";

function inRange(value: number | null | undefined, range: Range) {
  if (!rangeActive(range)) return true;
  if (value == null) return false;
  if (range.min !== "" && value < Number(range.min)) return false;
  if (range.max !== "" && value > Number(range.max)) return false;
  return true;
}

/** O filtro de nível está ligado? */
function levelActive(f: Filters) {
  return f.levelMode === "exact" ? f.levels.length > 0 : rangeActive(f.level);
}

export function applyFilters<T extends FilterableItem>(items: T[], f: Filters): T[] {
  const q = f.search.trim().toLowerCase();
  const monsterFilters = f.kinds.length > 0 || f.extraOnly || f.attributes.length > 0 || f.race !== "" ||
    levelActive(f) || rangeActive(f.atk) || rangeActive(f.def);

  const result = items.filter((item) => {
    const { card } = item;
    const type = card.type;
    if (q && !card.name.toLowerCase().includes(q)) return false;

    if (f.category === "MONSTER" && !isMonster(type)) return false;
    if (f.category === "SPELL" && !type.includes("Spell")) return false;
    if (f.category === "TRAP" && !type.includes("Trap")) return false;

    // Filtros de monstro: quem não é monstro não passa quando algum estiver ativo
    if (monsterFilters && !isMonster(type)) return false;
    if (f.kinds.length > 0 && !f.kinds.some((k) => MONSTER_KINDS[k].test(type))) return false;
    if (f.extraOnly && !isExtraDeck(type)) return false;
    if (f.attributes.length > 0 && !f.attributes.includes(card.attribute ?? "")) return false;
    if (f.race && card.race !== f.race) return false;
    if (f.levelMode === "exact" && f.levels.length > 0 && !f.levels.includes(card.level ?? -1)) return false;
    if (f.levelMode === "range" && !inRange(card.level, f.level)) return false;
    if (!inRange(card.atk, f.atk) || !inRange(card.def, f.def)) return false;

    if (f.spellTypes.length > 0 || f.trapTypes.length > 0) {
      const okSpell = type.includes("Spell") && f.spellTypes.includes(card.race ?? "");
      const okTrap = type.includes("Trap") && f.trapTypes.includes(card.race ?? "");
      if (!okSpell && !okTrap) return false;
    }

    if (!inRange(item.priceGold, f.price) || !inRange(item.priceCash, f.priceCash)) return false;
    if (f.limits.length > 0 && !f.limits.includes(copyLimit(item))) return false;

    const owned = item.ownedQuantity;
    if (f.ownership === "owned" && owned === 0) return false;
    if (f.ownership === "not_owned" && owned > 0) return false;
    if (f.ownership === "buyable" && owned >= copyLimit(item)) return false;
    return true;
  });

  const byName = (a: T, b: T) => a.card.name.localeCompare(b.card.name);
  const price = (l: T) => l.priceGold ?? Number.POSITIVE_INFINITY;
  const time = (value?: string | null) => (value ? new Date(value).getTime() : 0);
  // Entrada no jogo primeiro (vazio = lançamento do site, o mais antigo); empate pela data do TCG
  const byDate = (a: T, b: T) => time(a.card.siteAddedAt) - time(b.card.siteAddedAt) || time(a.card.releaseDate) - time(b.card.releaseDate);
  const sorters: Record<Sort, (a: T, b: T) => number> = {
    name_asc: byName,
    name_desc: (a, b) => byName(b, a),
    price_asc: (a, b) => price(a) - price(b) || byName(a, b),
    price_desc: (a, b) => price(b) - price(a) || byName(a, b),
    date_new: (a, b) => byDate(b, a) || byName(a, b),
    date_old: (a, b) => byDate(a, b) || byName(a, b),
  };
  return result.sort(sorters[f.sort]);
}

/** Quantos filtros avançados estão ativos (para o contador do botão). */
export function countActiveFilters(f: Filters) {
  const ranges = [f.atk, f.def, f.price, f.priceCash].filter(rangeActive).length;
  return (
    f.kinds.length + (f.extraOnly ? 1 : 0) + f.attributes.length + (f.race ? 1 : 0) + (levelActive(f) ? 1 : 0) +
    ranges + f.spellTypes.length + f.trapTypes.length + f.limits.length + (f.ownership !== "all" ? 1 : 0)
  );
}
