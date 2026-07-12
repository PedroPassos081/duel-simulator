import type { DeckCardEntry } from "@/lib/validate-deck";

/**
 * Formato .ydk padrão:
 *
 * #created by ...
 * #main
 * 12345
 * 12345
 * 67890
 * #extra
 * 11111
 * !side
 * 22222
 *
 * Cada ID de carta aparece repetido uma vez por cópia (não há "quantidade" explícita).
 */
export function parseYdk(content: string): DeckCardEntry[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim());

  let currentSection: "main" | "extra" | "side" | null = null;
  const counts = new Map<string, number>(); // chave: `${section}:${cardId}`

  for (const line of lines) {
    if (line === "" || line.startsWith("#created")) continue;

    if (line === "#main") {
      currentSection = "main";
      continue;
    }
    if (line === "#extra") {
      currentSection = "extra";
      continue;
    }
    if (line === "!side") {
      currentSection = "side";
      continue;
    }

    if (!currentSection) continue; // linha antes de qualquer marcador de seção

    const cardId = Number(line);
    if (!Number.isFinite(cardId)) continue;

    const key = `${currentSection}:${cardId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const entries: DeckCardEntry[] = [];
  for (const [key, quantity] of counts) {
    const [section, cardIdStr] = key.split(":");
    entries.push({
      section: section as DeckCardEntry["section"],
      cardId: Number(cardIdStr),
      quantity,
    });
  }
  return entries;
}

export function exportYdk(entries: DeckCardEntry[], deckName = "deck"): string {
  const lines: string[] = [`#created by Edison Duel Simulator`, `#${deckName}`, "#main"];

  const bySection = (section: DeckCardEntry["section"]) =>
    entries.filter((e) => e.section === section);

  for (const entry of bySection("main")) {
    for (let i = 0; i < entry.quantity; i++) lines.push(String(entry.cardId));
  }

  lines.push("#extra");
  for (const entry of bySection("extra")) {
    for (let i = 0; i < entry.quantity; i++) lines.push(String(entry.cardId));
  }

  lines.push("!side");
  for (const entry of bySection("side")) {
    for (let i = 0; i < entry.quantity; i++) lines.push(String(entry.cardId));
  }

  return lines.join("\n");
}
