export async function run(context) {
  const directives = context.task.user_directives ?? {};
  const decision = directives.decision ?? context.task.user_decision ?? null;
  const profile = context.profile;
  const requiresDecision = profile === "complex" && context.config.authority.complex_profiles_require_explicit_decision;
  const unresolvedSkills = context.plan.artifacts.skill_resolution?.required_unresolved ?? [];
  const pendingSkillDecisions = context.plan.artifacts.skill_resolution?.pending_user_decisions ?? [];
  if (["stop", "reject", "cancel"].includes(decision)) {
    return {
      status: "stopped_by_user",
      summary: "User decision stopped this plan before execution.",
      artifacts: { user_decision: { decision, authority: "final", execution_allowed: false } }
    };
  }
  if (decision === "revise") {
    return {
      status: "awaiting_user",
      summary: "User requested a revised path before execution.",
      artifacts: { user_decision: { decision, authority: "final", execution_allowed: false, revision_required: true } }
    };
  }
  const fallbackAllowed = directives.allow_skill_fallback === true;
  if (pendingSkillDecisions.length || (unresolvedSkills.length && !fallbackAllowed)) {
    const hasRequiredGap = unresolvedSkills.length > 0 && !fallbackAllowed;
    return {
      status: "awaiting_user",
      summary: pendingSkillDecisions.length
        ? "Optional Skill dependency needs the user's decision before route preparation continues."
        : "Required Skill is unavailable; user must choose a replacement or allow fallback.",
      artifacts: {
        user_decision: {
          decision: decision ?? "pending",
          authority: "final",
          execution_allowed: false,
          skill_decision_required: hasRequiredGap,
          unresolved_skills: hasRequiredGap ? unresolvedSkills.map(skill => skill.id) : [],
          skill_dependency_decision_required: pendingSkillDecisions.length > 0,
          skill_dependency_questions: pendingSkillDecisions
        }
      }
    };
  }
  if (requiresDecision && !["approve", "continue"].includes(decision)) {
    return {
      status: "awaiting_user",
      summary: "Complex plan requires an explicit user decision before execution.",
      artifacts: { user_decision: { decision: decision ?? "pending", authority: "final", execution_allowed: false } }
    };
  }
  return {
    status: "ok",
    summary: "User authority recorded; model suggestions remain advisory.",
    artifacts: { user_decision: { decision: decision ?? "implicit-continue", authority: "final", execution_allowed: true } }
  };
}
