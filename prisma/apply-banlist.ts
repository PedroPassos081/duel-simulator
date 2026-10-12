/**
 * Cadastra a banlist de uma sala a partir de um arquivo em prisma/banlists/.
 *
 *   npx tsx --env-file=.env prisma/apply-banlist.ts slifer            (só confere os nomes)
 *   npx tsx --env-file=.env prisma/apply-banlist.ts slifer --apply    (grava no banco)
 *
 * O arquivo tem seções [forbidden], [limited] e [semi-limited], uma carta por
 * linha (nome em inglês). Ao gravar, a banlist antiga da sala é substituída.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STATUSES = ["forbidden", "limited", "semi-limited"] as const;
type Status = (typeof STATUSES)[number];

// Compara nomes ignorando maiúsculas, acentos e pontuação ("Cyber Stein" = "Cyber-Stein")
const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function parse(text: string) {
  const entries: { name: string; status: Status; line: number }[] = [];
  let status: Status | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const section = line.match(/^\[(.+)\]$/);
    if (section) {
      if (!STATUSES.includes(section[1] as Status)) throw new Error(`Seção desconhecida na linha ${i + 1}: ${line}`);
      status = section[1] as Status;
      return;
    }
    if (!status) throw new Error(`Carta fora de uma seção na linha ${i + 1}: ${line}`);
    entries.push({ name: line, status, line: i + 1 });
  });
  return entries;
}

async function main() {
  const [format, flag] = process.argv.slice(2);
  if (!format) throw new Error("Informe a sala: slifer ou obelisk.");
  const apply = flag === "--apply";
  if (!(await prisma.banlist.findUnique({ where: { id: format } }))) {
    const ids = (await prisma.banlist.findMany({ select: { id: true } })).map((b) => b.id);
    throw new Error(`Banlist "${format}" não existe. Crie na aba Banlists do Admin. Existentes: ${ids.join(", ")}`);
  }
  const entries = parse(readFileSync(join(__dirname, "banlists", `${format}.txt`), "utf8"));

  const cards = await prisma.card.findMany({ select: { id: true, name: true } });
  const byName = new Map(cards.map((c) => [normalize(c.name), c]));

  const found = new Map<number, { name: string; status: Status }>();
  const missing: string[] = [];
  const conflicts: string[] = [];
  for (const e of entries) {
    const card = byName.get(normalize(e.name));
    if (!card) {
      missing.push(`linha ${e.line}: ${e.name}`);
      continue;
    }
    const before = found.get(card.id);
    if (before && before.status !== e.status) conflicts.push(`${card.name}: ${before.status} e ${e.status}`);
    // Se aparecer duas vezes, vale a mais restrita (a primeira seção é a mais restrita)
    if (!before) found.set(card.id, { name: card.name, status: e.status });
  }

  const count = (s: Status) => [...found.values()].filter((f) => f.status === s).length;
  console.log(`Sala ${format}: ${found.size} cartas encontradas — ${count("forbidden")} proibidas, ${count("limited")} limitadas, ${count("semi-limited")} semi-limitadas.`);
  if (conflicts.length) console.log(`Em duas seções (vale a mais restrita):\n  ${conflicts.join("\n  ")}`);
  if (missing.length) console.log(`Não estão no catálogo do jogo (${missing.length}):\n  ${missing.join("\n  ")}`);

  if (!apply) {
    console.log("\nNada foi gravado. Rode com --apply para gravar.");
    return;
  }
  await prisma.$transaction([
    prisma.banlistEntry.deleteMany({ where: { format } }),
    prisma.banlistEntry.createMany({ data: [...found.entries()].map(([cardId, f]) => ({ cardId, format, status: f.status })) }),
  ]);
  console.log(`\nBanlist da sala ${format} gravada.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
