import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateDemoDir, validateStoryboardDocument } from "../scripts/validate.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_ROOT = path.join(PACKAGE_ROOT, "demo");

test("v0.2 demo contract is internally consistent", () => {
  const result = validateDemoDir(DEMO_ROOT);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.equal(result.totalDuration, 13);
  assert.deepEqual(result.sceneIds, ["scene_village_encounter", "scene_flying_sky"]);
  const pngAsset = result.assets.assets.find(asset => asset.id === "char_png_frame_sample");
  assert.equal(pngAsset.format, "png");
  assert.equal(pngAsset.frame_sequence.frames.length, 2);
});

test("legacy startX/endX fields are rejected by the canonical storyboard contract", () => {
  const result = validateDemoDir(DEMO_ROOT);
  const storyboard = structuredClone(result.storyboard);
  storyboard.shots[0].startX = 1;
  const checked = validateStoryboardDocument(storyboard, {
    sceneIds: new Set(result.sceneIds),
    assets: new Map(result.assets.assets.map(asset => [asset.id, asset]))
  });
  assert.equal(checked.ok, false);
  assert.ok(checked.errors.some(error => error.code === "UNKNOWN_FIELD" && error.detail.includes("startX")));
});
