import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Database, SqlJsStatic } from "sql.js";

export type OcgCardData = {
  code: number;
  alias: number;
  setcodes: number[];
  type: number;
  level: number;
  attribute: number;
  race: bigint;
  attack: number;
  defense: number;
  lscale: number;
  rscale: number;
  link_marker: number;
};

const defaultRoot = resolve(process.cwd(), "resources", "ocgcore");

export function getOcgCoreResourcePaths() {
  return {
    cardDatabase:
      process.env.OCGCORE_CARD_DB_PATH?.trim() ||
      resolve(defaultRoot, "BabelCDB", "cards.cdb"),
    scripts:
      process.env.OCGCORE_SCRIPT_DIR?.trim() ||
      resolve(defaultRoot, "CardScripts"),
  };
}

export function getOcgCoreResourceStatus() {
  const paths = getOcgCoreResourcePaths();
  return {
    paths,
    cardDatabaseConfigured: existsSync(paths.cardDatabase),
    scriptsConfigured: existsSync(paths.scripts),
  };
}

let databasePromise: Promise<Database> | undefined;

async function loadDatabase() {
  const { cardDatabase } = getOcgCoreResourcePaths();
  const runtimeUrl = pathToFileURL(
    join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.js")
  ).href;
  const runtime = (await import(/* webpackIgnore: true */ runtimeUrl)) as {
    default(options: { locateFile: () => string }): Promise<SqlJsStatic>;
  };
  const SQL = await runtime.default({
    locateFile: () =>
      join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
  });
  return new SQL.Database(await readFile(cardDatabase));
}

function decodeSetcodes(hexValue: string) {
  let packed = BigInt(`0x${hexValue}`);
  const setcodes: number[] = [];
  while (packed > 0n) {
    const setcode = Number(packed & 0xffffn);
    if (setcode) setcodes.push(setcode);
    packed >>= 16n;
  }
  return setcodes;
}

export async function readOcgCard(code: number): Promise<OcgCardData | null> {
  databasePromise ??= loadDatabase();
  const database = await databasePromise;
  const statement = database.prepare(`
    SELECT id, alias, printf('%016llx', setcode) AS setcode_hex,
      type, atk, def, level, race, attribute
    FROM datas
    WHERE id = ?
  `);

  try {
    statement.bind([code]);
    if (!statement.step()) return null;
    const row = statement.getAsObject() as Record<string, string | number>;
    const levelValue = Number(row.level);
    const type = Number(row.type);
    const defense = Number(row.def);
    const isLink = (type & 0x4000000) !== 0;

    return {
      code: Number(row.id),
      alias: Number(row.alias),
      setcodes: decodeSetcodes(String(row.setcode_hex)),
      type,
      level: levelValue & 0xff,
      attribute: Number(row.attribute),
      race: BigInt(Number(row.race)),
      attack: Number(row.atk),
      defense: isLink ? 0 : defense,
      lscale: (levelValue >> 24) & 0xff,
      rscale: (levelValue >> 16) & 0xff,
      link_marker: isLink ? defense : 0,
    };
  } finally {
    statement.free();
  }
}

function safeScriptPath(root: string, name: string) {
  const normalizedName = name.replaceAll("\\", "/").replace(/^\/+/, "");
  const candidate = resolve(root, normalizedName);
  const pathFromRoot = relative(root, candidate);
  if (
    isAbsolute(pathFromRoot) ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    return null;
  }
  return candidate;
}

export async function readOcgScript(name: string): Promise<string | null> {
  const { scripts } = getOcgCoreResourcePaths();
  const candidates = [
    safeScriptPath(scripts, name),
    safeScriptPath(scripts, `official/${name}`),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

export function readOcgScriptSync(name: string): string | null {
  const { scripts } = getOcgCoreResourcePaths();
  const candidates = [
    safeScriptPath(scripts, name),
    safeScriptPath(scripts, `official/${name}`),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}
