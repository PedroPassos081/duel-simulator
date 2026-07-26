import "server-only";

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getOcgCoreResourceStatus } from "@/lib/duel/ocgcore-resources";

type OcgCore = {
  getVersion(): readonly [number, number];
  createDuel(options: {
    flags: bigint;
    seed: [bigint, bigint, bigint, bigint];
    team1: {
      startingLP: number;
      startingDrawCount: number;
      drawCountPerTurn: number;
    };
    team2: {
      startingLP: number;
      startingDrawCount: number;
      drawCountPerTurn: number;
    };
    cardReader: (code: number) => unknown;
    scriptReader: (name: string) => string | null;
    errorHandler?: (type: number, text: string) => void;
  }): Promise<unknown> | unknown;
  destroyDuel(handle: unknown): void;
  duelNewCard(
    handle: unknown,
    card: {
      team: 0 | 1;
      duelist: number;
      code: number;
      controller: 0 | 1;
      location: number;
      sequence: number;
      position: number;
    }
  ): Promise<void> | void;
  startDuel(handle: unknown): Promise<void> | void;
  duelProcess(handle: unknown): Promise<number> | number;
  duelGetMessage(handle: unknown): Array<Record<string, unknown>>;
  duelSetResponse(handle: unknown, response: Record<string, unknown>): void;
};

type OcgCoreModule = {
  default(options: { sync: true }): Promise<OcgCore>;
};

declare global {
  // eslint-disable-next-line no-var
  var ocgCorePromise: Promise<OcgCore> | undefined;
}

async function createOcgCore() {
  // A versão publicada no JSR não reexporta corretamente o módulo padrão.
  // O caminho absoluto evita que o webpack transforme `require.resolve`
  // em um contexto vazio no Windows.
  const runtimeUrl = pathToFileURL(
    join(
      process.cwd(),
      "node_modules",
      "@n1xx1",
      "ocgcore-wasm",
      "dist",
      "index.js"
    )
  ).href;
  const runtime = (await import(/* webpackIgnore: true */ runtimeUrl)) as OcgCoreModule;

  return runtime.default({ sync: true });
}

export function loadOcgCore() {
  globalThis.ocgCorePromise ??= createOcgCore();
  return globalThis.ocgCorePromise;
}

export async function getOcgCoreStatus() {
  const core = await loadOcgCore();
  const [major, minor] = core.getVersion();
  const resources = getOcgCoreResourceStatus();

  return {
    available: true,
    version: `${major}.${minor}`,
    cardDatabaseConfigured: resources.cardDatabaseConfigured,
    scriptsConfigured: resources.scriptsConfigured,
    readyForDuels:
      resources.cardDatabaseConfigured && resources.scriptsConfigured,
  };
}
