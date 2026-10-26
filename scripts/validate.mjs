import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertNoSymlinks, loadPlugin, pluginDirectories } from "./catalog.mjs";

const permissions = new Set(["activities", "commands", "notices", "network", "secureStorage"]);
const settingKinds = new Set(["text", "secret", "boolean"]);
const categories = new Set(["communication", "developer-tools", "productivity", "utilities", "other"]);
const idPattern = /^[a-z][a-z0-9.-]{2,63}$/;
const settingPattern = /^[a-z][A-Za-z0-9]{1,63}$/;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const hostPattern = /^(?:\*\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$/;
const requiredManifestKeys = ["id", "displayName", "version", "apiVersion", "entrypoint", "permissions", "networkHosts", "settings"];
const requiredStoreKeys = ["schemaVersion", "description", "author", "license", "categories"];
const optionalStoreKeys = ["pitch"];
const moods = new Set(["watching", "thinking", "adoring", "stretching", "grooming"]);
const languagePattern = /^[a-z]{2}(?:-[A-Za-z]{2,4})?$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, required, context) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${context} must be an object`);
  const keys = Object.keys(value).sort();
  const expected = [...required].sort();
  assert(JSON.stringify(keys) === JSON.stringify(expected), `${context} must contain exactly: ${expected.join(", ")}`);
}

function uniqueStrings(values, context) {
  assert(Array.isArray(values) && values.every((value) => typeof value === "string"), `${context} must be an array of strings`);
  assert(new Set(values).size === values.length, `${context} contains duplicate values`);
}

function validateManifest(directory, manifest) {
  exactKeys(manifest, requiredManifestKeys, `${directory}/mewmori-plugin.json`);
  assert(manifest.id === directory, `${directory}: directory name must equal manifest id`);
  assert(idPattern.test(manifest.id), `${directory}: invalid plugin id`);
  assert(typeof manifest.displayName === "string" && manifest.displayName.trim().length > 0, `${directory}: displayName is required`);
  assert(semverPattern.test(manifest.version), `${directory}: version must be semantic versioning`);
  assert(manifest.apiVersion === 1, `${directory}: only apiVersion 1 is supported`);
  assert(typeof manifest.entrypoint === "string" && manifest.entrypoint.endsWith(".mjs"), `${directory}: entrypoint must be an .mjs file`);
  assert(!manifest.entrypoint.startsWith("/") && !manifest.entrypoint.split("/").includes(".."), `${directory}: entrypoint must stay inside the plugin directory`);

  uniqueStrings(manifest.permissions, `${directory}: permissions`);
  assert(manifest.permissions.every((value) => permissions.has(value)), `${directory}: unknown permission`);
  uniqueStrings(manifest.networkHosts, `${directory}: networkHosts`);
  assert(manifest.networkHosts.every((host) => hostPattern.test(host) && !host.includes(":") && !host.includes("/")), `${directory}: invalid network host`);
  assert(manifest.networkHosts.length === 0 || manifest.permissions.includes("network"), `${directory}: networkHosts require the network permission`);
  assert(!manifest.permissions.includes("network") || manifest.networkHosts.length > 0, `${directory}: network permission requires at least one declared host`);

  assert(Array.isArray(manifest.settings), `${directory}: settings must be an array`);
  const settingKeys = new Set();
  for (const setting of manifest.settings) {
    exactKeys(setting, ["key", "title", "kind", "required"], `${directory}: setting`);
    assert(settingPattern.test(setting.key), `${directory}: invalid setting key ${setting.key}`);
    assert(!settingKeys.has(setting.key), `${directory}: duplicate setting key ${setting.key}`);
    settingKeys.add(setting.key);
    assert(typeof setting.title === "string" && setting.title.trim().length > 0, `${directory}: setting title is required`);
    assert(settingKinds.has(setting.kind), `${directory}: invalid setting kind`);
    assert(typeof setting.required === "boolean", `${directory}: setting required must be boolean`);
  }
  assert(!manifest.permissions.includes("secureStorage") || manifest.settings.some((setting) => setting.kind === "secret"), `${directory}: secureStorage requires a secret setting`);
  assert(!manifest.settings.some((setting) => setting.kind === "secret") || manifest.permissions.includes("secureStorage"), `${directory}: secret settings require secureStorage`);
}

// The cat's example line on the catalog card. It is what the cat says after
// connecting, so it is only allowed for a plugin that can make the cat speak.
function validatePitch(directory, pitch, manifest) {
  assert(manifest.permissions.includes("notices"), `${directory}: pitch requires the notices permission`);
  assert(pitch && typeof pitch === "object" && !Array.isArray(pitch), `${directory}: pitch must be an object`);
  const keys = Object.keys(pitch);
  assert(keys.every((key) => ["says", "when", "mood"].includes(key)) && keys.includes("says") && keys.includes("when"), `${directory}: pitch must contain says, when and optionally mood`);
  for (const field of ["says", "when"]) {
    const values = pitch[field];
    assert(values && typeof values === "object" && !Array.isArray(values), `${directory}: pitch.${field} must map languages to text`);
    const entries = Object.entries(values);
    assert(entries.length > 0 && entries.length <= 16, `${directory}: pitch.${field} needs 1-16 languages`);
    assert("en" in values, `${directory}: pitch.${field} needs an English line`);
    for (const [language, text] of entries) {
      assert(languagePattern.test(language), `${directory}: pitch.${field} has an invalid language code`);
      assert(typeof text === "string" && text.trim().length > 0 && text.length <= 160, `${directory}: pitch.${field}.${language} must be 1-160 characters`);
      assert(!/[\u0000-\u001F\u007F]/.test(text), `${directory}: pitch.${field}.${language} must be one line`);
    }
  }
  assert(pitch.mood === undefined || moods.has(pitch.mood), `${directory}: pitch.mood must be one of ${[...moods].join(", ")}`);
}

function validateStore(directory, store, manifest) {
  const present = Object.keys(store ?? {}).filter((key) => !optionalStoreKeys.includes(key));
  exactKeys(Object.fromEntries(present.map((key) => [key, store[key]])), requiredStoreKeys, `${directory}/store.json`);
  if (store.pitch !== undefined) validatePitch(directory, store.pitch, manifest);
  assert(store.schemaVersion === 1, `${directory}: store schemaVersion must be 1`);
  assert(typeof store.description === "string" && store.description.trim().length >= 20 && store.description.length <= 200, `${directory}: description must be 20-200 characters`);
  exactKeys(store.author, ["name", "github"], `${directory}: author`);
  assert(typeof store.author.name === "string" && store.author.name.trim().length > 0, `${directory}: author name is required`);
  assert(typeof store.author.github === "string" && /^[A-Za-z0-9-]{1,39}$/.test(store.author.github), `${directory}: invalid GitHub author`);
  assert(typeof store.license === "string" && store.license.trim().length > 0, `${directory}: license is required`);
  uniqueStrings(store.categories, `${directory}: categories`);
  assert(store.categories.length > 0 && store.categories.every((value) => categories.has(value)), `${directory}: invalid category`);
}

const failures = [];
for (const directory of await pluginDirectories()) {
  try {
    const { pluginRoot, manifest, store } = await loadPlugin(directory);
    validateManifest(directory, manifest);
    validateStore(directory, store, manifest);
    await access(new URL(manifest.entrypoint, pluginRoot), constants.R_OK);
    await access(new URL("README.md", pluginRoot), constants.R_OK);
    await assertNoSymlinks(fileURLToPath(pluginRoot));
    const source = await readFile(new URL(manifest.entrypoint, pluginRoot), "utf8");
    assert(!source.includes("eval(") && !source.includes("new Function("), `${directory}: dynamic code evaluation is not allowed`);
    process.stdout.write(`✓ ${directory}\n`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`✗ ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("All plugins are valid.\n");
}
