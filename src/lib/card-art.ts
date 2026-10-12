import type { ArtTone } from "@/components/theme/ArtBanner";

/** Arte recortada (só a ilustração) de uma carta, como já usada nas salas do Random. */
export const cardArt = (id: number) => `https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg`;

/** IDs (passcode) das cartas usadas como referência visual em cada seção. */
export const ART = {
  gravekeeperChief: 62473983, // Gravekeeper's Chief
  gravekeeperSpy: 24317029, // Gravekeeper's Spy
  necrovalley: 47355498, // Necrovalley
  aleister: 97973962, // Aleister the Invoker of Madness
  mechaba: 75286621, // Invoked Mechaba
  upstartGoblin: 70368879, // Upstart Goblin
  potOfGreed: 55144522, // Pot of Greed
  tradeIn: 38120068, // Trade-In
  messengerOfPeace: 44656491, // Messenger of Peace
  bookOfSecretArts: 91595718, // Book of Secret Arts
  blueEyes: 89631139, // Blue-Eyes White Dragon
  darkMagician: 46986414, // Dark Magician
  redEyes: 74677422, // Red-Eyes Black Dragon
  exodia: 33396948, // Exodia the Forbidden One
  ultimateDragon: 23995346, // Blue-Eyes Ultimate Dragon
  timeWizard: 71625222, // Time Wizard
  darkMagicianGirl: 38033121, // Dark Magician Girl
} as const;

/** Arquétipos que dão rosto aos clãs. Cada clã ganha um, sempre o mesmo (ver clanArchetype). */
export const CLAN_ARCHETYPES: { name: string; tagline: string; art: number; tone: ArtTone; position: string }[] = [
  { name: "Coveiros", tagline: "Guardiões do Necrovale", art: ART.gravekeeperChief, tone: "gold", position: "center 30%" },
  { name: "Invocados", tagline: "Herdeiros de Aleister", art: ART.aleister, tone: "purple", position: "center 25%" },
  { name: "Necrovale", tagline: "O vale que não perdoa", art: ART.necrovalley, tone: "blue", position: "center 45%" },
  { name: "Mechaba", tagline: "Fusão da Invocação", art: ART.mechaba, tone: "red", position: "center 30%" },
];

/** Escolhe o arquétipo do clã a partir do id (estável entre visitas, sem precisar de coluna no banco). */
export function clanArchetype(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CLAN_ARCHETYPES[hash % CLAN_ARCHETYPES.length];
}
