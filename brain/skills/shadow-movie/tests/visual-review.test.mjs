import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildPackage } from "../scripts/build.mjs";
import { validateVisualReview } from "../scripts/validate-visual-review.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRITERIA = [
  "composition",
  "silhouette",
  "material-light",
  "cutout-detail",
  "joints-rods",
  "depth-occlusion",
  "motion-integrity",
  "web-rendering"
];

function writeVisualFile(root, relative) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\"/></svg>", "utf8");
}

function ensureVisualFile(root, relative) {
  if (!fs.existsSync(path.join(root, relative))) writeVisualFile(root, relative);
}

function makeReview(root, {
  full = false,
  assetIds = ["hero", "background"],
  assetPathsById = null
} = {}) {
  ensureVisualFile(root, "concept/master.svg");
  const resolvedAssetPaths = assetPathsById ?? Object.fromEntries(assetIds.map(assetId => [assetId, [`assets/${assetId}.svg`]]));
  for (const assetPaths of Object.values(resolvedAssetPaths)) {
    for (const assetPath of assetPaths) ensureVisualFile(root, assetPath);
  }
  const evidenceByCriteria = new Map();
  for (const criterion of CRITERIA) {
    if (!full && !CRITERIA.slice(0, 6).includes(criterion)) continue;
    const relative = `review/${criterion}.svg`;
    writeVisualFile(root, relative);
    evidenceByCriteria.set(criterion, [relative]);
  }
  writeVisualFile(root, "review/c-side-by-side.svg");
  writeVisualFile(root, "review/d-keyframes.svg");
  writeVisualFile(root, "review/e-browser.svg");
  const review = {
    version: "0.1.0",
    mode: "reference",
    prompt_lock: {
      id: "shadow-puppet-master-visual",
      version: "1.0.0",
      status: "locked",
      source: "shadow-movie/references/master-visual-prompt.md"
    },
    reference: {
      path: "concept/master.svg",
      role: "style-anchor",
      approval: "user-approved"
    },
    asset_mappings: assetIds.map(asset_id => ({
      asset_id,
      asset_paths: resolvedAssetPaths[asset_id],
      reference_path: "concept/master.svg",
      source_region: `${asset_id} 在主視覺中的構圖區域與剪影`,
      derivation: "依主視覺拆解成可驗證的 SVG 部件與關節",
      status: "approved"
    })),
    criteria: [...evidenceByCriteria.entries()].map(([id, evidence]) => ({
      id,
      status: "approved",
      evidence,
      notes: "與主視覺並排檢查後一致"
    })),
    gates: {
      C: {
        status: "approved",
        evidence: ["review/c-side-by-side.svg"],
        user_approval: { status: "approved", message: "使用者確認素材與主視覺風格一致" }
      }
    }
  };
  if (full) {
    review.gates.D = {
      status: "approved",
      evidence: ["review/d-keyframes.svg"],
      user_approval: { status: "approved", message: "使用者確認代表幀的關節與遮擋完整" }
    };
    review.gates.E = {
      status: "approved",
      evidence: ["review/e-browser.svg"],
      user_approval: { status: "approved", message: "使用者確認 HTML 預覽畫面與主視覺一致" }
    };
    review.user_confirmation = { status: "approved", message: "使用者確認 E gate，可作為完成品交付" };
  }
  fs.writeFileSync(path.join(root, "visual-review.json"), JSON.stringify(review, null, 2) + "\n", "utf8");
}

test("required visual review rejects a missing sidecar", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-review-missing-"));
  try {
    const result = validateVisualReview(root, { required: true, gate: "C" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === "VISUAL_REVIEW_FILE_MISSING"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("reference-driven C gate checks anchor, asset provenance, evidence, and user approval", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-review-c-"));
  try {
    makeReview(root);
    const result = validateVisualReview(root, {
      required: true,
      gate: "C",
      expectedAssetIds: ["hero", "background"]
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
    assert.equal(result.status, "approved");
    assert.deepEqual(result.gate, "C");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("reference-driven review requires the locked master visual prompt", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-review-prompt-"));
  try {
    makeReview(root);
    const file = path.join(root, "visual-review.json");
    const review = JSON.parse(fs.readFileSync(file, "utf8"));
    delete review.prompt_lock;
    fs.writeFileSync(file, JSON.stringify(review), "utf8");
    const result = validateVisualReview(root, { required: true, gate: "C" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === "VISUAL_PROMPT_LOCK_REQUIRED"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("E gate requires motion, browser evidence, and final user confirmation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-review-e-"));
  try {
    makeReview(root, { full: true });
    const result = validateVisualReview(root, {
      required: true,
      gate: "all",
      expectedAssetIds: ["hero", "background"]
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
    assert.equal(result.gate, "all");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("visual review rejects traversal and unknown fields", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-review-invalid-"));
  try {
    makeReview(root);
    const file = path.join(root, "visual-review.json");
    const review = JSON.parse(fs.readFileSync(file, "utf8"));
    review.unexpected = true;
    review.reference.path = "../master.svg";
    fs.writeFileSync(file, JSON.stringify(review), "utf8");
    const result = validateVisualReview(root, { required: true, gate: "C" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === "VISUAL_REVIEW_UNKNOWN_FIELD"));
    assert.ok(result.errors.some(error => error.code === "VISUAL_REFERENCE_PATH_OUTSIDE_ROOT"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Build can enforce the C visual review gate without changing default builds", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-build-review-"));
  try {
    const input = path.join(temporaryRoot, "demo");
    const output = path.join(temporaryRoot, "dist");
    fs.cpSync(path.join(PACKAGE_ROOT, "demo"), input, { recursive: true });
    assert.throws(() => buildPackage({
      root: PACKAGE_ROOT,
      input,
      output,
      requireVisualReview: true,
      visualReviewGate: "C"
    }), /VISUAL_REVIEW_INVALID[\s\S]*VISUAL_REVIEW_FILE_MISSING/);
    const assets = JSON.parse(fs.readFileSync(path.join(input, "assets/assets.json"), "utf8")).assets;
    const assetIds = assets.map(asset => asset.id);
    const assetPathsById = Object.fromEntries(assets.map(asset => [
      asset.id,
      [
        ...(asset.type === "character" ? Object.values(asset.views ?? {}) : Object.values(asset.layers ?? {})),
        ...(asset.src ? [asset.src] : []),
        ...(asset.frame_sequence?.frames ?? [])
      ]
    ]));
    makeReview(input, { assetIds, assetPathsById });
    const result = buildPackage({
      root: PACKAGE_ROOT,
      input,
      output,
      requireVisualReview: true,
      visualReviewGate: "C"
    });
    assert.equal(result.visualReview.status, "approved");
    assert.equal(result.visualReview.gate, "C");
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "build-manifest.json"), "utf8"));
    assert.deepEqual(manifest.visual_review, { status: "approved", gate: "C" });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
