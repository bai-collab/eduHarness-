import { loadPlatformRegistry, loadRouteProfiles } from "../core/routes.mjs";
import { resolveSkillPlan } from "../core/skills.mjs";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function routeInput(task) {
  return task.user_directives?.route ?? task.route ?? task.plan?.route ?? {};
}

function inferNodes(task, route, primaryAgent) {
  if (list(route.nodes).length) return { source: "task.route.nodes", nodes: route.nodes };
  if (Array.isArray(task.steps) && task.steps.length) return { source: "task.steps", nodes: task.steps };
  return {
    source: "inferred-single-node",
    nodes: [{
      id: "primary-work",
      objective: task.goal,
      platform: route.platform ?? task.execution?.platform ?? primaryAgent,
      agent: route.agent ?? primaryAgent,
      role: route.role ?? "executor",
      risk: task.risk ?? "low"
    }]
  };
}

function rawNodeId(node, index) {
  return typeof node === "string" ? `step-${index + 1}` : (node?.id ?? `step-${index + 1}`);
}

function rawNodeSkill(node) {
  if (typeof node === "string" || !node) return null;
  return node.skill ?? node.skill_id ?? null;
}

function normalizeNode(node, index, previousId, primaryAgent, policy, task) {
  const source = typeof node === "string" ? { objective: node } : (node ?? {});
  const id = source.id ?? `step-${index + 1}`;
  const platform = source.platform ?? source.requested_platform ?? task.execution?.platform ?? primaryAgent;
  const agent = source.agent ?? source.requested_agent ?? platform;
  const role = source.role ?? "executor";
  const risk = String(source.risk ?? task.risk ?? "low").toLowerCase();
  const dependsOn = Array.isArray(source.depends_on) ? [...source.depends_on] : (previousId ? [previousId] : []);
  const explicitVerification = source.verification?.mode ?? source.verifier?.mode ?? null;
  const explicit = explicitVerification !== null;
  let mode = explicitVerification ?? policy.default_verification;
  if (mode === "node-or-final") {
    mode = source.verification?.required === true || source.verifier?.required === true || ["high", "critical"].includes(risk) || platform !== primaryAgent
      ? "node"
      : "final";
  }
  if (!["none", "final", "node", "escalate"].includes(mode)) mode = "final";
  return {
    id,
    objective: String(source.objective ?? source.goal ?? id),
    depends_on: dependsOn,
    requested: {
      platform,
      agent,
      role,
      capability: source.capability ?? (role === "verifier" ? "verification" : role === "architecture" ? "architecture" : "execution")
    },
    fallback: source.fallback ?? primaryAgent,
    risk,
    verification: {
      mode,
      explicit,
      requested_platform: source.verification?.platform ?? source.verifier?.platform ?? primaryAgent,
      requested_agent: source.verification?.agent ?? source.verifier?.agent ?? "verifier"
    }
  };
}

function assertGraph(nodes) {
  const ids = new Set();
  const graph = new Map();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`ROUTE_NODE_DUPLICATE ${node.id}`);
    ids.add(node.id);
    graph.set(node.id, node.depends_on);
  }
  for (const node of nodes) for (const dependency of node.depends_on) if (!ids.has(dependency)) throw new Error(`ROUTE_DEPENDENCY_MISSING ${node.id}->${dependency}`);
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`ROUTE_CYCLE_DETECTED ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id)) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
}

function applyVerifierBudget(nodes, policy, warnings) {
  let remaining = Number.isInteger(policy.max_node_verifiers) ? policy.max_node_verifiers : 0;
  for (const node of nodes) {
    if (node.verification.mode !== "node") continue;
    if (node.verification.explicit || remaining > 0) {
      if (!node.verification.explicit) remaining -= 1;
      continue;
    }
    node.verification.mode = policy.final_verification ? "final" : "none";
    warnings.push(`VERIFIER_BUDGET_MOVED_TO_FINAL ${node.id}`);
  }
}

export async function run(context) {
  const platformRegistry = loadPlatformRegistry(context.workspace);
  const routeProfiles = loadRouteProfiles(context.workspace);
  const policy = routeProfiles.profiles[context.profile] ?? routeProfiles.profiles[routeProfiles.default_profile] ?? {};
  const route = routeInput(context.task);
  const primaryAgent = route.primary_agent ?? context.task.user_directives?.primary_agent ?? context.config.routing.primary_agent ?? platformRegistry.primary_agent;
  const inferred = inferNodes(context.task, route, primaryAgent);
  const rawIds = inferred.nodes.map(rawNodeId);
  const explicitGraph = inferred.nodes.some(node => typeof node !== "string" && Array.isArray(node?.depends_on));
  const nodeSkillRequests = inferred.nodes.map(rawNodeSkill);
  const nodes = inferred.nodes.map((node, index) => normalizeNode(node, index, explicitGraph ? null : (index ? rawIds[index - 1] : null), primaryAgent, policy, context.task));
  assertGraph(nodes);
  const warnings = [];
  if (inferred.source === "inferred-single-node") warnings.push("ROUTE_STEPS_INFERRED_SINGLE_NODE");
  applyVerifierBudget(nodes, policy, warnings);
  const skillResolution = resolveSkillPlan(context, route, nodes, nodeSkillRequests);
  const nodeVerifierIds = nodes.filter(node => node.verification.mode === "node").map(node => node.id);
  return {
    status: "ok",
    summary: "Created an editable route topology before execution.",
    warnings,
    artifacts: {
      skill_resolution: skillResolution,
      route_plan: {
        schema_version: 1,
        source: inferred.source,
        status: "draft",
        primary_agent: primaryAgent,
        fallback_policy: route.fallback_policy ?? context.config.routing.fallback_policy,
        optimization: list(route.optimization).length ? route.optimization : ["user-authority", "success", "risk", "latency"],
        nodes,
        verification_policy: {
          default_mode: policy.default_verification ?? "final",
          max_node_verifiers: policy.max_node_verifiers ?? 0,
          final_verification: policy.final_verification !== false,
          scheduled_node_verifiers: nodeVerifierIds
        },
        user_editable: true
      }
    }
  };
}
