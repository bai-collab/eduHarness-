import fs from "node:fs";
import path from "node:path";

export const MARKER = path.join("harness", "config", "local-harness.json");

function hasMarker(root) {
  const marker = path.join(root, MARKER);
  return fs.existsSync(marker) && fs.statSync(marker).isFile();
}

function assertRoot(root) {
  const resolved = path.resolve(root);
  if (!hasMarker(resolved)) throw new Error(`HARNESS_ROOT_INVALID ${resolved}`);
  return resolved;
}

export function findWorkspaceRoot(start = process.cwd()) {
  const explicit = process.env.HARNESS_ROOT;
  if (explicit) return assertRoot(explicit);

  let current = path.resolve(start);
  while (true) {
    if (hasMarker(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`HARNESS_ROOT_NOT_FOUND marker=${MARKER} start=${path.resolve(start)}`);
}

export function resolveWorkspacePath(root, input, { allowAbsolute = false } = {}) {
  if (typeof input !== "string" || input.trim() === "") throw new Error("WORKSPACE_PATH_REQUIRED");
  const value = input.trim();
  const looksAbsolute = path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value);
  if (looksAbsolute) {
    if (!allowAbsolute) throw new Error(`ABSOLUTE_PORTABLE_PATH_FORBIDDEN ${value}`);
    return path.resolve(value);
  }
  const normalized = value.replaceAll("\\", "/");
  if (normalized.split("/").some(segment => segment === "..")) {
    throw new Error(`WORKSPACE_PATH_TRAVERSAL ${value}`);
  }
  const workspace = path.resolve(root);
  const resolved = path.resolve(workspace, value);
  const prefix = `${workspace}${path.sep}`;
  if (resolved !== workspace && !resolved.startsWith(prefix)) {
    throw new Error(`WORKSPACE_PATH_OUTSIDE_ROOT ${value}`);
  }
  return resolved;
}

export function toWorkspaceRelative(root, absolutePath) {
  const workspace = path.resolve(root);
  const resolved = path.resolve(absolutePath);
  const prefix = `${workspace}${path.sep}`;
  if (resolved !== workspace && !resolved.startsWith(prefix)) {
    throw new Error(`WORKSPACE_PATH_OUTSIDE_ROOT ${absolutePath}`);
  }
  return path.relative(workspace, resolved).replaceAll(path.sep, "/") || ".";
}

