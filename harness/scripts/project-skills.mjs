#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_REGISTRY,
  REGISTRY_SCHEMA_VERSION,
  ROOT,
  evaluateSkillRegistry,
  findActiveSkillProjectionTransactions,
  findUnmanagedProjectionSkills,
  hashSkillTree,
  readSkillRegistry,
  validateRegistryDefinition
} from "./check-skill-dedup.mjs";

const PLATFORMS = ["claude", "codex"];
const EXPECTED_PROJECTION_ROOTS = { claude: ".claude/skills", codex: ".agents/skills" };
const TRANSACTION_ROOT_NAME = path.join("scratch", "skill-projection-transactions");
const LOCK_RELATIVE = path.join("scratch", "skill-projection.lock");
const args = process.argv.slice(2);

function stamp() { return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z"); }
function normalizedRelative(value) { return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, ""); }
function absolute(root, relative) { return path.resolve(root, normalizedRelative(relative).replaceAll("/", path.sep)); }
function isInside(root, candidate) {
  const base = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved.toLowerCase() === base.toLowerCase()
    || `${resolved}${path.sep}`.toLowerCase().startsWith(`${base}${path.sep}`.toLowerCase());
}
function safeRelative(relative) {
  const normalized = normalizedRelative(relative);
  return Boolean(normalized) && !path.isAbsolute(normalized) && !normalized.split("/").includes("..");
}
function relativeFrom(root, candidate) {
  const relative = normalizedRelative(path.relative(root, candidate));
  if (!safeRelative(relative)) throw new Error(`unsafe repository path: ${relative}`);
  return relative;
}
function ensureTarget(root, relative, kind) {
  if (!safeRelative(relative)) throw new Error(`unsafe ${kind} path: ${relative}`);
  const target = absolute(root, relative);
  if (!isInside(root, target)) throw new Error(`unsafe ${kind} path escape: ${relative}`);
  return target;
}
function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}
function hashPath(target) {
  if (!fs.existsSync(target)) return null;
  const stat = fs.lstatSync(target);
  if (stat.isDirectory()) return hashSkillTree(target);
  if (stat.isFile()) return hashFile(target);
  throw new Error(`unsupported target type: ${target}`);
}
function snapshotPath(target) {
  if (!fs.existsSync(target)) return { exists: false, type: "missing", hash: null };
  const stat = fs.lstatSync(target);
  const type = stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other";
  if (type === "other") throw new Error(`unsupported target type: ${target}`);
  return { exists: true, type, hash: hashPath(target) };
}
function sameSnapshot(left, right) {
  return left.exists === right.exists && left.type === right.type && left.hash === right.hash;
}
function writeJsonAtomic(file, value) {
  const temp = `${file}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, file);
}
function readJournal(file) {
  const journal = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!journal || journal.schema_version !== 1 || !journal.transaction_id || !Array.isArray(journal.targets)) {
    throw new Error(`invalid transaction journal: ${file}`);
  }
  return journal;
}
function transactionRoot(root) { return path.join(root, TRANSACTION_ROOT_NAME); }
function lockPath(root) { return path.join(root, LOCK_RELATIVE); }
function activeTransactions(root) {
  return findActiveSkillProjectionTransactions(root).map(dir => ({ dir, journalFile: path.join(dir, "journal.json") }));
}
function acquireLock(root, transactionId, { recovery = false } = {}) {
  const lock = lockPath(root);
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try {
    const fd = fs.openSync(lock, "wx");
    fs.writeFileSync(fd, `${JSON.stringify({ schema_version: 1, transaction_id: transactionId, pid: process.pid, created_at: new Date().toISOString() })}\n`, "utf8");
    fs.closeSync(fd);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let owner = null;
    try { owner = JSON.parse(fs.readFileSync(lock, "utf8")); } catch { /* keep the original lock error */ }
    if (!(recovery && owner?.transaction_id === transactionId)) {
      throw new Error(`SKILL_PROJECTION_LOCKED ${owner?.transaction_id ?? "unknown"}`);
    }
    fs.rmSync(lock, { force: true });
    const fd = fs.openSync(lock, "wx");
    fs.writeFileSync(fd, `${JSON.stringify({ schema_version: 1, transaction_id: transactionId, pid: process.pid, recovered_at: new Date().toISOString() })}\n`, "utf8");
    fs.closeSync(fd);
  }
  return () => { try { fs.rmSync(lock, { force: true }); } catch { /* best effort release */ } };
}
function failpoint(name) {
  if (process.env.SKILL_PROJECTION_FAILPOINT === name) process.exit(97);
}
function setState(journal, file, state) {
  journal.state = state;
  journal.updated_at = new Date().toISOString();
  writeJsonAtomic(file, journal);
}
function targetDefinitions(root, registryFile, registry) {
  for (const platform of PLATFORMS) {
    if (normalizedRelative(registry.projection_roots?.[platform]) !== EXPECTED_PROJECTION_ROOTS[platform]) {
      throw new Error(`${platform} projection_root must be ${EXPECTED_PROJECTION_ROOTS[platform]}`);
    }
  }
  return [
    { id: "claude", relative: EXPECTED_PROJECTION_ROOTS.claude, kind: "directory" },
    { id: "codex", relative: EXPECTED_PROJECTION_ROOTS.codex, kind: "directory" },
    { id: "registry", relative: relativeFrom(root, registryFile), kind: "file" }
  ].map(item => ({ ...item, target: ensureTarget(root, item.relative, item.kind) }));
}
function validateRegistryFile(root, registryFile) {
  if (!isInside(root, registryFile)) throw new Error("--registry must stay inside repository root");
  return readSkillRegistry(registryFile);
}
function validateNoActiveTransaction(root) {
  const active = activeTransactions(root);
  if (active.length) throw new Error(`SKILL_PROJECTION_RECOVERY_REQUIRED ${active.map(item => path.basename(item.dir)).join(",")} use --recover`);
}
function copyExistingDirectory(source, target) {
  if (!fs.existsSync(source)) { fs.mkdirSync(target, { recursive: true }); return; }
  if (!fs.statSync(source).isDirectory()) throw new Error(`expected directory: ${source}`);
  fs.cpSync(source, target, { recursive: true });
}
function buildCandidate(root, transactionDir, registryFile, updated, skills) {
  const candidate = path.join(transactionDir, "candidate");
  fs.mkdirSync(candidate, { recursive: true });
  copyExistingDirectory(path.join(root, "brain", "skills"), path.join(candidate, "brain", "skills"));
  for (const platform of PLATFORMS) {
    copyExistingDirectory(path.join(root, EXPECTED_PROJECTION_ROOTS[platform]), path.join(candidate, EXPECTED_PROJECTION_ROOTS[platform]));
  }
  for (const skill of skills) {
    const sourceDir = absolute(root, skill.canonical_path);
    for (const platform of PLATFORMS) {
      const targetDir = absolute(candidate, skill.projections[platform].path);
      fs.rmSync(targetDir, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(targetDir), { recursive: true });
      fs.cpSync(sourceDir, targetDir, { recursive: true });
    }
  }
  const candidateRegistry = path.join(candidate, relativeFrom(root, registryFile));
  fs.mkdirSync(path.dirname(candidateRegistry), { recursive: true });
  writeJsonAtomic(candidateRegistry, updated);
  return { candidate, candidateRegistry };
}
function expectedCandidateState(candidate, target) {
  return snapshotPath(path.join(candidate, target.relative));
}
function validateResult(result, label) {
  if (result.errors.length || result.blockers.length) {
    throw new Error(`${label}: ${[...result.errors, ...result.blockers].join("; ")}`);
  }
}
function restoreTarget(target, backup, before, candidate) {
  const current = snapshotPath(target);
  if (current.hash && current.hash !== before.hash && current.hash !== candidate.hash) {
    throw new Error(`rollback target drift: ${target}`);
  }
  const backupExists = fs.existsSync(backup);
  if (before.exists) {
    if (!backupExists) {
      if (sameSnapshot(current, before)) return;
      throw new Error(`rollback backup missing: ${backup}`);
    }
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(backup, target);
  } else {
    fs.rmSync(target, { recursive: true, force: true });
    if (backupExists) throw new Error(`unexpected backup for missing target: ${backup}`);
  }
}
function rollbackTransaction(root, journalFile, journal) {
  journal.state = "ROLLING_BACK";
  writeJsonAtomic(journalFile, journal);
  try {
    for (const entry of [...journal.targets].reverse()) {
      const target = ensureTarget(root, entry.relative, entry.kind);
      const backup = ensureTarget(path.dirname(journalFile), path.join("backup", entry.relative), entry.kind);
      restoreTarget(target, backup, entry.before, entry.candidate);
      entry.rollback_applied = true;
      writeJsonAtomic(journalFile, journal);
    }
    for (const entry of journal.targets) {
      const target = ensureTarget(root, entry.relative, entry.kind);
      if (!sameSnapshot(snapshotPath(target), entry.before)) throw new Error(`rollback hash mismatch: ${entry.relative}`);
    }
    setState(journal, journalFile, "ROLLED_BACK");
  } catch (error) {
    journal.recovery_error = error.message;
    setState(journal, journalFile, "RECOVERY_REQUIRED");
    throw error;
  }
}
function recoverOne(root, item) {
  const journal = readJournal(item.journalFile);
  const release = acquireLock(root, journal.transaction_id, { recovery: true });
  try {
    rollbackTransaction(root, item.journalFile, journal);
    const registryFile = ensureTarget(root, journal.registry_relative, "registry");
    const result = evaluateSkillRegistry(readSkillRegistry(registryFile), root, { strictWorkspace: true });
    if (result.errors.length || result.blockers.length) {
      console.log(`SKILL_PROJECTION_RECOVERED transaction=${journal.transaction_id} validation=BLOCKED`);
      console.log(`RECOVERY_REQUIRES_FOLLOW_UP ${[...result.errors, ...result.blockers].join("; ")}`);
    } else {
      console.log(`SKILL_PROJECTION_RECOVERED transaction=${journal.transaction_id} validation=READY`);
    }
  } finally {
    release();
  }
}

function run() {
  const apply = args.includes("--apply");
  const recover = args.includes("--recover");
  const allowUpdate = args.includes("--allow-update");
  const registryIndex = args.indexOf("--registry");
  const registryFile = registryIndex >= 0 ? path.resolve(args[registryIndex + 1] ?? "") : DEFAULT_REGISTRY;
  if (recover && apply) throw new Error("--recover and --apply are mutually exclusive");
  if (recover) {
    const active = activeTransactions(ROOT);
    if (active.length !== 1) throw new Error(`expected exactly one recoverable transaction, found ${active.length}`);
    recoverOne(ROOT, active[0]);
    return;
  }
  validateNoActiveTransaction(ROOT);
  const registry = validateRegistryFile(ROOT, registryFile);
  const definition = validateRegistryDefinition(registry, ROOT, { strictWorkspace: true });
  if (definition.errors.length) throw new Error(definition.errors.map(error => `SKILL_REGISTRY_INVALID ${error}`).join("\n"));
  const unmanaged = findUnmanagedProjectionSkills(registry, ROOT);
  if (unmanaged.length) throw new Error(unmanaged.map(value => `SKILL_DEDUP_CONFLICT unmanaged projection: ${value}`).join("\n"));
  const targets = targetDefinitions(ROOT, registryFile, registry);
  const actions = [];
  const conflicts = [];
  const updated = structuredClone(registry);
  for (const skill of updated.skills) {
    const sourceDir = absolute(ROOT, skill.canonical_path);
    const sourceHash = hashSkillTree(sourceDir);
    skill.canonical_sha256 = sourceHash;
    for (const platform of PLATFORMS) {
      const projection = skill.projections[platform];
      const targetDir = absolute(ROOT, projection.path);
      if (!fs.existsSync(targetDir)) actions.push({ type: "create", platform, id: skill.canonical_id, sourceDir, targetDir, sourceHash });
      else {
        const actualHash = hashSkillTree(targetDir);
        if (actualHash === sourceHash) actions.push({ type: "reuse", platform, id: skill.canonical_id, sourceDir, targetDir, sourceHash });
        else if (allowUpdate && projection.sha256 && projection.sha256 === actualHash) actions.push({ type: "update", platform, id: skill.canonical_id, sourceDir, targetDir, sourceHash });
        else conflicts.push(`${skill.canonical_id}: ${platform} target differs; ${projection.sha256 && projection.sha256 === actualHash ? "rerun with explicit --allow-update" : "target is unverified or manually changed"}`);
      }
      skill.projections[platform].sha256 = sourceHash;
      skill.projections[platform].status = "projected";
    }
  }
  if (conflicts.length) throw new Error(conflicts.map(value => `SKILL_DEDUP_CONFLICT ${value}`).join("\n"));
  updated.status = "projected";
  for (const action of actions) console.log(`${apply ? "APPLY" : "PLAN"} ${action.type.toUpperCase()} ${action.platform}:${action.id}`);
  if (!apply) {
    console.log(`SKILL_PROJECTION_PLAN skills=${updated.skills.length} actions=${actions.length}`);
    console.log("NO_CHANGES_USE_--apply");
    return;
  }

  const transactionId = `${stamp()}-${process.pid}`;
  const txDir = path.join(transactionRoot(ROOT), transactionId);
  const journalFile = path.join(txDir, "journal.json");
  const release = acquireLock(ROOT, transactionId);
  let journal = null;
  try {
    fs.mkdirSync(txDir, { recursive: true });
    const before = targets.map(target => ({ ...target, before: snapshotPath(target.target) }));
    const staged = buildCandidate(ROOT, txDir, registryFile, updated, updated.skills);
    const candidateRoot = staged.candidate;
    const candidateRegistry = path.join(candidateRoot, relativeFrom(ROOT, registryFile));
    const candidateResult = evaluateSkillRegistry(readSkillRegistry(candidateRegistry), candidateRoot, { strictWorkspace: true });
    validateResult(candidateResult, "candidate validation");
    const targetEntries = before.map(target => ({
      id: target.id,
      relative: target.relative,
      kind: target.kind,
      before: target.before,
      candidate: expectedCandidateState(candidateRoot, target),
      intent: null,
      backup_applied: false,
      install_applied: false,
      rollback_applied: false
    }));
    journal = {
      schema_version: 1,
      transaction_id: transactionId,
      registry_relative: relativeFrom(ROOT, registryFile),
      state: "PREPARED",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      targets: targetEntries
    };
    writeJsonAtomic(journalFile, journal);
    const current = targets.map(target => snapshotPath(target.target));
    before.forEach((entry, index) => { if (!sameSnapshot(entry.before, current[index])) throw new Error(`DRIFT_DETECTED before switch: ${entry.relative}`); });
    setState(journal, journalFile, "SWITCHING");
    for (const entry of journal.targets) {
      const target = ensureTarget(ROOT, entry.relative, entry.kind);
      const backup = ensureTarget(txDir, path.join("backup", entry.relative), entry.kind);
      const candidate = ensureTarget(txDir, path.join("candidate", entry.relative), entry.kind);
      entry.intent = "backup";
      writeJsonAtomic(journalFile, journal);
      if (fs.existsSync(target)) {
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.renameSync(target, backup);
      }
      failpoint("after-backup");
      entry.backup_applied = true;
      writeJsonAtomic(journalFile, journal);
      entry.intent = "install";
      writeJsonAtomic(journalFile, journal);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(candidate, target);
      failpoint("after-install");
      entry.install_applied = true;
      writeJsonAtomic(journalFile, journal);
    }
    setState(journal, journalFile, "VERIFYING");
    const finalRegistry = readSkillRegistry(registryFile);
    const finalResult = evaluateSkillRegistry(finalRegistry, ROOT, { strictWorkspace: true, ignoreTransactionFence: true });
    validateResult(finalResult, "final validation");
    setState(journal, journalFile, "COMMITTED");
    console.log(`SKILL_PROJECTION_APPLIED skills=${finalResult.skillCount} projections=${finalResult.projectionCount}`);
    console.log(`SKILL_PROJECTION_READY transaction=${transactionId}`);
  } catch (error) {
    if (journal && journal.state !== "COMMITTED") {
      try { rollbackTransaction(ROOT, journalFile, journal); } catch (rollbackError) { error = new Error(`${error.message}; rollback failed: ${rollbackError.message}`); }
    } else if (!journal) {
      fs.rmSync(txDir, { recursive: true, force: true });
    }
    throw error;
  } finally {
    release();
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  try { run(); } catch (error) { console.error(error.message); process.exit(1); }
}

export { run };
