#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const FIELDS = ["eventColumns", "eventsPerSession", "sessionsPerPeriod", "sessionSummaryColumns", "masteryColumns", "summaryRows", "rosterColumns", "rosterRows", "credentialColumns", "credentialRows", "reservedHeaderAndFormulaCells"];
function parseInput() {
  const index = process.argv.indexOf("--input");
  if (index < 0 || !process.argv[index + 1]) throw new Error("用法：node estimate-sheet-budget.mjs --input <budget.json>");
  return path.resolve(process.cwd(), process.argv[index + 1]);
}
function positiveInteger(value) { return Number.isInteger(value) && value >= 0; }
const input = parseInput();
const errors = [];
let config;
try { config = JSON.parse(fs.readFileSync(input, "utf8")); }
catch (error) { errors.push({ code: "JSON_INVALID", detail: error.message }); }
if (!config || typeof config !== "object" || Array.isArray(config)) errors.push({ code: "CONFIG_OBJECT_REQUIRED", detail: "budget" });
else for (const field of FIELDS) if (!positiveInteger(config[field])) errors.push({ code: "NON_NEGATIVE_INTEGER_REQUIRED", detail: field });

if (errors.length) {
  console.log(JSON.stringify({ ok: false, input, errors }, null, 2));
  process.exitCode = 1;
} else {
  const estimatedCells =
    config.eventColumns * config.eventsPerSession * config.sessionsPerPeriod +
    config.sessionSummaryColumns * config.sessionsPerPeriod +
    config.masteryColumns * config.summaryRows +
    config.rosterColumns * config.rosterRows +
    config.credentialColumns * config.credentialRows +
    config.reservedHeaderAndFormulaCells;
  const capacityCells = Number.isInteger(config.capacityCells) ? config.capacityCells : 10_000_000;
  const warningRatio = typeof config.warningRatio === "number" ? config.warningRatio : 0.7;
  const ratio = capacityCells > 0 ? estimatedCells / capacityCells : Infinity;
  const result = {
    ok: true,
    input,
    estimatedCells,
    capacityCells,
    warningRatio,
    utilizationRatio: Number(ratio.toFixed(6)),
    needsLoadTestOrRotation: ratio >= warningRatio,
    requiresUpgrade: ratio >= 1,
    formula: "eventColumns*eventsPerSession*sessionsPerPeriod + sessionSummaryColumns*sessionsPerPeriod + masteryColumns*summaryRows + rosterColumns*rosterRows + credentialColumns*credentialRows + reservedHeaderAndFormulaCells"
  };
  console.log(JSON.stringify(result, null, 2));
}
