import "server-only";

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
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
  // Resolver o arquivo de runtime mantém o carregamento restrito ao servidor.
  const require = createRequire(import.meta.url);
  const packageName = ["@n1xx1", "ocgcore-wasm"].join("/");
  const packageEntry = require.resolve(packageName);
  const runtimeUrl = pathToFileURL(
    join(dirname(packageEntry), "dist/index.js")
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
