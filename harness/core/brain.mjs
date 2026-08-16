import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveWorkspacePath, toWorkspaceRelative } from "./root.mjs";

const BRAIN_INDEX_SCHEMA = 2;
const DEFAULT_RESULT_LIMIT = 8;
const DEFAULT_STARTUP_MAX_CHARS = 6000;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assertPortableRelative(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`BRAIN_PATH_REQUIRED ${label}`);
  const normalized = value.replaceAll("\\", "/");
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) throw new Error(`BRAIN_ABSOLUTE_PATH_FORBIDDEN ${label}=${value}`);
  if (normalized.split("/").some(segment => segment === "..")) throw new Error(`BRAIN_PATH_TRAVERSAL ${label}=${value}`);
}

function isWithin(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  const prefix = `${base}${path.sep}`;
  return target === base || target.startsWith(prefix);
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) output.push(full);
    }
  };
  walk(root);
  return output.sort((a, b) => a.localeCompare(b));
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function frontmatterValue(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "mi"));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

function titleFor(content, file) {
  return frontmatterValue(content, "title")
    || frontmatterValue(content, "name")
    || content.match(/^#\s+(.+)$/m)?.[1]?.trim()
    || path.basename(file, path.extname(file));
}

function termsFor(query) {
  const raw = String(query ?? "").toLocaleLowerCase("zh-TW");
  const tokens = raw.split(/[^\p{L}\p{N}_-]+/u).filter(token => token.length >= 2);
  const cjk = [...raw].filter(char => /[\u3400-\u9fff]/u.test(char));
  return [...new Set([...tokens, ...cjk])];
}

function scoreText(text, terms) {
  const normalized = String(text).toLocaleLowerCase("zh-TW");
  let score = 0;
  for (const term of terms) {
    if (normalized.includes(term)) score += term.length > 1 ? 3 : 1;
  }
  return score;
}

function relativeNotePath(noteRoot, recordPath) {
  const normalized = String(recordPath ?? "").replaceAll("\\", "/");
  assertPortableRelative(normalized, "note_record.path");
  const file = path.resolve(noteRoot, normalized);
  if (!isWithin(noteRoot, file)) throw new Error(`BRAIN_NOTE_PATH_OUTSIDE_ROOT ${recordPath}`);
  return file;
}

export function validateBrainIndex(index) {
  if (!index || typeof index !== "object" || Array.isArray(index)) throw new Error("BRAIN_INDEX_OBJECT_REQUIRED");
  if (index.kind !== "local-brain-index") throw new Error("BRAIN_INDEX_KIND_INVALID");
  if (index.schema_version !== BRAIN_INDEX_SCHEMA) throw new Error(`BRAIN_INDEX_SCHEMA_UNSUPPORTED ${index.schema_version}`);
  if (index.portable !== true) throw new Error("BRAIN_INDEX_MUST_BE_PORTABLE");
  if (index.load_policy !== "on-demand") throw new Error("BRAIN_INDEX_LOAD_POLICY_INVALID");
  if (!index.paths || typeof index.paths !== "object") throw new Error("BRAIN_INDEX_PATHS_REQUIRED");
  for (const [key, value] of Object.entries(index.paths)) assertPortableRelative(value, `paths.${key}`);
  if (!Array.isArray(index.collections) || index.collections.length === 0) throw new Error("BRAIN_COLLECTIONS_REQUIRED");
  const pathKeys = new Set(Object.keys(index.paths));
  const collectionIds = new Set();
  for (const collection of index.collections) {
    if (!collection?.id || collectionIds.has(collection.id)) throw new Error(`BRAIN_COLLECTION_ID_INVALID ${collection?.id ?? ""}`);
    collectionIds.add(collection.id);
    if (!pathKeys.has(collection.path_key)) throw new Error(`BRAIN_COLLECTION_PATH_KEY_INVALID ${collection.id}`);
    if (collection.load === "") throw new Error(`BRAIN_COLLECTION_LOAD_INVALID ${collection.id}`);
    for (const key of ["index", "manifest", "record_index", "content_root"]) {
      if (collection[key] !== undefined) assertPortableRelative(collection[key], `collections.${collection.id}.${key}`);
    }
    if (collection.sync_scripts !== undefined) {
      if (!Array.isArray(collection.sync_scripts)) throw new Error(`BRAIN_COLLECTION_SYNC_SCRIPTS_INVALID ${collection.id}`);
      for (const script of collection.sync_scripts) assertPortableRelative(script, `collections.${collection.id}.sync_scripts`);
    }
  }
  return index;
}

export function loadBrainIndex(workspace) {
  const file = workspace.paths.brain_index;
  if (!fs.existsSync(file)) return { status: "deferred", file, index: null, paths: {}, warnings: ["BRAIN_INDEX_UNAVAILABLE"] };
  const index = validateBrainIndex(readJson(file));
  const paths = Object.fromEntries(Object.entries(index.paths).map(([key, value]) => [key, resolveWorkspacePath(workspace.root, value)]));
  return { status: "ok", file, index, paths, warnings: [] };
}

function collectionsById(brain) {
  return new Map((brain.index?.collections ?? []).map(collection => [collection.id, collection]));
}

function collectionRoot(workspace, brain, collection) {
  return brain.paths[collection.path_key] ?? resolveWorkspacePath(workspace.root, brain.index.paths[collection.path_key]);
}

function loadNoteRecords(workspace, brain, collection) {
  const base = collectionRoot(workspace, brain, collection);
  const recordIndex = collection.record_index ? path.resolve(base, collection.record_index) : null;
  if (!recordIndex || !isWithin(base, recordIndex) || !fs.existsSync(recordIndex)) return { records: [], source: null, warning: "NOTE_RECORD_INDEX_UNAVAILABLE" };
  const records = [];
  for (const line of fs.readFileSync(recordIndex, "utf8").split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record.path) records.push({ ...record, absolutePath: relativeNotePath(path.resolve(base, collection.content_root ?? "mirror/notes"), String(record.path).replace(/^notes[\\/]/u, "")) });
    } catch {
      return { records: [], source: toWorkspaceRelative(workspace.root, recordIndex), warning: "NOTE_RECORD_INDEX_INVALID" };
    }
  }
  return { records, source: toWorkspaceRelative(workspace.root, recordIndex), warning: null };
}

export function inspectBrain(workspace) {
  const brain = loadBrainIndex(workspace);
  if (brain.status !== "ok") return { status: brain.status, warnings: brain.warnings, source: null, collections: [] };
  const collections = [];
  for (const collection of brain.index.collections) {
    const root = collectionRoot(workspace, brain, collection);
    const files = walkFiles(root);
    const entry = {
      id: collection.id,
      kind: collection.kind,
      load: collection.load,
      path: toWorkspaceRelative(workspace.root, root),
      exists: fs.existsSync(root),
      files: files.length,
      markdown_files: files.filter(file => path.extname(file).toLowerCase() === ".md").length
    };
    if (collection.id === "note_library") {
      const manifestFile = collection.manifest ? path.resolve(root, collection.manifest) : null;
      const manifest = manifestFile && isWithin(root, manifestFile) && fs.existsSync(manifestFile) ? readJson(manifestFile) : null;
      const noteRecords = loadNoteRecords(workspace, brain, collection);
      entry.note_count = manifest?.noteCount ?? noteRecords.records.length;
      entry.record_count = noteRecords.records.length;
      entry.index = collection.index && fs.existsSync(path.resolve(root, collection.index));
      entry.manifest = Boolean(manifest);
      entry.mirror = fs.existsSync(path.resolve(root, collection.content_root ?? "mirror/notes"));
      entry.sync_scripts = (collection.sync_scripts ?? []).map(script => ({
        path: script,
        exists: fs.existsSync(resolveWorkspacePath(workspace.root, script))
      }));
      if (noteRecords.warning) entry.warning = noteRecords.warning;
    }
    collections.push(entry);
  }
  return {
    status: "ok",
    source: toWorkspaceRelative(workspace.root, brain.file),
    load_policy: brain.index.load_policy,
    collections,
    warnings: brain.warnings
  };
}

export function readBrainDocument(workspace, relativePath, { maxChars = 20000 } = {}) {
  assertPortableRelative(relativePath, "document");
  const brain = loadBrainIndex(workspace);
  if (brain.status !== "ok") throw new Error("BRAIN_INDEX_UNAVAILABLE");
  const candidate = resolveWorkspacePath(workspace.root, relativePath);
  const allowedRoots = brain.index.collections.map(collection => collectionRoot(workspace, brain, collection));
  if (!allowedRoots.some(root => isWithin(root, candidate))) throw new Error(`BRAIN_DOCUMENT_OUTSIDE_COLLECTION ${relativePath}`);
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) throw new Error(`BRAIN_DOCUMENT_NOT_FOUND ${relativePath}`);
  const raw = fs.readFileSync(candidate, "utf8");
  return {
    path: toWorkspaceRelative(workspace.root, candidate),
    sha256: sha256File(candidate),
    truncated: raw.length > maxChars,
    content: raw.slice(0, maxChars)
  };
}

function searchMarkdownCollection(workspace, brain, collection, terms) {
  const root = collectionRoot(workspace, brain, collection);
  return walkFiles(root)
    .filter(file => path.extname(file).toLowerCase() === ".md")
    .map(file => {
      const content = fs.readFileSync(file, "utf8");
      const relative = toWorkspaceRelative(workspace.root, file);
      const title = titleFor(content, file);
      const score = scoreText(`${relative}\n${title}\n${content.slice(0, 6000)}`, terms);
      return { collection: collection.id, path: relative, title, score, source: "brain-markdown" };
    })
    .filter(item => item.score > 0);
}

export function searchBrain(workspace, query, { limit = DEFAULT_RESULT_LIMIT } = {}) {
  const brain = loadBrainIndex(workspace);
  if (brain.status !== "ok") return { status: brain.status, results: [], warnings: brain.warnings };
  const terms = termsFor(query);
  if (!terms.length) return { status: "ok", query: String(query ?? ""), results: [], warnings: [] };
  const byId = collectionsById(brain);
  const results = [];
  for (const collection of brain.index.collections) {
    if (["skills", "note_library"].includes(collection.id)) continue;
    results.push(...searchMarkdownCollection(workspace, brain, collection, terms));
  }
  const notes = byId.get("note_library");
  if (notes) {
    const indexed = loadNoteRecords(workspace, brain, notes);
    const base = collectionRoot(workspace, brain, notes);
    for (const record of indexed.records) {
      const score = scoreText(`${record.title ?? ""}\n${record.category ?? ""}\n${(record.tags ?? []).join(" ")}\n${record.url ?? ""}`, terms);
      if (score > 0) {
        results.push({
          collection: "note_library",
          path: toWorkspaceRelative(workspace.root, record.absolutePath),
          title: record.title ?? path.basename(record.path),
          category: record.category,
          tags: record.tags ?? [],
          url: record.url ?? "",
          score,
          source: "note-index",
          index: toWorkspaceRelative(workspace.root, path.resolve(base, "mirror/notes/index.jsonl"))
        });
      }
    }
  }
  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return { status: "ok", query: String(query ?? ""), results: results.slice(0, limit), warnings: [] };
}

export function loadBrainContext(workspace, task = {}) {
  const brain = loadBrainIndex(workspace);
  if (brain.status !== "ok") return { status: brain.status, summary: "Brain index is unavailable; continue with explicit task input.", warnings: brain.warnings, artifact: { loaded: false } };
  const byId = collectionsById(brain);
  const startup = [];
  const instincts = byId.get("instincts");
  if (instincts) {
    const root = collectionRoot(workspace, brain, instincts);
    for (const file of walkFiles(root).filter(file => path.extname(file).toLowerCase() === ".md")) {
      const raw = fs.readFileSync(file, "utf8");
      startup.push({ path: toWorkspaceRelative(workspace.root, file), content: raw.slice(0, DEFAULT_STARTUP_MAX_CHARS), truncated: raw.length > DEFAULT_STARTUP_MAX_CHARS });
    }
  }
  const query = [task.goal, task.brain_query, task.context_query].filter(Boolean).join(" ");
  const matches = searchBrain(workspace, query, { limit: Number(task.user_directives?.brain_result_limit ?? DEFAULT_RESULT_LIMIT) }).results;
  const requestedPaths = task.brain_read_paths ?? task.user_directives?.brain_read_paths ?? [];
  if (!Array.isArray(requestedPaths)) throw new Error("BRAIN_READ_PATHS_ARRAY_REQUIRED");
  const requestedDocuments = requestedPaths.map(relativePath => readBrainDocument(workspace, relativePath));
  const inspection = inspectBrain(workspace);
  return {
    status: "ok",
    summary: "Loaded the Brain index, startup instincts, and task-matched candidates on demand.",
    warnings: inspection.warnings ?? [],
    artifact: {
      loaded: true,
      source: toWorkspaceRelative(workspace.root, brain.file),
      load_policy: brain.index.load_policy,
      startup_instincts: startup,
      query,
      matches,
      requested_documents: requestedDocuments,
      collections: inspection.collections
    }
  };
}
