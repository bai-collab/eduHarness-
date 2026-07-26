#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_REGISTRY = path.join(ROOT, "harness", "config", "skill-registry.json");
export const REGISTRY_SCHEMA_VERSION = 2;
const PLATFORMS = ["claude", "codex"];
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HAN_PATTERN = /[\p{Script=Han}]/u;
const SIMPLIFIED_ONLY_PATTERN = /[汉语学术论证计划开发审归档转换写体网关软数码]/u;

export function readSkillRegistry(file = DEFAULT_REGISTRY) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizedRelative(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function resolveInside(root, relative) {
  const normalized = normalizedRelative(relative);
  if (!normalized || path.isAbsolute(normalized) || normalized.split("/").includes("..")) return null;
  const resolved = path.resolve(root, normalized);
  const prefix = `${path.resolve(root)}${path.sep}`.toLowerCase();
  if (!`${resolved}${path.sep}`.toLowerCase().startsWith(prefix)) return null;
  return resolved;
}

function isInside(root, candidate) {
  const base = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved.toLowerCase() === base.toLowerCase()
    || `${resolved}${path.sep}`.toLowerCase().startsWith(`${base}${path.sep}`.toLowerCase());
}

export function findActiveSkillProjectionTransactions(root = ROOT) {
  const transactionRoot = path.join(root, "scratch", "skill-projection-transactions");
  if (!fs.existsSync(transactionRoot)) return [];
  return fs.readdirSync(transactionRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(transactionRoot, entry.name))
    .filter(dir => {
      const journal = path.join(dir, "journal.json");
      if (!fs.existsSync(journal)) return false;
      try {
        const state = JSON.parse(fs.readFileSync(journal, "utf8")).state;
        return !["COMMITTED", "ROLLED_BACK"].includes(state);
      } catch {
        return true;
      }
    });
}

function walkFiles(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, list);
    else if (entry.isFile()) list.push(full);
  }
  return list;
}

export function hashSkillTree(dir) {
  const hash = crypto.createHash("sha256");
  const files = walkFiles(dir).map(full => ({ full, rel: path.relative(dir, full).replaceAll("\\", "/") })).sort((a, b) => a.rel.localeCompare(b.rel));
  for (const item of files) {
    const body = fs.readFileSync(item.full);
    hash.update(item.rel, "utf8");
    hash.update("\0");
    hash.update(String(body.length), "utf8");
    hash.update("\0");
    hash.update(body);
    hash.update("\0");
  }
  return hash.digest("hex").toUpperCase();
}

function readFrontmatterName(skillFile) {
  const text = fs.readFileSync(skillFile, "utf8");
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return null;
  return frontmatter[1].match(/^name:\s*([^\r\n]+)\s*$/m)?.[1]?.trim() ?? null;
}

function readVisibleTitle(skillFile) {
  const text = fs.readFileSync(skillFile, "utf8");
  return text.match(/^#\s+([^\r\n]+)\s*$/m)?.[1]?.trim() ?? null;
}

function readOpenAiDisplayName(canonicalDir) {
  const file = path.join(canonicalDir, "agents", "openai.yaml");
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const text = fs.readFileSync(file, "utf8");
  return text.match(/^\s*display_name:\s*"([^"]+)"\s*$/m)?.[1]?.trim() ?? null;
}

function validZhTwVisibleTitle(value) {
  return typeof value === "string" && value.trim() === value && value.length > 0 && HAN_PATTERN.test(value) && !SIMPLIFIED_ONLY_PATTERN.test(value);
}

function scanForbiddenKeys(value, at = "$", errors = []) {
  if (Array.isArray(value)) value.forEach((item, index) => scanForbiddenKeys(item, `${at}[${index}]`, errors));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/^(api_?key|token|access_?token|refresh_?token|credential|credentials|cookie|private_?key|auth_?value)$/i.test(key)) errors.push(`${at}.${key}: secret-bearing key forbidden`);
      scanForbiddenKeys(child, `${at}.${key}`, errors);
    }
  }
  return errors;
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) if (seen.has(value)) repeated.add(value); else seen.add(value);
  return [...repeated];
}

export function validateRegistryDefinition(registry, root = ROOT, { strictWorkspace = root === ROOT, ignoreTransactionFence = false } = {}) {
  const errors = [];
  const canonical = new Map();
  if (registry.schema_version !== REGISTRY_SCHEMA_VERSION) {
    errors.push(registry.schema_version === 1 ? "MIGRATION_REQUIRED registry schema v1 must be migrated to v2" : `unsupported schema_version (${registry.schema_version ?? "missing"})`);
  }
  if (registry.workspace !== undefined) errors.push("legacy workspace field is forbidden; use workspace_mode=repository-root");
  if (registry.workspace_mode !== "repository-root") errors.push("workspace_mode must be repository-root");
  const allowedTopLevel = new Set(["schema_version", "workspace_mode", "status", "policy", "projection_roots", "skills", "provider_owned_skills"]);
  for (const key of Object.keys(registry)) if (!allowedTopLevel.has(key)) errors.push(`unknown registry field: ${key}`);
  if (strictWorkspace && !ignoreTransactionFence && findActiveSkillProjectionTransactions(root).length) errors.push("SKILL_PROJECTION_TRANSACTION_ACTIVE use --recover before validation");
  const expectedPolicy = {
    projection_mode: "generated-mirror",
    auto_install_allowed: false,
    auto_import_allowed: false,
    generated_projection_edit_allowed: false,
    plugin_skill_copy_allowed: false,
    unknown_skill_action: "stop",
    hash_algorithm: "sha256-tree-v1",
    secrets_allowed: false,
    visible_title_locale: "zh-TW",
    openai_display_name_required: true
  };
  for (const [key, expected] of Object.entries(expectedPolicy)) if (registry.policy?.[key] !== expected) errors.push(`policy.${key} must be ${JSON.stringify(expected)}`);
  if (!Array.isArray(registry.skills) || !registry.skills.length) errors.push("skills must be a non-empty array");
  if (!Array.isArray(registry.provider_owned_skills)) errors.push("provider_owned_skills must be an array");
  errors.push(...scanForbiddenKeys(registry));
  if (errors.length || !Array.isArray(registry.skills)) return { errors, canonical };

  for (const value of duplicates(registry.skills.map(item => item.canonical_id))) errors.push(`duplicate canonical_id: ${value}`);
  for (const value of duplicates(registry.skills.map(item => normalizedRelative(item.canonical_path).toLowerCase()))) errors.push(`duplicate canonical_path: ${value}`);
  for (const platform of PLATFORMS) {
    const values = registry.skills.map(item => normalizedRelative(item.projections?.[platform]?.path).toLowerCase());
    for (const value of duplicates(values)) errors.push(`duplicate ${platform} projection path: ${value}`);
  }

  for (const skill of registry.skills) {
    const id = skill.canonical_id;
    if (!NAME_PATTERN.test(id ?? "")) { errors.push(`${id ?? "<missing>"}: invalid canonical_id`); continue; }
    if (skill.source !== "workspace-brain") errors.push(`${id}: source must be workspace-brain`);
    const canonicalDir = resolveInside(root, skill.canonical_path);
    if (!canonicalDir) { errors.push(`${id}: unsafe canonical_path`); continue; }
    const expectedRoot = resolveInside(root, registry.policy.canonical_root);
    if (!expectedRoot || !`${canonicalDir}${path.sep}`.toLowerCase().startsWith(`${expectedRoot}${path.sep}`.toLowerCase())) errors.push(`${id}: canonical_path outside canonical_root`);
    const skillFile = path.join(canonicalDir, "SKILL.md");
    if (!fs.existsSync(skillFile) || !fs.statSync(skillFile).isFile()) { errors.push(`${id}: canonical SKILL.md missing`); continue; }
    const frontmatterName = readFrontmatterName(skillFile);
    if (frontmatterName !== id) errors.push(`${id}: frontmatter name mismatch (${frontmatterName ?? "missing"})`);
    const displayTitle = skill.display_title_zh_tw;
    if (!validZhTwVisibleTitle(displayTitle)) errors.push(`${id}: display_title_zh_tw must be a Traditional Chinese visible title`);
    const visibleTitle = readVisibleTitle(skillFile);
    if (visibleTitle !== displayTitle) errors.push(`${id}: first H1 must equal display_title_zh_tw (${visibleTitle ?? "missing"})`);
    const openAiDisplayName = readOpenAiDisplayName(canonicalDir);
    if (openAiDisplayName !== displayTitle) errors.push(`${id}: agents/openai.yaml display_name must equal display_title_zh_tw (${openAiDisplayName ?? "missing"})`);
    const sha256 = hashSkillTree(canonicalDir);
    canonical.set(id, { dir: canonicalDir, sha256 });
    for (const platform of PLATFORMS) {
      const projection = skill.projections?.[platform];
      const projectionDir = resolveInside(root, projection?.path);
      const expectedProjectionRoot = resolveInside(root, registry.projection_roots?.[platform]);
      if (!projectionDir || !expectedProjectionRoot) errors.push(`${id}: unsafe ${platform} projection path/root`);
      else if (!`${projectionDir}${path.sep}`.toLowerCase().startsWith(`${expectedProjectionRoot}${path.sep}`.toLowerCase())) errors.push(`${id}: ${platform} projection outside projection_root`);
    }
  }

  const byHash = new Map();
  for (const [id, item] of canonical) {
    const prior = byHash.get(item.sha256);
    if (prior && prior !== id) errors.push(`different names share identical content: ${prior}, ${id}`);
    else byHash.set(item.sha256, id);
  }
  return { errors: [...new Set(errors)], canonical };
}

export function findUnmanagedProjectionSkills(registry, root = ROOT) {
  const unmanaged = [];
  for (const platform of PLATFORMS) {
    const projectionRoot = resolveInside(root, registry.projection_roots?.[platform]);
    if (!projectionRoot || !fs.existsSync(projectionRoot)) continue;
    const managed = new Set(registry.skills.map(skill => path.resolve(root, normalizedRelative(skill.projections?.[platform]?.path)).toLowerCase()));
    for (const entry of fs.readdirSync(projectionRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(projectionRoot, entry.name);
      if (fs.existsSync(path.join(full, "SKILL.md")) && !managed.has(full.toLowerCase())) unmanaged.push(`${platform}:${path.relative(root, full).replaceAll("\\", "/")}`);
    }
  }
  return unmanaged;
}

export function evaluateSkillRegistry(registry, root = ROOT, options = {}) {
  const { errors, canonical } = validateRegistryDefinition(registry, root, options);
  const blockers = [];
  if (errors.length) return { errors, blockers, skillCount: registry.skills?.length ?? 0, projectionCount: 0 };
  for (const value of findUnmanagedProjectionSkills(registry, root)) errors.push(`unmanaged projection: ${value}`);
  let projectionCount = 0;
  for (const skill of registry.skills) {
    const source = canonical.get(skill.canonical_id);
    if (skill.canonical_sha256 !== source.sha256) blockers.push(`${skill.canonical_id}: canonical registry hash stale or missing`);
    for (const platform of PLATFORMS) {
      projectionCount += 1;
      const projection = skill.projections[platform];
      const projectionDir = resolveInside(root, projection.path);
      if (!fs.existsSync(projectionDir) || !fs.existsSync(path.join(projectionDir, "SKILL.md"))) {
        blockers.push(`${skill.canonical_id}: ${platform} projection missing`);
        continue;
      }
      const actual = hashSkillTree(projectionDir);
      if (actual !== source.sha256) errors.push(`${skill.canonical_id}: ${platform} projection drift (${actual} != ${source.sha256})`);
      if (projection.sha256 !== actual || projection.status !== "projected") blockers.push(`${skill.canonical_id}: ${platform} registry state stale`);
    }
  }
  return { errors: [...new Set(errors)], blockers: [...new Set(blockers)], skillCount: registry.skills.length, projectionCount };
}

function testRegistry(root) {
  return {
    schema_version: REGISTRY_SCHEMA_VERSION,
    workspace_mode: "repository-root",
    status: "projection-required",
    policy: {
      canonical_root: "brain/skills",
      projection_mode: "generated-mirror",
      auto_install_allowed: false,
      auto_import_allowed: false,
      generated_projection_edit_allowed: false,
      plugin_skill_copy_allowed: false,
      unknown_skill_action: "stop",
      hash_algorithm: "sha256-tree-v1",
      secrets_allowed: false,
      visible_title_locale: "zh-TW",
      openai_display_name_required: true
    },
    projection_roots: { claude: ".claude/skills", codex: ".agents/skills" },
    skills: [{
      canonical_id: "sample-skill",
      display_title_zh_tw: "範例技能",
      canonical_path: "brain/skills/sample-skill",
      source: "workspace-brain",
      version: null,
      canonical_sha256: null,
      projections: {
        claude: { path: ".claude/skills/sample-skill", sha256: null, status: "missing" },
        codex: { path: ".agents/skills/sample-skill", sha256: null, status: "missing" }
      }
    }],
    provider_owned_skills: []
  };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-dedup-"));
  try {
    const source = path.join(root, "brain/skills/sample-skill");
    fs.mkdirSync(path.join(source, "agents"), { recursive: true });
    fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: sample-skill\ndescription: test\n---\n# 範例技能\n", "utf8");
    fs.writeFileSync(path.join(source, "agents/openai.yaml"), "interface:\n  display_name: \"範例技能\"\n  short_description: \"用於驗證技能投影與繁體中文可見標題\"\n  default_prompt: \"使用 $sample-skill 執行範例工作。\"\n", "utf8");
    const registry = testRegistry(root);
    const missing = evaluateSkillRegistry(registry, root, { strictWorkspace: false });
    if (missing.errors.length || missing.blockers.length !== 3) throw new Error("missing projection expectation failed");
    const sourceHash = hashSkillTree(source);
    registry.skills[0].canonical_sha256 = sourceHash;
    for (const platform of PLATFORMS) {
      const target = path.join(root, registry.skills[0].projections[platform].path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(source, target, { recursive: true });
      registry.skills[0].projections[platform].sha256 = sourceHash;
      registry.skills[0].projections[platform].status = "projected";
    }
    const ready = evaluateSkillRegistry(registry, root, { strictWorkspace: false });
    if (ready.errors.length || ready.blockers.length) throw new Error("ready projection expectation failed");
    fs.appendFileSync(path.join(root, ".claude/skills/sample-skill/SKILL.md"), "drift\n", "utf8");
    if (!evaluateSkillRegistry(registry, root, { strictWorkspace: false }).errors.some(error => error.includes("projection drift"))) throw new Error("projection drift was not rejected");
    const unsafe = structuredClone(registry);
    unsafe.policy.auto_install_allowed = true;
    if (!evaluateSkillRegistry(unsafe, root, { strictWorkspace: false }).errors.some(error => error.includes("auto_install_allowed"))) throw new Error("auto-install policy violation was not rejected");
    const englishTitle = structuredClone(registry);
    englishTitle.skills[0].display_title_zh_tw = "Sample Skill";
    if (!evaluateSkillRegistry(englishTitle, root, { strictWorkspace: false }).errors.some(error => error.includes("Traditional Chinese visible title"))) throw new Error("English-only visible title was not rejected");
    const legacy = structuredClone(registry);
    legacy.workspace = root;
    if (!evaluateSkillRegistry(legacy, root, { strictWorkspace: false }).errors.some(error => error.includes("legacy workspace field"))) throw new Error("legacy workspace was not rejected");
    const wrongRoot = path.join(root, "nested-clone");
    fs.mkdirSync(wrongRoot, { recursive: true });
    const portable = evaluateSkillRegistry(registry, wrongRoot, { strictWorkspace: false });
    if (!portable.errors.some(error => error.includes("canonical SKILL.md missing"))) throw new Error("missing nested clone fixture was not rejected");
    console.log("SKILL_DEDUP_SELF_TEST_OK");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    try { selfTest(); } catch (error) { console.error(error.message); process.exit(1); }
    process.exit(0);
  }

  const fileArg = args.find(arg => !arg.startsWith("--"));
  try {
    const registry = readSkillRegistry(fileArg ? path.resolve(fileArg) : DEFAULT_REGISTRY);
    const result = evaluateSkillRegistry(registry);
    if (result.errors.length) {
      console.error(result.errors.map(error => `SKILL_DEDUP_CONFLICT ${error}`).join("\n"));
      process.exit(1);
    }
    console.log("SKILL_DEDUP_POLICY_OK");
    if (result.blockers.length) {
      console.log(`SKILL_PROJECTION_BLOCKED unresolved=${result.blockers.length}`);
      for (const blocker of result.blockers) console.log(`- ${blocker}`);
      if (args.includes("--require-ready")) process.exit(2);
    } else {
      console.log(`SKILL_PROJECTION_READY skills=${result.skillCount} projections=${result.projectionCount}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
