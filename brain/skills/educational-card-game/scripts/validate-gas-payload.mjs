#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const FORBIDDEN = new Set(["spreadsheetId", "teacherPrincipal", "adminPrincipal", "reauthPassed", "oauthToken", "serviceAccountKey", "privateKey", "refreshToken"]);
const actions = new Set(["provision-roster", "login", "event-batch", "teacher-read", "admin-credential"]);

function issue(errors, code, detail) { errors.push({ code, detail }); }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function nonEmpty(value) { return typeof value === "string" && value.trim().length > 0; }
function hasForbidden(value, location, errors) {
  if (Array.isArray(value)) return value.forEach((item, index) => hasForbidden(item, `${location}[${index}]`, errors));
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) issue(errors, "AUTHORITY_FIELD_FORBIDDEN", `${location}.${key} 必須由 server session 產生`);
    if (/^(password|oauth|serviceAccount|privateKey|accessToken|refreshToken)$/iu.test(key)) issue(errors, "SECRET_FIELD_FORBIDDEN", `${location}.${key} 不得由前端提交`);
    hasForbidden(child, `${location}.${key}`, errors);
  }
}

function parseInput() {
  const index = process.argv.indexOf("--input");
  if (index < 0 || !process.argv[index + 1]) throw new Error("用法：node validate-gas-payload.mjs --input <payload.json>");
  return path.resolve(process.cwd(), process.argv[index + 1]);
}

const input = parseInput();
const errors = [];
let payload;
try { payload = JSON.parse(fs.readFileSync(input, "utf8")); }
catch (error) { issue(errors, "JSON_INVALID", error.message); }

if (!isObject(payload)) issue(errors, "ENVELOPE_OBJECT_REQUIRED", "payload");
else {
  if (payload.schemaVersion !== "1.0") issue(errors, "SCHEMA_VERSION_INVALID", "schemaVersion");
  if (!nonEmpty(payload.requestId)) issue(errors, "REQUEST_ID_REQUIRED", "requestId");
  if (!actions.has(payload.action)) issue(errors, "ACTION_INVALID", "action");
  hasForbidden(payload, "payload", errors);
  const body = payload.body ?? payload;
  if (!isObject(body)) issue(errors, "BODY_OBJECT_REQUIRED", "body");
  else if (payload.action === "provision-roster") {
    if (!nonEmpty(payload.importId) || !nonEmpty(payload.schoolKey)) issue(errors, "PROVISION_SCOPE_REQUIRED", "importId／schoolKey");
    if (!Array.isArray(payload.rows) || payload.rows.length === 0) issue(errors, "PROVISION_ROWS_REQUIRED", "rows");
    else for (const [index, row] of payload.rows.entries()) {
      if (!isObject(row) || !nonEmpty(row.studentKey) || !nonEmpty(row.classKey) || !nonEmpty(row.initialPin)) issue(errors, "PROVISION_ROW_INVALID", `rows[${index}]`);
    }
  } else if (payload.action === "login") {
    for (const field of ["launchContext", "gameId", "schoolKey", "courseKey", "studentKey", "pin"]) if (!nonEmpty(payload[field])) issue(errors, "LOGIN_FIELD_REQUIRED", field);
    if (payload.register === true) issue(errors, "PUBLIC_REGISTER_FORBIDDEN", "public collector 只允許既有 roster login");
  } else if (payload.action === "event-batch") {
    for (const field of ["gameId", "courseKey", "studentSessionToken", "sessionId", "batchId"]) if (!nonEmpty(payload[field])) issue(errors, "EVENT_FIELD_REQUIRED", field);
    if (Object.hasOwn(payload, "pin") || Object.hasOwn(payload, "authCode")) issue(errors, "PIN_IN_EVENT_FORBIDDEN", "event batch 不得攜帶 PIN");
    if (!Array.isArray(payload.events) || payload.events.length === 0) issue(errors, "EVENTS_REQUIRED", "events");
    else for (const [index, event] of payload.events.entries()) {
      if (!isObject(event) || !nonEmpty(event.eventId) || !Number.isInteger(event.seq) || !nonEmpty(event.type)) issue(errors, "EVENT_INVALID", `events[${index}]`);
    }
  } else if (payload.action === "teacher-read") {
    if (!nonEmpty(payload.courseKey)) issue(errors, "TEACHER_SCOPE_REQUIRED", "courseKey");
  } else if (payload.action === "admin-credential") {
    for (const field of ["credentialId", "operation", "reasonCode"]) if (!nonEmpty(payload[field])) issue(errors, "ADMIN_FIELD_REQUIRED", field);
  }
}

const result = { ok: errors.length === 0, input, errors };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
