import { findPlatform, loadPlatformRegistry, platformSummary, probePlatform } from "../core/routes.mjs";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function run(context) {
  const route = context.plan.artifacts.route_plan;
  if (!route) return { status: "failed", summary: "Route plan is required before platform preflight.", warnings: ["ROUTE_PLAN_MISSING"] };
  const registry = loadPlatformRegistry(context.workspace);
  const primaryId = route.primary_agent ?? context.config.routing.primary_agent ?? registry.primary_agent;
  const requestedIds = unique([
    primaryId,
    ...route.nodes.map(node => node.requested.platform),
    ...route.nodes.map(node => node.fallback),
    ...route.nodes.map(node => node.verification.requested_platform)
  ]);
  const checks = [];
  const cache = new Map();
  async function check(id) {
    if (!cache.has(id)) {
      const platform = findPlatform(registry, id);
      const result = await probePlatform(context.workspace, platform, { task: context.task, plan: context.plan, config: context.config });
      cache.set(id, { id, platform, result });
    }
    return cache.get(id);
  }
  async function resolve(id, fallbackId, capability) {
    const requested = await check(id);
    const requestedCapabilities = requested.result.capabilities ?? requested.platform?.capabilities ?? [];
    const requestedReady = requested.result.status === "ready" && (!capability || requestedCapabilities.includes(capability));
    if (requestedReady) return { selected: requested, fallback_used: false, status: "ready", reason: "REQUESTED_PLATFORM_READY" };
    const fallback = await check(fallbackId);
    const fallbackCapabilities = fallback.result.capabilities ?? fallback.platform?.capabilities ?? [];
    const fallbackReady = fallback.result.status === "ready" && (!capability || fallbackCapabilities.includes(capability));
    if (fallbackReady) return { selected: fallback, fallback_used: true, status: "fallback", reason: requested.result.reason ?? "REQUESTED_PLATFORM_UNAVAILABLE" };
    return { selected: null, fallback_used: false, status: "deferred", reason: "NO_READY_PLATFORM" };
  }
  for (const id of requestedIds) {
    const item = await check(id);
    checks.push({
      platform: item.platform ? platformSummary(context.workspace, item.platform) : { id, enabled: false },
      status: item.result.status,
      reason: item.result.reason ?? item.result.summary ?? null,
      capabilities: item.result.capabilities ?? item.platform?.capabilities ?? []
    });
  }
  const resolvedNodes = [];
  const warnings = [];
  const deferred = [];
  for (const node of route.nodes) {
    const requested = await check(node.requested.platform);
    const resolved = await resolve(node.requested.platform, node.fallback ?? primaryId, node.requested.capability);
    let selected = resolved.selected;
    let fallbackUsed = resolved.fallback_used;
    let resolutionReason = resolved.reason;
    if (!selected) {
      deferred.push(node.id);
      selected = { id: null, platform: null, result: { status: "deferred", reason: "FALLBACK_PLATFORM_UNAVAILABLE" } };
      resolutionReason = "NO_READY_PLATFORM";
    }
    if (fallbackUsed) warnings.push(`PLATFORM_FALLBACK ${node.id}: ${node.requested.platform} -> ${selected.id}`);
    const verifierResolution = node.verification.mode === "none"
      ? { selected: null, fallback_used: false, status: "none", reason: "VERIFIER_NOT_SCHEDULED" }
      : await resolve(node.verification.requested_platform, primaryId, "verification");
    if (node.verification.mode !== "none" && !verifierResolution.selected) deferred.push(`${node.id}:verifier`);
    if (node.verification.mode !== "none" && verifierResolution.fallback_used) warnings.push(`VERIFIER_FALLBACK ${node.id}: ${node.verification.requested_platform} -> ${verifierResolution.selected.id}`);
    resolvedNodes.push({
      ...node,
      actual: selected.platform ? {
        platform: selected.id,
        agent: fallbackUsed ? selected.id : node.requested.agent,
        role: node.requested.role
      } : null,
      preflight: {
        status: resolved.status,
        reason: resolutionReason,
        fallback_used: fallbackUsed,
        requested_platform: node.requested.platform,
        fallback_platform: node.fallback ?? primaryId
      },
      verifier: {
        ...node.verification,
        actual_platform: verifierResolution.selected?.id ?? null,
        actual_agent: verifierResolution.selected
          ? (verifierResolution.fallback_used ? verifierResolution.selected.id : node.verification.requested_agent)
          : null,
        preflight_status: verifierResolution.status,
        fallback_used: verifierResolution.fallback_used
      }
    });
  }
  return {
    status: deferred.length ? "deferred" : "ok",
    summary: deferred.length ? "Platform preflight found unresolved route nodes." : "Platform preflight completed before the user gate.",
    warnings,
    artifacts: {
      platform_preflight: {
        primary_agent: primaryId,
        requested_platforms: requestedIds,
        checks,
        fallback_count: resolvedNodes.filter(node => node.preflight.fallback_used).length,
        deferred_nodes: deferred
      },
      resolved_route: {
        ...route,
        status: deferred.length ? "deferred" : "preflighted",
        nodes: resolvedNodes
      }
    }
  };
}
