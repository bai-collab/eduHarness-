#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_REGISTRY,
  ROOT,
  evaluateSkillRegistry,
  findUnmanagedProjectionSkills,
  hashSkillTree,
  readSkillRegistry,
  validateRegistryDefinition
} from "./check-skill-dedup.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allowUpdate = args.includes("--allow-update");
const registryIndex = args.indexOf("--registry");
const registryFile = registryIndex >= 0 ? path.resolve(args[registryIndex + 1] ?? "") : DEFAULT_REGISTRY;
const platforms = ["claude", "codex"];

function absolute(relative) { return path.resolve(ROOT, relative.replaceAll("/", path.sep)); }
function stamp() { return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z"); }

try {
  const registry = readSkillRegistry(registryFile);
  const definition = validateRegistryDefinition(registry);
  if (definition.errors.length) throw new Error(definition.errors.map(error => `SKILL_REGISTRY_INVALID ${error}`).join("\n"));
  const unmanaged = findUnmanagedProjectionSkills(registry);
  if (unmanaged.length) throw new Error(unmanaged.map(value => `SKILL_DEDUP_CONFLICT unmanaged projection: ${value}`).join("\n"));

  const actions = [];
  const conflicts = [];
  const updated = structuredClone(registry);
  for (const skill of updated.skills) {
    const sourceDir = absolute(skill.canonical_path);
    const sourceHash = hashSkillTree(sourceDir);
    skill.canonical_sha256 = sourceHash;
    for (const platform of platforms) {
      const projection = skill.projections[platform];
      const targetDir = absolute(projection.path);
      if (!fs.existsSync(targetDir)) {
        actions.push({ type: "create", platform, id: skill.canonical_id, sourceDir, targetDir, sourceHash, projection });
        continue;
      }
      const actualHash = hashSkillTree(targetDir);
      if (actualHash === sourceHash) {
        actions.push({ type: "reuse", platform, id: skill.canonical_id, sourceDir, targetDir, sourceHash, projection });
        continue;
      }
      const knownGenerated = projection.sha256 && projection.sha256 === actualHash;
      if (allowUpdate && knownGenerated) actions.push({ type: "update", platform, id: skill.canonical_id, sourceDir, targetDir, sourceHash, projection });
      else conflicts.push(`${skill.canonical_id}: ${platform} target differs; ${knownGenerated ? "rerun with explicit --allow-update" : "target is unverified or manually changed"}`);
    }
  }
  if (conflicts.length) throw new Error(conflicts.map(value => `SKILL_DEDUP_CONFLICT ${value}`).join("\n"));

  for (const action of actions) console.log(`${apply ? "APPLY" : "PLAN"} ${action.type.toUpperCase()} ${action.platform}:${action.id}`);
  if (!apply) {
    console.log(`SKILL_PROJECTION_PLAN skills=${updated.skills.length} actions=${actions.length}`);
    console.log("NO_CHANGES_USE_--apply");
    process.exit(0);
  }

  const backupRoot = path.join(ROOT, "scratch", "skill-projection-backups", stamp());
  for (const action of actions) {
    if (action.type === "create") {
      fs.mkdirSync(path.dirname(action.targetDir), { recursive: true });
      const temp = `${action.targetDir}.tmp-${process.pid}`;
      if (fs.existsSync(temp)) throw new Error(`temporary target already exists: ${temp}`);
      fs.cpSync(action.sourceDir, temp, { recursive: true });
      fs.renameSync(temp, action.targetDir);
    } else if (action.type === "update") {
      const backup = path.join(backupRoot, action.platform, action.id);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.renameSync(action.targetDir, backup);
      const temp = `${action.targetDir}.tmp-${process.pid}`;
      fs.cpSync(action.sourceDir, temp, { recursive: true });
      fs.renameSync(temp, action.targetDir);
      console.log(`BACKUP ${path.relative(ROOT, backup).replaceAll("\\", "/")}`);
    }
    action.projection.sha256 = action.sourceHash;
    action.projection.status = "projected";
  }
  updated.status = "projected";
  fs.writeFileSync(registryFile, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  const verification = evaluateSkillRegistry(updated);
  if (verification.errors.length || verification.blockers.length) throw new Error([...verification.errors, ...verification.blockers].join("\n"));
  console.log(`SKILL_PROJECTION_APPLIED skills=${verification.skillCount} projections=${verification.projectionCount}`);
  console.log("SKILL_PROJECTION_READY");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
