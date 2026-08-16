export async function run(context) {
  const verification = context.plan.artifacts.verification;
  if (verification?.passed !== false) {
    return {
      status: "ok",
      summary: "No replan is needed.",
      artifacts: { replan: { needed: false, affected_blocks: [] } }
    };
  }
  return {
    status: "awaiting_user",
    summary: "Verification failed; a revised path is proposed but requires user decision.",
    artifacts: {
      replan: {
        needed: true,
        affected_blocks: ["execute", "verify"],
        proposal: "Revise only the affected blocks; preserve confirmed context and decisions.",
        user_decision_required: true
      }
    }
  };
}

