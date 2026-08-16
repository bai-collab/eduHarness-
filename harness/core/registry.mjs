import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveWorkspacePath } from "./root.mjs";

export function loadRegistry(workspace) {
  const file = workspace.paths.registry;
  const registry = JSON.parse(fs.readFileSync(file, "utf8"));
  if (registry.schema_version !== 1 || registry.kind !== "local-block-registry") throw new Error("REGISTRY_SCHEMA_INVALID");
  const ids = new Set();
  for (const block of registry.blocks ?? []) {
    if (!block.id || ids.has(block.id)) throw new Error(`REGISTRY_DUPLICATE_BLOCK ${block.id ?? "<missing>"}`);
    if (!block.module) throw new Error(`REGISTRY_BLOCK_MODULE_REQUIRED ${block.id}`);
    ids.add(block.id);
  }
  return registry;
}

export function blockEntry(registry, id) {
  const entry = registry.blocks.find(block => block.id === id);
  if (!entry) throw new Error(`BLOCK_NOT_REGISTERED ${id}`);
  return entry;
}

export async function loadBlock(workspace, entry) {
  const file = resolveWorkspacePath(workspace.root, entry.module);
  if (!fs.existsSync(file)) {
    if (entry.optional) return null;
    throw new Error(`BLOCK_MODULE_MISSING ${entry.id}`);
  }
  const loaded = await import(pathToFileURL(file).href);
  if (typeof loaded.run !== "function") throw new Error(`BLOCK_RUN_EXPORT_MISSING ${entry.id}`);
  return loaded.run;
}
