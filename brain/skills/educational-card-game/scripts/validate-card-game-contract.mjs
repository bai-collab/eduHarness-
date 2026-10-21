#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const EFFECTS = new Set(["draw", "reveal", "match", "sequence", "hint", "remediate", "gain-resource", "lose-resource", "queue-event", "pass"]);
const CARD_TYPES = new Set(["question", "concept", "action", "event", "remediation"]);
const ANSWERS = new Set(["single-choice", "multi-select", "ordered", "match", "numeric", "short-text", "teacher-judged"]);
const FORBIDDEN_KEY = /^(authCode|pin|plaintext|password|oauthToken|serviceAccountKey|privateKey|accessToken|refreshToken)$/iu;

function issue(errors, code, detail) {
  errors.push({ code, detail });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, location, errors) {
  if (typeof value !== "string" || !value.trim()) issue(errors, "STRING_REQUIRED", `${location} 必須是非空字串`);
}

function scanForbidden(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(item, `${location}[${index}]`, errors));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) issue(errors, "SECRET_FIELD_FORBIDDEN", `${location}.${key} 不得出現在卡牌 catalog`);
    scanForbidden(child, `${location}.${key}`, errors);
  }
}

function validateCard(card, index, ids, errors) {
  const location = `cards[${index}]`;
  if (!isObject(card)) {
    issue(errors, "CARD_OBJECT_REQUIRED", location);
    return;
  }
  requiredString(card.cardId, `${location}.cardId`, errors);
  if (ids.has(card.cardId)) issue(errors, "DUPLICATE_CARD_ID", card.cardId);
  ids.add(card.cardId);
  if (!CARD_TYPES.has(card.cardType)) issue(errors, "CARD_TYPE_INVALID", `${location}.cardType`);
  if (!Array.isArray(card.objectiveIds) || card.objectiveIds.length === 0) issue(errors, "OBJECTIVES_REQUIRED", `${location}.objectiveIds`);
  requiredString(card.conceptId, `${location}.conceptId`, errors);
  requiredString(card.prompt, `${location}.prompt`, errors);
  if (!isObject(card.answerSpec) || !ANSWERS.has(card.answerSpec?.kind)) issue(errors, "ANSWER_SPEC_INVALID", `${location}.answerSpec`);
  for (const field of ["rationale", "hint"]) requiredString(card[field], `${location}.${field}`, errors);
  if (!Array.isArray(card.misconceptionTags)) issue(errors, "MISCONCEPTION_TAGS_REQUIRED", `${location}.misconceptionTags`);
  if (!isObject(card.feedback)) issue(errors, "FEEDBACK_REQUIRED", `${location}.feedback`);
  else for (const field of ["correct", "incorrect", "hint"]) requiredString(card.feedback[field], `${location}.feedback.${field}`, errors);
  if (!Array.isArray(card.remediation)) issue(errors, "REMEDIATION_REQUIRED", `${location}.remediation`);
  if (!Number.isInteger(card.difficulty) || card.difficulty < 1 || card.difficulty > 5) issue(errors, "DIFFICULTY_INVALID", `${location}.difficulty`);
  if (!Array.isArray(card.effects)) issue(errors, "EFFECTS_REQUIRED", `${location}.effects`);
  else for (const [effectIndex, effect] of card.effects.entries()) {
    if (!isObject(effect) || !EFFECTS.has(effect.type)) issue(errors, "EFFECT_INVALID", `${location}.effects[${effectIndex}]`);
  }
  if (!isObject(card.source) || card.source.approved !== true) issue(errors, "SOURCE_NOT_APPROVED", `${location}.source`);
  if (!isObject(card.a11y) || ["altText", "nonColorCue", "keyboardAction"].some(field => typeof card.a11y[field] !== "string" || !card.a11y[field].trim())) issue(errors, "A11Y_INCOMPLETE", `${location}.a11y`);
  if (card.schemaVersion !== "1.0") issue(errors, "CARD_SCHEMA_VERSION_INVALID", `${location}.schemaVersion`);
}

function parseInput() {
  const index = process.argv.indexOf("--input");
  if (index < 0 || !process.argv[index + 1]) throw new Error("用法：node validate-card-game-contract.mjs --input <catalog.json>");
  return path.resolve(process.cwd(), process.argv[index + 1]);
}

const input = parseInput();
const errors = [];
let document;
try {
  document = JSON.parse(fs.readFileSync(input, "utf8"));
} catch (error) {
  issue(errors, "JSON_INVALID", error.message);
}

if (!isObject(document)) issue(errors, "CATALOG_OBJECT_REQUIRED", "catalog");
else {
  if (document.schemaVersion !== "1.0") issue(errors, "CATALOG_SCHEMA_VERSION_INVALID", "schemaVersion");
  requiredString(document.catalogId, "catalogId", errors);
  requiredString(document.gameId, "gameId", errors);
  if (document.sourcePolicy?.teacherApprovalRequired !== true || document.sourcePolicy?.traceabilityRequired !== true) issue(errors, "SOURCE_POLICY_INVALID", "sourcePolicy 必須要求教師核准與可追溯來源");
  if (!Array.isArray(document.cards) || document.cards.length === 0) issue(errors, "CARDS_REQUIRED", "cards");
  else {
    const ids = new Set();
    document.cards.forEach((card, index) => validateCard(card, index, ids, errors));
  }
  scanForbidden(document, "catalog", errors);
}

const result = { ok: errors.length === 0, input, errors };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
