#!/usr/bin/env node
// validate-skill-inputs.mjs — NOOA-1 / WP-1 core.
//
// Deterministic, dependency-free enforcement of a skill's typed input contract
// (harness/skill-contracts/<skill>.contract.json). Given a contract and the
// inputs supplied for a run, it decides BEFORE any generation whether the run
// may proceed. This turns "the model reads the prose and hopefully notices a
// missing field" into a hard, host-independent gate: a required input that is
// missing or type/enum-invalid yields BLOCKED_BEFORE_RUN, so the skill never
// burns a full authoring pass to produce a plausible-but-wrong artifact.
//
// OUT OF SCOPE (later WP-1 slice, depends on WP-6 Host Capability Manifest):
// `requires:`/`optional:` host-capability binding and CAPABILITY_UNAVAILABLE.
//
// CLI: node validate-skill-inputs.mjs <contract.json> <inputs.json>
//   exit 0 = READY_TO_RUN, 3 = BLOCKED_BEFORE_RUN, 2 = usage/parse error.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const TYPE_CHECKS = {
  string: value => typeof value === "string",
  integer: value => Number.isInteger(value),
  number: value => typeof value === "number" && Number.isFinite(value),
  boolean: value => typeof value === "boolean",
  array: value => Array.isArray(value),
};

// Structural sanity of the contract itself (we have no ajv; keep it minimal).
export function assertContractShape(contract) {
  const problems = [];
  if (!contract || typeof contract !== "object") return ["contract is not an object"];
  if (contract.schema_version !== 1) problems.push("schema_version must be 1");
  if (typeof contract.skill_id !== "string" || !contract.skill_id) problems.push("skill_id must be a non-empty string");
  if (!contract.inputs || typeof contract.inputs !== "object" || Array.isArray(contract.inputs)) {
    problems.push("inputs must be an object");
  }
  return problems;
}

// Core deterministic decision. `provided` is a plain object of name -> value.
export function validateSkillInputs(contract, provided) {
  const shape = assertContractShape(contract);
  if (shape.length) {
    return { status: "BLOCKED_BEFORE_RUN", missing: [], invalid: [`contract:${shape.join("; ")}`], unknown: [] };
  }
  const values = provided && typeof provided === "object" && !Array.isArray(provided) ? provided : {};
  const missing = [];
  const invalid = [];
  const defined = new Set(Object.keys(contract.inputs));

  for (const [name, def] of Object.entries(contract.inputs)) {
    const present = Object.hasOwn(values, name) && values[name] !== null && values[name] !== undefined
      && !(typeof values[name] === "string" && values[name].trim() === "");
    if (!present) {
      if (def.required) missing.push(name);
      continue;
    }
    const value = values[name];
    const typeCheck = TYPE_CHECKS[def.type];
    if (typeCheck && !typeCheck(value)) {
      invalid.push(`${name}: expected ${def.type}`);
      continue;
    }
    if (Array.isArray(def.enum) && !def.enum.includes(value)) {
      invalid.push(`${name}: not one of [${def.enum.join(", ")}]`);
      continue;
    }
    if (typeof def.minimum === "number" && typeof value === "number" && value < def.minimum) {
      invalid.push(`${name}: below minimum ${def.minimum}`);
    }
  }

  const unknown = Object.keys(values).filter(name => !defined.has(name)); // non-blocking, reported only
  const status = missing.length === 0 && invalid.length === 0 ? "READY_TO_RUN" : "BLOCKED_BEFORE_RUN";
  return { status, missing, invalid, unknown };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main(argv) {
  const [contractPath, inputsPath] = argv;
  if (!contractPath || !inputsPath) {
    console.error("usage: node validate-skill-inputs.mjs <contract.json> <inputs.json>");
    return 2;
  }
  let contract;
  let provided;
  try {
    contract = readJson(path.resolve(contractPath));
    provided = readJson(path.resolve(inputsPath));
  } catch (error) {
    console.error(`parse error: ${error.message}`);
    return 2;
  }
  const result = validateSkillInputs(contract, provided);
  console.log(JSON.stringify(result, null, 2));
  return result.status === "READY_TO_RUN" ? 0 : 3;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
