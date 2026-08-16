import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveWorkspacePath, toWorkspaceRelative } from "./root.mjs";
import { inspectBrain, loadBrainIndex } from "./brain.mjs";

const COPY_GROUPS = [
  { id: "knowledge", source: "brain/knowledge-base", destination: "brain/knowledge", required: true },
  { id: "experience", source: "brain/experience", destination: "brain/experience", required: true },
  { id: "error_log", source: "brain/errorLog", destination: "brain/error-log", required: true },
  { id: "instincts", source: "brain/instincts", destination: "brain/instincts", required: true },
  { id: "reference_support", source: "references/ai-design-style-reference.md", destination: "references/ai-design-style-reference.md", required: false },
  { id: "note_library", source: "references/line-notes", destination: "references/line-notes", required: false }
];

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function isWithin(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  const prefix = `${base}${path.sep}`;
  return target === base || target.startsWith(prefix);
}

function listSourceFiles(root, { skipNoteMirror = false } = {}) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const full = path.join(current, entry.name);
      if (skipNoteMirror && path.relative(root, full).split(path.sep)[0] === "mirror") continue;
      if (entry.isSymbolicLink()) throw new Error(`BRAIN_MIGRATION_SYMLINK_UNSUPPORTED ${full}`);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  walk(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function sourcePathFor(root, file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function destinationFor(workspaceRoot, relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (path.isAbsolute(normalized) || normalized.split("/").includes("..")) throw new Error(`BRAIN_MIGRATION_DESTINATION_INVALID ${relativePath}`);
  return resolveWorkspacePath(workspaceRoot, normalized);
}

function collectItems(sourceRoot, workspaceRoot, { includeNoteMirror = false } = {}) {
  const items = [];
  const missing = [];
  for (const group of COPY_GROUPS) {
    const source = path.resolve(sourceRoot, group.source);
    if (!fs.existsSync(source)) {
      if (group.required) missing.push(group.source);
      continue;
    }
    const stat = fs.statSync(source);
    const files = stat.isFile()
      ? [source]
      : listSourceFiles(source, { skipNoteMirror: group.id === "note_library" && !includeNoteMirror });
    for (const file of files) {
      const relativeWithinGroup = stat.isFile() ? "" : sourcePathFor(source, file);
      const destinationPath = stat.isFile() ? group.destination : path.posix.join(group.destination, relativeWithinGroup.replaceAll("\\", "/"));
      const destination = destinationFor(workspaceRoot, destinationPath);
      if (!isWithin(workspaceRoot, destination)) throw new Error(`BRAIN_MIGRATION_DESTINATION_OUTSIDE_ROOT ${destinationPath}`);
      items.push({
        group: group.id,
        source_path: path.posix.join(group.source, relativeWithinGroup).replaceAll("\\", "/"),
        destination_path: destinationPath.replaceAll("\\", "/"),
        source_file: file,
        destination_file: destination,
        source_sha256: sha256File(file),
        bytes: fs.statSync(file).size
      });
    }
  }
  if (missing.length) throw new Error(`BRAIN_MIGRATION_REQUIRED_SOURCE_MISSING ${missing.join(",")}`);
  return items;
}

function previousManifestByDestination(workspaceRoot) {
  const file = resolveWorkspacePath(workspaceRoot, "brain/migration-manifest.json");
  if (!fs.existsSync(file)) return new Map();
  try {
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    return new Map((manifest.items ?? []).map(item => [item.destination_path, item]));
  } catch {
    return new Map();
  }
}

function preflightConflicts(items, workspaceRoot) {
  const conflicts = [];
  const previous = previousManifestByDestination(workspaceRoot);
  for (const item of items) {
    if (!fs.existsSync(item.destination_file)) continue;
    if (!fs.statSync(item.destination_file).isFile()) {
      conflicts.push({ path: item.destination_path, reason: "destination-not-file" });
      continue;
    }
    const destinationHash = sha256File(item.destination_file);
    if (destinationHash !== item.source_sha256) {
      const prior = previous.get(item.destination_path);
      if (prior?.adapted === true && prior.source_sha256 === item.source_sha256 && prior.destination_sha256 === destinationHash) {
        item.adapted = true;
        item.adaptations = prior.adaptations ?? [];
        continue;
      }
      conflicts.push({ path: item.destination_path, reason: "hash-drift", destination_sha256: destinationHash, source_sha256: item.source_sha256 });
    }
  }
  return conflicts;
}

export function planBrainMigration({ sourceRoot, workspaceRoot, includeNoteMirror = false }) {
  if (!sourceRoot) throw new Error("BRAIN_MIGRATION_SOURCE_REQUIRED");
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(workspaceRoot);
  const items = collectItems(source, destination, { includeNoteMirror });
  const conflicts = preflightConflicts(items, destination);
  return {
    schema_version: 1,
    kind: "portable-brain-migration-plan",
    portable: true,
    source: { workspace_label: "legacy-workspace", root_policy: "provided-at-invocation", brain_relative: "brain", note_library_relative: "references/line-notes" },
    destination: { root: ".", workspace_relative: true },
    mapping: Object.fromEntries(COPY_GROUPS.map(group => [group.id, { source: group.source, destination: group.destination }])) ,
    include_note_mirror: includeNoteMirror,
    item_count: items.length,
    bytes: items.reduce((sum, item) => sum + item.bytes, 0),
    conflicts,
    items: items.map(({ source_file: _sourceFile, destination_file: _destinationFile, ...item }) => item)
  };
}

export function applyBrainMigration({ sourceRoot, workspaceRoot, includeNoteMirror = false }) {
  const plan = planBrainMigration({ sourceRoot, workspaceRoot, includeNoteMirror });
  if (plan.conflicts.length) throw new Error(`BRAIN_MIGRATION_CONFLICT ${JSON.stringify(plan.conflicts)}`);
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(workspaceRoot);
  const applied = [];
  const rawItems = collectItems(source, destination, { includeNoteMirror });
  const conflicts = preflightConflicts(rawItems, destination);
  if (conflicts.length) throw new Error(`BRAIN_MIGRATION_CONFLICT ${JSON.stringify(conflicts)}`);
  for (const item of rawItems) {
    if (!fs.existsSync(item.destination_file)) {
      fs.mkdirSync(path.dirname(item.destination_file), { recursive: true });
      fs.copyFileSync(item.source_file, item.destination_file);
      applied.push({ ...item, status: "copied", destination_sha256: sha256File(item.destination_file) });
    } else {
      applied.push({ ...item, status: "already-present", destination_sha256: sha256File(item.destination_file) });
    }
  }
  const manifest = {
    schema_version: 1,
    kind: "portable-brain-migration-manifest",
    portable: true,
    generated_at: new Date().toISOString(),
    source: { workspace_label: "legacy-workspace", root_policy: "provided-at-invocation", brain_relative: "brain", note_library_relative: "references/line-notes" },
    destination: { root: ".", workspace_relative: true },
    mapping: plan.mapping,
    include_note_mirror: includeNoteMirror,
    counts: {
      items: applied.length,
      copied: applied.filter(item => item.status === "copied").length,
      already_present: applied.filter(item => item.status === "already-present").length,
      bytes: applied.reduce((sum, item) => sum + item.bytes, 0)
    },
    items: applied.map(({ source_file: _sourceFile, destination_file: _destinationFile, ...item }) => item)
  };
  const manifestFile = resolveWorkspacePath(destination, "brain/migration-manifest.json");
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, plan, manifest_file: toWorkspaceRelative(destination, manifestFile) };
}

function inspectCurrentBrain(workspace) {
  const errors = [];
  const brain = loadBrainIndex(workspace);
  if (brain.status !== "ok") errors.push(...brain.warnings);
  const inspection = inspectBrain(workspace);
  if (inspection.status !== "ok") errors.push(...(inspection.warnings ?? []));
  return { errors, inspection };
}

function noManifestResult(workspace) {
  const state = inspectCurrentBrain(workspace);
  return {
    status: state.errors.length ? "failed" : "not-applicable",
    errors: state.errors,
    checks: [],
    manifest: null,
    reason: "migration-manifest-not-present",
    inspection: state.inspection
  };
}

export function verifyBrainMigration(workspace) {
  const manifestFile = workspace.paths.brain_migration_manifest
    ?? resolveWorkspacePath(workspace.root, "brain/migration-manifest.json");
  if (!fs.existsSync(manifestFile)) return noManifestResult(workspace);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const errors = [];
  const checks = [];
  if (manifest.kind !== "portable-brain-migration-manifest" || manifest.portable !== true) errors.push("BRAIN_MIGRATION_MANIFEST_INVALID");
  const serialized = JSON.stringify(manifest);
  if (/[A-Za-z]:[\\/]/u.test(serialized)) errors.push("BRAIN_MIGRATION_MANIFEST_HAS_ABSOLUTE_PATH");
  for (const item of manifest.items ?? []) {
    try {
      const destination = resolveWorkspacePath(workspace.root, item.destination_path);
      if (!fs.existsSync(destination)) {
        errors.push(`BRAIN_MIGRATION_DESTINATION_MISSING ${item.destination_path}`);
        continue;
      }
      const actual = sha256File(destination);
      if (actual !== item.destination_sha256 || (!item.adapted && actual !== item.source_sha256)) errors.push(`BRAIN_MIGRATION_HASH_MISMATCH ${item.destination_path}`);
      checks.push({ path: item.destination_path, status: "ok", sha256: actual });
    } catch (error) {
      errors.push(error.message);
    }
  }
  const state = inspectCurrentBrain(workspace);
  errors.push(...state.errors);
  return {
    status: errors.length ? "failed" : "ok",
    errors,
    checks,
    manifest: toWorkspaceRelative(workspace.root, manifestFile),
    inspection: state.inspection
  };
}