import fs from "node:fs";
import path from "node:path";
import { findWorkspaceRoot, resolveWorkspacePath } from "./root.mjs";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function merge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return base;
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
      result[key] = merge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function assertPortablePath(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`CONFIG_PATH_REQUIRED ${label}`);
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) throw new Error(`CONFIG_ABSOLUTE_PATH_FORBIDDEN ${label}=${value}`);
  if (value.replaceAll("\\", "/").split("/").includes("..")) throw new Error(`CONFIG_PATH_TRAVERSAL ${label}=${value}`);
}

function validatePathMap(values, label) {
  for (const [key, value] of Object.entries(values ?? {})) assertPortablePath(value, `${label}.${key}`);
}

export function validateConfig(config) {
  if (config.schema_version !== 1) throw new Error("CONFIG_SCHEMA_UNSUPPORTED");
  if (config.kind !== "local-harness" || config.mode !== "local-only") throw new Error("CONFIG_LOCAL_ONLY_REQUIRED");
  validatePathMap(config.paths, "paths");
  validatePathMap(config.files, "files");
  if (!config.planner?.profiles || !Object.keys(config.planner.profiles).length) throw new Error("CONFIG_PROFILES_REQUIRED");
  if (!Array.isArray(config.planner.non_bypassable_blocks)) throw new Error("CONFIG_NON_BYPASSABLE_BLOCKS_REQUIRED");
  if (config.runtime?.external_execution !== false) throw new Error("CONFIG_EXTERNAL_EXECUTION_MUST_BE_FALSE");
  if (!config.routing?.primary_agent) throw new Error("CONFIG_PRIMARY_AGENT_REQUIRED");
  return config;
}

export function loadWorkspace(root = findWorkspaceRoot()) {
  const resolvedRoot = path.resolve(root);
  const configFile = resolveWorkspacePath(resolvedRoot, "harness/config/local-harness.json");
  let config = validateConfig(readJson(configFile));
  const localOverride = config.local_override_file
    ? resolveWorkspacePath(resolvedRoot, config.local_override_file)
    : null;
  if (localOverride && fs.existsSync(localOverride)) {
    const override = readJson(localOverride);
    if (override.file_overrides) {
      validatePathMap(override.file_overrides, "local.file_overrides");
      config = merge(config, { files: override.file_overrides });
    }
    if (override.path_overrides) {
      for (const [key, value] of Object.entries(override.path_overrides)) assertPortablePath(value, `local.path_overrides.${key}`);
      config = merge(config, { paths: override.path_overrides });
    }
    if (override.runtime_overrides) config = merge(config, { runtime: override.runtime_overrides });
    const { file_overrides: _fileOverrides, path_overrides: _pathOverrides, runtime_overrides: _runtimeOverrides, ...settings } = override;
    config = validateConfig(merge(config, settings));
  }
  const paths = Object.fromEntries(Object.entries(config.paths).map(([key, value]) => [key, resolveWorkspacePath(resolvedRoot, value)]));
  const files = Object.fromEntries(Object.entries(config.files ?? {}).map(([key, value]) => [key, resolveWorkspacePath(resolvedRoot, value)]));
  return { root: resolvedRoot, config, paths, files };
}

export function readWorkspaceJson(workspace, relativePath) {
  return readJson(resolveWorkspacePath(workspace.root, relativePath));
}
