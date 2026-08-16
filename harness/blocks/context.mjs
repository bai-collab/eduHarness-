import fs from "node:fs";
import { toWorkspaceRelative } from "../core/root.mjs";
import { loadBrainContext } from "../core/brain.mjs";

export async function run(context) {
  const file = context.paths.brain_index;
  let index = null;
  let status = "ok";
  if (fs.existsSync(file)) index = JSON.parse(fs.readFileSync(file, "utf8"));
  else status = "deferred";
  const brain = loadBrainContext(context.workspace, context.task);
  return {
    status: brain.status === "ok" && status === "ok" ? "ok" : brain.status,
    summary: brain.status === "ok" ? brain.summary : "Brain index is unavailable; continue with explicit task input.",
    warnings: [...(status === "deferred" ? ["BRAIN_INDEX_UNAVAILABLE"] : []), ...(brain.warnings ?? [])],
    artifacts: {
      context: {
        source: index ? "brain/index.json" : null,
        loaded: Boolean(index),
        paths: Object.fromEntries(Object.entries(context.paths).map(([key, value]) => [key, toWorkspaceRelative(context.workspace.root, value)])),
        brain: brain.artifact
      }
    }
  };
}
