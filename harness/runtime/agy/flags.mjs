// 模式與旗標鎖定（程式強制）。companion 依模式組出固定旗標集合；任務文字一律走 stdin，
// 呼叫方只能選模式、模型（白名單，見 capabilities.mjs）、effort、timeout、add-dir、conversation。
// 每個可選值都先驗證值域；組好的 argv 再逐對比對允許的旗標與值格式（V1 發現 effort 等值未驗證，
// 可把 "accept-edits" 之類的字串帶進 argv）。
import path from "node:path";

export const FORBIDDEN_FLAGS = [
  "--dangerously-skip-permissions",
  "--disable-slash-commands",
  "--json-schema"
];
export const FORBIDDEN_TOKENS = ["accept-edits"];

export const VALID_EFFORTS = ["low", "medium", "high"];
export const MAX_TIMEOUT_SECONDS = 7200;
const CONVERSATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/i;

// 允許出現在 argv 的旗標與其值的檢查；null 表示該旗標不帶值。
const ALLOWED_FLAGS = {
  "--mode": value => value === "plan",
  "--sandbox": null,
  "--output-format": value => value === "stream-json",
  "--add-dir": value => typeof value === "string" && path.isAbsolute(value) && !value.startsWith("-"),
  "--print-timeout": value => /^[1-9][0-9]*s$/.test(value) && Number(value.slice(0, -1)) <= MAX_TIMEOUT_SECONDS,
  "--model": value => MODEL_ID_PATTERN.test(value),
  "--effort": value => VALID_EFFORTS.includes(value),
  "--conversation": value => CONVERSATION_ID_PATTERN.test(value)
};

// add-dir 必須是工作區根目錄內的絕對路徑（含根目錄本身）。
export function resolveAddDir(root, addDir) {
  if (typeof root !== "string" || root.trim() === "") throw new Error("AGY_ROOT_REQUIRED");
  const base = path.resolve(root);
  const candidate = path.resolve(base, addDir ?? base);
  const relative = path.relative(base, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("AGY_ADD_DIR_OUTSIDE_WORKSPACE");
  return candidate;
}

/** @param {{model?: string, effort?: string, timeoutSeconds?: number, addDir?: string, conversationId?: string}} [options] */
export function buildArgv({ model, effort, timeoutSeconds = 180, addDir, conversationId } = {}) {
  if (typeof model !== "string" || !MODEL_ID_PATTERN.test(model)) throw new Error("AGY_MODEL_REQUIRED");
  const seconds = Number(timeoutSeconds);
  if (!Number.isInteger(seconds) || seconds <= 0 || seconds > MAX_TIMEOUT_SECONDS) throw new Error("AGY_TIMEOUT_INVALID");
  if (typeof addDir !== "string" || !path.isAbsolute(addDir)) throw new Error("AGY_ADD_DIR_REQUIRED");
  if (effort !== undefined && effort !== null && !VALID_EFFORTS.includes(effort)) throw new Error("AGY_EFFORT_INVALID");
  if (conversationId !== undefined && conversationId !== null && !(typeof conversationId === "string" && CONVERSATION_ID_PATTERN.test(conversationId))) {
    throw new Error("AGY_CONVERSATION_ID_INVALID");
  }

  const argv = ["--mode", "plan", "--sandbox", "--output-format", "stream-json"];
  argv.push("--add-dir", addDir);
  argv.push("--print-timeout", `${seconds}s`);
  argv.push("--model", model);
  if (effort) argv.push("--effort", effort);
  if (conversationId) argv.push("--conversation", conversationId);
  return argv;
}

export function assertNoForbiddenFlags(argv) {
  if (!Array.isArray(argv)) throw new Error("AGY_ARGV_INVALID");
  for (const token of argv) {
    if (typeof token !== "string") throw new Error("AGY_ARGV_INVALID");
    if (FORBIDDEN_FLAGS.includes(token)) throw new Error(`AGY_FORBIDDEN_FLAG ${token}`);
    if (FORBIDDEN_TOKENS.includes(token)) throw new Error(`AGY_FORBIDDEN_TOKEN ${token}`);
  }
  const modeIndex = argv.indexOf("--mode");
  if (modeIndex === -1 || argv[modeIndex + 1] !== "plan") throw new Error("AGY_MODE_MUST_BE_PLAN");
  // 逐對比對：每個位置不是允許的旗標、就必須是前一個旗標的合法值。
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!Object.hasOwn(ALLOWED_FLAGS, flag)) throw new Error(`AGY_ARGV_UNEXPECTED ${flag}`);
    if (seen.has(flag)) throw new Error(`AGY_ARGV_DUPLICATE ${flag}`);
    seen.add(flag);
    const check = ALLOWED_FLAGS[flag];
    if (check === null) continue;
    const value = argv[i + 1];
    if (typeof value !== "string" || !check(value)) throw new Error(`AGY_ARGV_VALUE_INVALID ${flag}`);
    i += 1;
  }
  return true;
}
