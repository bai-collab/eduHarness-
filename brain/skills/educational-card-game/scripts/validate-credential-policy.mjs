#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function issue(errors, code, detail) { errors.push({ code, detail }); }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function parseInput() {
  const index = process.argv.indexOf("--input");
  if (index < 0 || !process.argv[index + 1]) throw new Error("用法：node validate-credential-policy.mjs --input <policy.json>");
  return path.resolve(process.cwd(), process.argv[index + 1]);
}

const input = parseInput();
const errors = [];
let policy;
try { policy = JSON.parse(fs.readFileSync(input, "utf8")); }
catch (error) { issue(errors, "JSON_INVALID", error.message); }

if (!isObject(policy)) issue(errors, "POLICY_OBJECT_REQUIRED", "policy");
else {
  if (policy.schemaVersion !== "1.0") issue(errors, "SCHEMA_VERSION_INVALID", "schemaVersion");
  if (policy.preProvisionedRoster !== true || policy.publicRegisterAllowed !== false) issue(errors, "ROSTER_POLICY_INVALID", "必須是校方預載 roster 且禁止 public register");
  if (policy.pin?.assurance !== "low-classroom") issue(errors, "PIN_ASSURANCE_INVALID", "短 PIN 必須標為 low-classroom");
  if (!Number.isInteger(policy.pin?.lengthMin) || policy.pin.lengthMin < 4) issue(errors, "PIN_LENGTH_INVALID", "PIN 長度政策不可低於 4，實際值仍須由校方核准");
  if (!isObject(policy.rateLimits) || policy.rateLimits.perStudent !== true || policy.rateLimits.perLaunch !== true || policy.rateLimits.perSchool !== true) issue(errors, "RATE_LIMIT_POLICY_INVALID", "必須包含 student／launch／school 限速");
  if (policy.mode === "C1") {
    if (policy.adminRevealAllowed === true) issue(errors, "C1_REVEAL_INVALID", "C1 不可查回原 PIN");
    if (!policy.resetAllowed) issue(errors, "C1_RESET_REQUIRED", "C1 必須提供重設");
  } else if (policy.mode === "C2") {
    if (policy.adminRevealAllowed !== true || policy.externalKms !== true || policy.vaultSeparate !== true) issue(errors, "C2_CONTROLS_REQUIRED", "C2 必須有 external KMS、vault 分離與受控 reveal");
    for (const field of ["reauthRequired", "singleRecordOnly", "reasonCodeRequired", "independentAuditSink"]) if (policy[field] !== true) issue(errors, "C2_CONTROL_MISSING", field);
  } else issue(errors, "MODE_INVALID", "mode 必須是 C1 或 C2");
  if (policy.plaintextStored === true || policy.pinInEvents === true || policy.pinInLogs === true || policy.pinInFrontendStorage === true) issue(errors, "PLAINTEXT_PIN_FORBIDDEN", "PIN 不得保存於 plaintext／events／logs／前端長期儲存");
}

const result = { ok: errors.length === 0, input, errors };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
