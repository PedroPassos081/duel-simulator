// Tipos de item de personalização. Para criar um novo tipo (ex.: moedas de
// duelo, ícones), basta adicionar uma entrada aqui — a aba "Personalizar" da
// página Minha conta passa a exibi-lo automaticamente.
export const COSMETIC_TYPES = [
  { type: "sleeve", label: "Sleeves", description: "O fundo (verso) das suas cartas." },
  { type: "playmat", label: "Playmat", description: "O campo de duelo." },
  {
    type: "frame",
    label: "Moldura",
    description: "Fica em volta da sua foto de perfil em todo lugar: duelo, perfil, pódio de títulos e jornal.",
  },
  {
    type: "name_style",
    label: "Estilo do nick",
    description: "Cores, brilho e efeito no seu nome de usuário, em todo lugar onde ele aparece.",
  },
] as const;

export type CosmeticType = (typeof COSMETIC_TYPES)[number]["type"];

// Efeitos disponíveis para itens do tipo "name_style". O campo `effect` do
// item aponta para um destes ids; o visual fica em .nick-<id> no globals.css.
export const NAME_EFFECTS = [
  { id: "gold", label: "Dourado" },
  { id: "rainbow", label: "Arco-íris" },
  { id: "fire", label: "Fogo" },
  { id: "neon", label: "Neon" },
  { id: "galaxy", label: "Galáxia" },
  { id: "ice", label: "Gelo" },
] as const;

export type NameEffect = (typeof NAME_EFFECTS)[number]["id"];

export function nameEffectClass(effect: string | null | undefined) {
  return NAME_EFFECTS.some((e) => e.id === effect) ? `nick-effect nick-${effect}` : "";
}

export const SOURCE_LABELS: Record<string, string> = {
  grant: "Presente",
  raffle: "Sorteio",
  reward: "Prêmio",
  purchase: "Comprado",
};

export const RARITY_LABELS: Record<string, string> = {
  common: "Comum",
  rare: "Rara",
  epic: "Épica",
  legendary: "Lendária",
};
