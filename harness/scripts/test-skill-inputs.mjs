#!/usr/bin/env node
// test-skill-inputs.mjs — NOOA-1 / WP-1 core acceptance test.
//
// Proves the "有效訊號" for TYPED_IO_OK:
//   1. Missing a hard-stop input  -> BLOCKED_BEFORE_RUN, and the missing set
//      names exactly what is absent (the item-authoring stop rule: 缺學段/科目/
//      來源/指標即停).
//   2. A complete, valid input set -> READY_TO_RUN.
//   3. An out-of-enum source tag   -> BLOCKED_BEFORE_RUN (invalid), so a bad
//      source marker never slips through.
//   4. Extra unknown inputs are reported but do NOT block.
//
// Dependency-free; exits non-zero on any failure and prints TYPED_IO_OK on pass.

import fs from "node:fs";
import path from "node:path";
import { ROOT, validateSkillInputs, assertContractShape } from "./validate-skill-inputs.mjs";

const contractPath = path.join(ROOT, "harness", "skill-contracts", "item-authoring.contract.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const failures = [];

function expect(label, condition) {
  if (!condition) failures.push(label);
}

// 0. Contract is structurally sound.
expect("contract shape invalid", assertContractShape(contract).length === 0);

// 1. Missing hard-stop inputs -> blocked, missing set is exact.
const r1 = validateSkillInputs(contract, { grade: "五年級", source: "official" });
expect("case1 status", r1.status === "BLOCKED_BEFORE_RUN");
expect("case1 missing subject", r1.missing.includes("subject"));
expect("case1 missing indicator_scope", r1.missing.includes("indicator_scope"));
expect("case1 grade not flagged", !r1.missing.includes("grade"));
expect("case1 source not flagged", !r1.missing.includes("source"));

// 2. Complete valid set -> ready.
const r2 = validateSkillInputs(contract, {
  grade: "五年級",
  subject: "數學",
  source: "user-supplied",
  indicator_scope: "N-5-1 分數的加減",
  item_count: 10,
  human_review: true,
});
expect("case2 ready", r2.status === "READY_TO_RUN");
expect("case2 no missing", r2.missing.length === 0);
expect("case2 no invalid", r2.invalid.length === 0);

// 3. Out-of-enum source -> blocked as invalid, not missing.
const r3 = validateSkillInputs(contract, {
  grade: "五年級",
  subject: "數學",
  source: "wikipedia",
  indicator_scope: "N-5-1",
});
expect("case3 blocked", r3.status === "BLOCKED_BEFORE_RUN");
expect("case3 invalid names source", r3.invalid.some(m => m.startsWith("source:")));
expect("case3 no missing", r3.missing.length === 0);

// 3b. Wrong type for item_count -> invalid.
const r3b = validateSkillInputs(contract, {
  grade: "五年級", subject: "數學", source: "official", indicator_scope: "N-5-1",
  item_count: "十",
});
expect("case3b blocked on type", r3b.status === "BLOCKED_BEFORE_RUN");
expect("case3b invalid names item_count", r3b.invalid.some(m => m.startsWith("item_count:")));

// 3c. Below-minimum item_count -> invalid.
const r3c = validateSkillInputs(contract, {
  grade: "五年級", subject: "數學", source: "official", indicator_scope: "N-5-1",
  item_count: 0,
});
expect("case3c blocked on minimum", r3c.status === "BLOCKED_BEFORE_RUN");

// 4. Unknown extra input is reported, not blocking.
const r4 = validateSkillInputs(contract, {
  grade: "五年級", subject: "數學", source: "official", indicator_scope: "N-5-1",
  color: "blue",
});
expect("case4 ready despite unknown", r4.status === "READY_TO_RUN");
expect("case4 unknown reported", r4.unknown.includes("color"));

// 5. Empty-string required input counts as missing (not merely present-but-blank).
const r5 = validateSkillInputs(contract, {
  grade: "   ", subject: "數學", source: "official", indicator_scope: "N-5-1",
});
expect("case5 blank grade is missing", r5.status === "BLOCKED_BEFORE_RUN" && r5.missing.includes("grade"));

if (failures.length) {
  console.error("FAIL:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("TYPED_IO_OK");
