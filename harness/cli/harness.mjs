import fs from "node:fs";
import { findWorkspaceRoot, toWorkspaceRelative } from "../core/root.mjs";
import { loadWorkspace } from "../core/config.mjs";
import { loadRegistry } from "../core/registry.mjs";
import { loadPlatformRegistry, loadRouteProfiles } from "../core/routes.mjs";
import { loadSkillRegistry } from "../core/skills.mjs";
import { buildPlan } from "../core/planner.mjs";
import { savePlan } from "../core/state.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positional(args) {
  return args.filter((value, index) => !value.startsWith("--") && args[index - 1] !== "--root");
}

function readMigrationCatalog(workspace) {
  const file = workspace.files?.migration_catalog;
  if (!file) throw new Error("CONFIG_FILE_MISSING migration_catalog");
  const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  if (catalog.schema_version !== 1 || catalog.kind !== "hybrid-skill-migration-catalog") throw new Error("MIGRATION_CATALOG_SCHEMA_INVALID");
  return catalog;
}

function usage() {
  console.log(`Usage:\n  node harness/cli/harness.mjs validate [--root <path>]\n  node harness/cli/harness.mjs blocks [--root <path>]\n  node harness/cli/harness.mjs skills [--root <path>]\n  node harness/cli/harness.mjs catalog [--root <path>]\n  node harness/cli/harness.mjs plan <task.json> [--root <path>] [--save]`);
}

const [command, ...args] = process.argv.slice(2);
try {
  const explicitRoot = option(args, "--root");
  const root = explicitRoot ? findWorkspaceRoot(explicitRoot) : findWorkspaceRoot(process.cwd());
  const workspace = loadWorkspace(root);
  if (command === "validate") {
    const registry = loadRegistry(workspace);
    const skills = loadSkillRegistry(workspace);
    const catalog = readMigrationCatalog(workspace);
    const platforms = loadPlatformRegistry(workspace);
    const routes = loadRouteProfiles(workspace);
    console.log(JSON.stringify({
      status: "ok",
      mode: workspace.config.mode,
      root: ".",
      blocks: registry.blocks.length,
      skills: skills.skills.length,
      skill_ids: skills.skills.map(skill => skill.id),
      migration_catalog: {
        common: catalog.sets.common.length,
        education_only: catalog.sets.education_only.length,
        portable_only: catalog.sets.portable_only.length,
        batches: catalog.batches.length
      },
      platforms: platforms.platforms.length,
      route_profiles: Object.keys(routes.profiles),
      paths: Object.fromEntries(Object.entries(workspace.paths).map(([key, value]) => [key, toWorkspaceRelative(root, value)])),
      files: Object.fromEntries(Object.entries(workspace.files).map(([key, value]) => [key, toWorkspaceRelative(root, value)]))
    }, null, 2));
  } else if (command === "blocks") {
    const registry = loadRegistry(workspace);
    console.log(JSON.stringify(registry.blocks, null, 2));
  } else if (command === "skills") {
    const skills = loadSkillRegistry(workspace);
    console.log(JSON.stringify(skills.skills, null, 2));
  } else if (command === "catalog") {
    console.log(JSON.stringify(readMigrationCatalog(workspace), null, 2));
  } else if (command === "plan") {
    const taskFile = positional(args)[0];
    if (!taskFile) throw new Error("TASK_FILE_REQUIRED");
    const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));
    const plan = await buildPlan(task, root);
    if (args.includes("--save")) console.error(`PLAN_SAVED ${toWorkspaceRelative(root, savePlan(workspace, plan))}`);
    console.log(JSON.stringify(plan, null, 2));
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
