export async function run(context) {
  const task = context.task;
  const requested = task.user_directives?.profile ?? task.profile ?? "adaptive";
  const signals = [];
  if (task.ambiguity === true) signals.push("ambiguity");
  if (task.source_conflict === true) signals.push("source_conflict");
  if (task.irreversible === true) signals.push("irreversible");
  if (["high", "critical"].includes(String(task.risk ?? "").toLowerCase())) signals.push("risk");
  if (Number(task.steps ?? 0) >= 5) signals.push("many_steps");
  return {
    status: "ok",
    summary: "Task classified without selecting an external runtime.",
    artifacts: {
      classification: {
        requested_profile: requested,
        signals,
        model_suggestion: context.profile,
        user_override_present: requested !== "adaptive"
      }
    }
  };
}

