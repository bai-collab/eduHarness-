function list(value) {
  return Array.isArray(value) ? value : [];
}

export async function run(context) {
  const input = context.task.reasoning ?? {};
  const record = {
    mode: "conditional",
    trigger: list(input.trigger).length ? list(input.trigger) : [context.profile],
    assumptions: list(input.assumptions),
    hypotheses: list(input.hypotheses),
    alternatives: list(input.alternatives),
    evidence: list(input.evidence),
    checks: list(input.checks),
    uncertainties: list(input.uncertainties),
    conclusion: input.conclusion ?? null,
    next_action: input.next_action ?? null,
    private_chain_of_thought: "not_requested"
  };
  const modelInstruction = {
    role: "reasoning-advisor",
    objective: "提出可驗證的方案，不取代使用者裁決。",
    return_fields: ["assumptions", "hypotheses", "alternatives", "evidence", "checks", "conclusion", "uncertainties", "next_action"],
    constraints: [
      "只使用已提供或工具實際觀察到的證據",
      "未知資訊標記 uncertainty，不自行補完",
      "model suggestion is advisory; user decision is final",
      "不要輸出或保存私有 chain-of-thought"
    ],
    input: {
      goal: context.task.goal,
      user_directives: context.task.user_directives ?? {},
      current_record: record
    }
  };
  const warnings = [];
  if (!record.hypotheses.length && !record.alternatives.length) warnings.push("REASONING_INPUT_NOT_PROVIDED");
  return {
    status: "ok",
    summary: "Created an auditable reasoning scaffold; it does not store private chain-of-thought.",
    warnings,
    artifacts: { reasoning_record: record, model_instruction: modelInstruction }
  };
}
