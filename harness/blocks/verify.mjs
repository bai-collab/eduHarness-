export async function run(context) {
  const errors = [];
  if (!context.plan.goal) errors.push("GOAL_MISSING");
  if (!context.plan.profile) errors.push("PROFILE_MISSING");
  if (!context.plan.artifacts.user_decision) errors.push("USER_AUTHORITY_RECORD_MISSING");
  if (!context.plan.artifacts.route_plan) errors.push("ROUTE_PLAN_MISSING");
  if (!context.plan.artifacts.platform_preflight) errors.push("PLATFORM_PREFLIGHT_MISSING");
  if (!context.plan.artifacts.dispatch_plan) errors.push("DISPATCH_PLAN_MISSING");
  if (!context.plan.artifacts.execution) errors.push("EXECUTION_RECORD_MISSING");
  if (context.plan.artifacts.reconciliation?.errors?.length) errors.push(...context.plan.artifacts.reconciliation.errors);
  const deferredNodes = context.plan.artifacts.dispatch_plan?.deferred_nodes ?? [];
  if (deferredNodes.length) errors.push(...deferredNodes.map(id => `UNRESOLVED_ROUTE_NODE ${id}`));
  const passed = errors.length === 0;
  const route = context.plan.artifacts.resolved_route ?? context.plan.artifacts.route_plan;
  const fallbackNodeVerifiers = route?.nodes?.filter(node => node.verification?.mode === "node").map(node => ({
    node_id: node.id,
    requested_platform: node.verification.requested_platform,
    requested_agent: node.verification.requested_agent,
    actual_platform: node.verifier?.actual_platform ?? node.verification.requested_platform
  })) ?? [];
  const fallbackFinalVerifier = route?.verification_policy?.final_verification === true;
  const queue = context.plan.artifacts.verification_queue ?? {
    mode: fallbackNodeVerifiers.length ? "node-and-final" : (fallbackFinalVerifier ? "final" : "none"),
    node_verifiers: fallbackNodeVerifiers,
    final_verifier: fallbackFinalVerifier,
    count: fallbackNodeVerifiers.length + (fallbackFinalVerifier ? 1 : 0)
  };
  return {
    status: passed ? "ok" : "failed",
    summary: passed ? "Local plan contract passed." : "Local plan contract failed.",
    warnings: passed ? [] : errors,
    artifacts: {
      verification: {
        passed,
        errors,
        verifier: "local-rule-tool",
        agent_verifier_queue: queue,
        note: queue.count === 0 ? "No independent agent verifier scheduled for this route." : "Verifier schedule was checked; platform execution evidence is required for task-level verification."
      }
    }
  };
}
