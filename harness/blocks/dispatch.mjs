function topologicalOrder(nodes) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  function visit(node) {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) throw new Error(`DISPATCH_CYCLE_DETECTED ${node.id}`);
    visiting.add(node.id);
    for (const dependency of node.depends_on ?? []) {
      const dependencyNode = byId.get(dependency);
      if (!dependencyNode) throw new Error(`DISPATCH_DEPENDENCY_MISSING ${node.id}->${dependency}`);
      visit(dependencyNode);
    }
    visiting.delete(node.id);
    visited.add(node.id);
    ordered.push(node);
  }
  for (const node of nodes) visit(node);
  return ordered;
}

export async function run(context) {
  const route = context.plan.artifacts.resolved_route;
  if (!route) return { status: "failed", summary: "Resolved route is required before dispatch.", warnings: ["RESOLVED_ROUTE_MISSING"] };
  const skillNodes = new Map((context.plan.artifacts.skill_resolution?.nodes ?? []).map(node => [node.id, node]));
  const nodes = topologicalOrder(route.nodes).map(node => {
    const skill = skillNodes.get(node.id)?.skill ?? null;
    return {
      id: node.id,
      depends_on: node.depends_on,
      objective: node.objective,
      requested: node.requested,
      actual: node.actual,
      skill,
      verification: node.verification,
      preflight: node.preflight,
      status: node.actual && skill?.status !== "deferred" ? "prepared" : "deferred",
      mode: "plan-only"
    };
  });
  const deferred = nodes.filter(node => node.status === "deferred");
  return {
    status: deferred.length ? "deferred" : "ok",
    summary: deferred.length ? "Dispatch plan contains unresolved nodes." : "Dispatch topology prepared; no task operation was executed.",
    warnings: deferred.map(node => `DISPATCH_DEFERRED ${node.id}${node.skill?.status === "deferred" ? "_SKILL" : ""}`),
    artifacts: {
      dispatch_plan: {
        mode: "plan-only",
        user_authorized: context.plan.artifacts.user_decision?.execution_allowed === true,
        nodes,
        deferred_nodes: deferred.map(node => node.id),
        executed: false
      }
    }
  };
}
