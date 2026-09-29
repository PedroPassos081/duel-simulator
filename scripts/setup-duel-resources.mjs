import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resources = join(root, "resources", "ocgcore");

const repositories = [
  {
    name: "CardScripts",
    url: "https://github.com/ProjectIgnis/CardScripts.git",
    directory: join(resources, "CardScripts"),
  },
  {
    name: "BabelCDB",
    url: "https://github.com/ProjectIgnis/BabelCDB.git",
    directory: join(resources, "BabelCDB"),
  },
];

function git(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`git terminou com código ${code}.`));
    });
  });
}

await mkdir(resources, { recursive: true });

for (const repository of repositories) {
  if (existsSync(join(repository.directory, ".git"))) {
    console.log(`Atualizando ${repository.name}...`);
    await git(["-C", repository.directory, "pull", "--ff-only"]);
  } else {
    console.log(`Baixando ${repository.name}...`);
    await git([
      "clone",
      "--depth",
      "1",
      repository.url,
      repository.directory,
    ]);
  }
}

const database = join(resources, "BabelCDB", "cards.cdb");
if (!existsSync(database)) {
  throw new Error(`Banco de cartas não encontrado em ${database}.`);
}

console.log("\nRecursos do OCGCore prontos.");
console.log(`Banco: ${database}`);
console.log(`Scripts: ${join(resources, "CardScripts")}`);
