import fs from "node:fs";
import path from "node:path";
import { resolveWorkspacePath } from "./root.mjs";

export function savePlan(workspace, plan, relativeDirectory = "harness/state/plans") {
  const directory = resolveWorkspacePath(workspace.root, relativeDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${plan.plan_id}.json`);
  const temporary = `${target}.tmp-${process.pid}`;
  if (fs.existsSync(target)) throw new Error(`STATE_REFUSES_OVERWRITE ${plan.plan_id}`);
  fs.writeFileSync(temporary, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, target);
  return target;
}

