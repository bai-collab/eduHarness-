#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PROJECT = path.join(HERE, "project-skills.mjs");
const SOURCE_CHECK = path.join(HERE, "check-skill-dedup.mjs");
const POLICY = {
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
};

function treeHash(dir) {
  const hash = crypto.createHash("sha256");
  const walk = (current, relative = "") => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      const rel = path.join(relative, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) walk(full, rel);
      else {
        const body = fs.readFileSync(full);
        hash.update(rel).update("\0").update(String(body.length)).update("\0").update(body).update("\0");
      }
    }
  };
  walk(dir);
  return hash.digest("hex").toUpperCase();
}
function fixture(root) {
  const skill = path.join(root, "brain/skills/sample-skill");
  fs.mkdirSync(path.join(skill, "agents"), { recursive: true });
  fs.writeFileSync(path.join(skill, "SKILL.md"), "---\nname: sample-skill\ndescription: fixture\n---\n# 測試技能\n", "utf8");
  fs.writeFileSync(path.join(skill, "agents/openai.yaml"), "interface:\n  display_name: \"測試技能\"\n  short_description: \"交易測試\"\n  default_prompt: \"執行測試\"\n", "utf8");
  const hash = treeHash(skill);
  for (const projection of [".claude/skills/sample-skill", ".agents/skills/sample-skill"]) {
    fs.mkdirSync(path.dirname(path.join(root, projection)), { recursive: true });
    fs.cpSync(skill, path.join(root, projection), { recursive: true });
  }
  const registry = {
    schema_version: 2,
    workspace_mode: "repository-root",
    status: "projected",
    policy: POLICY,
    projection_roots: { claude: ".claude/skills", codex: ".agents/skills" },
    skills: [{
      canonical_id: "sample-skill",
      display_title_zh_tw: "測試技能",
      canonical_path: "brain/skills/sample-skill",
      source: "workspace-brain",
      version: null,
      canonical_sha256: hash,
      projections: {
        claude: { path: ".claude/skills/sample-skill", sha256: hash, status: "projected" },
        codex: { path: ".agents/skills/sample-skill", sha256: hash, status: "projected" }
      }
    }],
    provider_owned_skills: []
  };
  fs.mkdirSync(path.join(root, "harness/config"), { recursive: true });
  fs.writeFileSync(path.join(root, "harness/config/skill-registry.json"), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  fs.mkdirSync(path.join(root, "harness/scripts"), { recursive: true });
  fs.cpSync(SOURCE_PROJECT, path.join(root, "harness/scripts/project-skills.mjs"));
  fs.cpSync(SOURCE_CHECK, path.join(root, "harness/scripts/check-skill-dedup.mjs"));
}
function run(root, script, extra = [], env = {}) {
  const result = spawnSync(process.execPath, [path.join(root, "harness/scripts", script), ...extra], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
  return { ...result, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}
function projectionState(root) {
  return {
    claude: treeHash(path.join(root, ".claude/skills/sample-skill")),
    codex: treeHash(path.join(root, ".agents/skills/sample-skill")),
    registry: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "harness/config/skill-registry.json"))).digest("hex").toUpperCase()
  };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-projection-transaction-"));
try {
  fixture(root);
  const initialCheck = run(root, "check-skill-dedup.mjs", ["--require-ready"]);
  assert.equal(initialCheck.status, 0, `v2 fixture must be ready: ${initialCheck.output}`);
  assert.equal(run(root, "project-skills.mjs").status, 0, "preview must be read-only");

  const skillFile = path.join(root, "brain/skills/sample-skill/SKILL.md");
  fs.appendFileSync(skillFile, "更新一\n", "utf8");
  assert.notEqual(run(root, "project-skills.mjs", ["--apply"]).status, 0, "unapproved drift must be rejected");
  assert.equal(run(root, "project-skills.mjs", ["--apply", "--allow-update"]).status, 0, "approved update must commit");
  assert.equal(run(root, "check-skill-dedup.mjs", ["--require-ready"]).status, 0, "committed update must be ready");

  const beforeCrash = projectionState(root);
  fs.appendFileSync(skillFile, "更新二\n", "utf8");
  const crashed = run(root, "project-skills.mjs", ["--apply", "--allow-update"], { SKILL_PROJECTION_FAILPOINT: "after-backup" });
  assert.equal(crashed.status, 97, `hard-exit failpoint must be observable: ${crashed.output}`);
  assert.notEqual(run(root, "check-skill-dedup.mjs", ["--require-ready"]).status, 0, "active transaction must fence READY");
  const recovered = run(root, "project-skills.mjs", ["--recover"]);
  assert.equal(recovered.status, 0, `recover must restore before state: ${recovered.output}`);
  assert.deepEqual(projectionState(root), beforeCrash, "rollback must restore before hashes");
  assert.notEqual(run(root, "check-skill-dedup.mjs", ["--require-ready"]).status, 0, "source drift must remain visible after rollback");
  assert.equal(run(root, "project-skills.mjs", ["--apply", "--allow-update"]).status, 0, "follow-up update must reconcile source drift");
  assert.equal(run(root, "check-skill-dedup.mjs", ["--require-ready"]).status, 0, "reconciled fixture must be ready");

  const clone = fs.mkdtempSync(path.join(os.tmpdir(), "skill-projection-clone-"));
  fs.cpSync(root, clone, { recursive: true });
  fs.rmSync(path.join(clone, "scratch"), { recursive: true, force: true });
  assert.equal(run(clone, "check-skill-dedup.mjs", ["--require-ready"]).status, 0, "clone at another path must be ready");
  fs.rmSync(clone, { recursive: true, force: true });

  const registryFile = path.join(root, "harness/config/skill-registry.json");
  const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  registry.workspace = root;
  fs.writeFileSync(registryFile, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  assert.notEqual(run(root, "check-skill-dedup.mjs", ["--require-ready"]).status, 0, "legacy workspace must be rejected");
  console.log("SKILL_PROJECTION_TRANSACTION_TEST_OK");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
