import { readdir, readFile, lstat } from "node:fs/promises";
import { join } from "node:path";

export const root = new URL("../", import.meta.url);
export const pluginsRoot = new URL("../plugins/", import.meta.url);

export async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function pluginDirectories() {
  const entries = await readdir(pluginsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function loadPlugin(directory) {
  const pluginRoot = new URL(`../plugins/${directory}/`, import.meta.url);
  const manifest = await readJSON(new URL("mewmori-plugin.json", pluginRoot));
  const store = await readJSON(new URL("store.json", pluginRoot));
  return { directory, pluginRoot, manifest, store };
}

export async function assertNoSymlinks(directory) {
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(current, entry.name);
      const stats = await lstat(path);
      if (stats.isSymbolicLink()) throw new Error(`symlinks are not allowed: ${path}`);
      if (stats.isDirectory()) pending.push(path);
    }
  }
}
