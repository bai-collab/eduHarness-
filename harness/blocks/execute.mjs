export async function run(context) {
  const dispatch = context.plan.artifacts.dispatch_plan;
  if (dispatch) {
    const deferred = dispatch.deferred_nodes ?? [];
    return {
      status: deferred.length ? "deferred" : "ok",
      summary: deferred.length
        ? "Prepared the route but left unresolved nodes deferred."
        : "Prepared the approved route; arbitrary shell execution is disabled by default.",
      warnings: deferred.map(id => `EXECUTION_DEFERRED ${id}`),
      artifacts: {
        execution: {
          mode: "local-only",
          adapter: context.config.runtime.default_adapter,
          route_mode: dispatch.mode,
          status: deferred.length ? "deferred" : "prepared",
          executed: false,
          nodes_prepared: dispatch.nodes.filter(node => node.status === "prepared").map(node => node.id),
          deferred_nodes: deferred,
          next: "A runtime adapter may execute only an explicitly approved task operation."
        }
      }
    };
  }
  const requested = context.task.user_directives?.adapter ?? context.task.execution?.adapter ?? context.config.runtime.default_adapter;
  const available = context.config.runtime.adapters.includes(requested);
  if (!available) {
    return {
      status: "deferred",
      summary: `Local adapter is not enabled: ${requested}`,
      warnings: [`ADAPTER_UNAVAILABLE ${requested}`],
      artifacts: { execution: { mode: "local-only", adapter: requested, status: "deferred", executed: false } }
    };
  }
  return {
    status: "ok",
    summary: "Prepared a local execution step; arbitrary shell execution is disabled by default.",
    artifacts: {
      execution: {
        mode: "local-only",
        adapter: requested,
        status: "prepared",
        executed: false,
        next: "A runtime adapter may execute only an explicitly approved task operation."
      }
    }
  };
}
