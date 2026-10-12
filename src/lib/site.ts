// Lançamento do site. Enquanto SITE_LAUNCH_DATE não estiver definido no .env (ou
// ainda não tiver chegado), toda carta adicionada conta como "do lançamento":
// todas com a mesma data, ordenadas entre si pela data do TCG. Depois do
// lançamento, cada carta nova guarda a data em que entrou no jogo.

export function siteLaunchDate(): Date | null {
  const value = process.env.SITE_LAUNCH_DATE;
  return value ? new Date(value) : null;
}

export function isSiteLaunched(now = new Date()) {
  const launch = siteLaunchDate();
  return Boolean(launch && now >= launch);
}

/** Valor de Card.siteAddedAt para uma carta que está sendo adicionada agora. */
export function siteAddedAtForNewCard(now = new Date()) {
  return isSiteLaunched(now) ? now : null;
}

// Cartas que não aparecem no jogo (registros vazios vindos da YGOPRODeck)
export const HIDDEN_CARD_NAMES = ["???"];
