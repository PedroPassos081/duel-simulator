import "server-only";

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getOcgCoreResourceStatus } from "@/lib/duel/ocgcore-resources";

type OcgCore = {
  getVersion(): readonly [number, number];
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
