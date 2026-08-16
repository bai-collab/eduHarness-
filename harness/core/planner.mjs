import crypto from "node:crypto";
import { loadWorkspace } from "./config.mjs";
import { blockEntry, loadBlock, loadRegistry } from "./registry.mjs";
import { loadSkillRegistry } from "./skills.mjs";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function complexityFor(task, config) {
  const requested = task.user_directives?.profile ?? task.profile;
  if (requested && requested !== "adaptive") return requested;
  const risk = String(task.risk ?? "low").toLowerCase();
  const signals = [
    risk === "high" || risk === "critical",
    task.ambiguity === true,
    task.source_conflict === true,
    task.irreversible === true,
    Number(task.steps ?? 0) >= 5,
    asArray(task.reasoning?.hypotheses).length >= 2
  ];
  if (signals.filter(Boolean).length >= 2) return "complex";
  if (signals.some(Boolean) || task.reasoning_needed === true) return "standard";
  return config.planner.default_profile === "adaptive" ? "simple" : config.planner.default_profile;
}

function taskId(task) {
  return task.task_id ?? `task-${crypto.randomUUID()}`;
}

function chooseBlocks(task, config, registry, profile) {
  const requested = task.user_directives?.blocks ?? task.plan?.blocks;
  const base = requested ?? config.planner.profiles[profile]?.blocks;
  if (!Array.isArray(base) || !base.length) throw new Error(`PROFILE_BLOCKS_MISSING ${profile}`);
  const ids = [...base];
  for (const id of asArray(task.user_directives?.add_blocks)) if (!ids.includes(id)) ids.push(id);
  for (const id of asArray(task.user_directives?.skip_blocks)) {
    const entry = registry.blocks.find(block => block.id === id);
    if (!entry) throw new Error(`USER_BLOCK_NOT_REGISTERED ${id}`);
    if (!entry.optional) throw new Error(`USER_CANNOT_SKIP_NON_OPTIONAL_BLOCK ${id}`);
  }
  const filtered = ids.filter(id => !asArray(task.user_directives?.skip_blocks).includes(id));
  const order = asArray(config.planner.order);
  for (const id of config.planner.non_bypassable_blocks) if (!filtered.includes(id)) {
    const targetOrder = order.indexOf(id);
    let insertion = filtered.length;
    if (targetOrder >= 0) {
      const next = filtered.findIndex(existing => {
        const existingOrder = order.indexOf(existing);
        return existingOrder >= 0 && existingOrder > targetOrder;
      });
      if (next >= 0) insertion = next;
    }
    filtered.splice(insertion, 0, id);
  }
  return filtered;
}

function worstStatus(statuses) {
  if (statuses.includes("stopped_by_user")) return "stopped_by_user";
  if (statuses.includes("awaiting_user")) return "awaiting_user";
  if (statuses.includes("failed")) return "blocked";
  if (statuses.includes("deferred")) return "ready_with_deferred";
  return "planned";
}

export async function buildPlan(task, root) {
  if (!task || typeof task !== "object" || Array.isArray(task)) throw new Error("TASK_OBJECT_REQUIRED");
  if (typeof task.goal !== "string" || task.goal.trim() === "") throw new Error("TASK_GOAL_REQUIRED");

  const workspace = loadWorkspace(root);
  const registry = loadRegistry(workspace);
  const skillRegistry = loadSkillRegistry(workspace);
  const profile = complexityFor(task, workspace.config);
  if (!workspace.config.planner.profiles[profile]) throw new Error(`PROFILE_NOT_FOUND ${profile}`);
  const blockIds = chooseBlocks(task, workspace.config, registry, profile);
  const plan = {
    schema_version: 1,
    plan_type: "local-harness-plan",
    plan_id: `plan-${crypto.randomUUID()}`,
    task_id: taskId(task),
    created_at: new Date().toISOString(),
    workspace_root: ".",
    mode: "local-only",
    profile,
    goal: task.goal,
    user_authority: "final",
    model_role: "advisory",
    requested_blocks: blockIds,
    blocks: [],
    artifacts: {},
    warnings: [],
    status: "planning"
  };
  const context = { workspace, registry, skillRegistry, config: workspace.config, paths: workspace.paths, task, profile, plan };
  const statuses = [];
  for (const id of blockIds) {
    const entry = blockEntry(registry, id);
    const skip = asArray(task.user_directives?.skip_blocks).includes(id);
    if (skip) {
      plan.blocks.push({ id, phase: entry.phase, status: "skipped", reason: "user_directive" });
      statuses.push("skipped");
      continue;
    }
    const run = await loadBlock(workspace, entry);
    if (!run) {
      plan.blocks.push({ id, phase: entry.phase, status: "deferred", reason: "optional_block_unavailable" });
      statuses.push("deferred");
      continue;
    }
    const result = await run(context);
    const normalized = { id, phase: entry.phase, ...result };
    plan.blocks.push(normalized);
    if (result.artifacts && typeof result.artifacts === "object") Object.assign(plan.artifacts, result.artifacts);
    if (result.warnings) plan.warnings.push(...result.warnings);
    statuses.push(result.status ?? "ok");
    if (["stopped_by_user", "awaiting_user", "failed"].includes(result.status)) break;
  }
  plan.status = worstStatus(statuses);
  plan.completed_at = new Date().toISOString();
  return plan;
}
