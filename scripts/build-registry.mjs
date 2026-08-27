import { readFile, writeFile } from "node:fs/promises";
import { loadPlugin, pluginDirectories } from "./catalog.mjs";

const entries = [];
for (const directory of await pluginDirectories()) {
  const { manifest, store } = await loadPlugin(directory);
  entries.push({
    id: manifest.id,
    displayName: manifest.displayName,
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    description: store.description,
    author: store.author,
    license: store.license,
    categories: store.categories,
    permissions: manifest.permissions,
    networkHosts: manifest.networkHosts,
    path: `plugins/${directory}`,
  });
}

const output = `${JSON.stringify({ schemaVersion: 1, plugins: entries }, null, 2)}\n`;
const registryURL = new URL("../registry.json", import.meta.url);

if (process.argv.includes("--check")) {
  const current = await readFile(registryURL, "utf8").catch(() => "");
  if (current !== output) {
    process.stderr.write("registry.json is out of date. Run npm run build:registry.\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("registry.json is up to date.\n");
  }
} else {
  await writeFile(registryURL, output);
  process.stdout.write("Updated registry.json.\n");
}
