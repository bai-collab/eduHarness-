export async function run(context) {
  const route = context.plan.artifacts.resolved_route;
  const dispatch = context.plan.artifacts.dispatch_plan;
  if (!route || !dispatch) return { status: "failed", summary: "Route and dispatch artifacts are required for reconciliation.", warnings: ["RECONCILE_INPUT_MISSING"] };
  const expected = new Set(route.nodes.map(node => node.id));
  const actual = new Set(dispatch.nodes.map(node => node.id));
  const missing = [...expected].filter(id => !actual.has(id));
  const nodeVerifiers = route.nodes.filter(node => node.verification.mode === "node").map(node => ({
    node_id: node.id,
    requested_platform: node.verification.requested_platform,
    requested_agent: node.verification.requested_agent,
    actual_platform: node.verifier.actual_platform
  }));
  const finalVerifier = route.verification_policy.final_verification === true;
  const errors = missing.map(id => `DISPATCH_NODE_MISSING ${id}`);
  return {
    status: errors.length ? "failed" : "ok",
    summary: errors.length ? "Route reconciliation failed." : "Route results and verification queue reconciled.",
    warnings: dispatch.deferred_nodes.length ? ["RECONCILE_HAS_DEFERRED_NODES"] : [],
    artifacts: {
      reconciliation: {
        expected_nodes: [...expected],
        dispatched_nodes: [...actual],
        missing_nodes: missing,
        errors
      },
      verification_queue: {
        mode: nodeVerifiers.length ? "node-and-final" : (finalVerifier ? "final" : "none"),
        node_verifiers: nodeVerifiers,
        final_verifier: finalVerifier,
        count: nodeVerifiers.length + (finalVerifier ? 1 : 0)
      }
    }
  };
}
