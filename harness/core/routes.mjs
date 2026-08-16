import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveWorkspacePath, toWorkspaceRelative } from "./root.mjs";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadJson(workspace, key, expectedKind) {
  const file = workspace.files?.[key];
  if (!file) throw new Error(`CONFIG_FILE_MISSING ${key}`);
  const data = readJson(file);
  if (data.kind !== expectedKind) throw new Error(`CONFIG_KIND_INVALID ${key}`);
  return { ...data, source: toWorkspaceRelative(workspace.root, file) };
}

export function loadPlatformRegistry(workspace) {
  const registry = loadJson(workspace, "platform_registry", "platform-registry");
  if (!Array.isArray(registry.platforms) || !registry.platforms.length) throw new Error("PLATFORM_REGISTRY_EMPTY");
  const ids = new Set();
  for (const platform of registry.platforms) {
    if (!platform.id || ids.has(platform.id)) throw new Error(`PLATFORM_ID_INVALID ${platform.id ?? ""}`);
    ids.add(platform.id);
    if (platform.adapter && !platform.adapter.startsWith("builtin:")) resolveWorkspacePath(workspace.root, platform.adapter);
  }
  return registry;
}

export function loadRouteProfiles(workspace) {
  const profiles = loadJson(workspace, "route_profiles", "route-profiles");
  if (!profiles.profiles || typeof profiles.profiles !== "object") throw new Error("ROUTE_PROFILES_EMPTY");
  return profiles;
}

export function findPlatform(registry, id) {
  return registry.platforms.find(platform => platform.id === id) ?? null;
}

export function platformSummary(workspace, platform) {
  return {
    id: platform.id,
    display_name: platform.display_name ?? platform.id,
    kind: platform.kind ?? "platform",
    adapter: platform.adapter ?? null,
    adapter_path: platform.adapter && !platform.adapter.startsWith("builtin:")
      ? toWorkspaceRelative(workspace.root, resolveWorkspacePath(workspace.root, platform.adapter))
      : platform.adapter,
    enabled: platform.enabled !== false,
    local: platform.local !== false,
    capabilities: Array.isArray(platform.capabilities) ? platform.capabilities : []
  };
}

export async function probePlatform(workspace, platform, context = {}) {
  if (!platform) return { status: "unavailable", reason: "PLATFORM_NOT_REGISTERED" };
  if (platform.enabled === false) return { status: "unavailable", reason: "PLATFORM_DISABLED" };
  if (platform.local === false && context.config?.runtime?.external_execution !== true) return { status: "unavailable", reason: "EXTERNAL_PLATFORM_DISABLED_BY_POLICY" };
  if (platform.adapter === "builtin:primary") return { status: "ready", reason: "BUILTIN_PRIMARY_READY", capabilities: platform.capabilities ?? [] };
  if (typeof platform.adapter !== "string" || platform.adapter.trim() === "") return { status: "unavailable", reason: "PLATFORM_ADAPTER_MISSING" };
  const adapterFile = resolveWorkspacePath(workspace.root, platform.adapter);
  if (!fs.existsSync(adapterFile)) return { status: "unavailable", reason: "PLATFORM_ADAPTER_NOT_FOUND" };
  const adapter = await import(pathToFileURL(adapterFile).href);
  if (typeof adapter.probe !== "function") return { status: "unavailable", reason: "PLATFORM_PROBE_MISSING" };
  const result = await adapter.probe({ workspace, platform, context });
  return result && typeof result === "object" ? result : { status: "unavailable", reason: "PLATFORM_PROBE_INVALID" };
}
