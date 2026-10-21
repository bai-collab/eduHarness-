import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { migrateStoryboard } from "../scripts/migrate-v0.1-to-v0.2.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/legacy-storyboard.json");

test("v0.1 camera and character coordinates migrate to from/to", () => {
  const legacy = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const result = migrateStoryboard(legacy);
  const shot = result.storyboard.shots[0];
  assert.deepEqual(shot.camera.from, { x: 0, y: 0, scale: 1 });
  assert.deepEqual(shot.camera.to, { x: 120, y: 10, scale: 1.1 });
  assert.deepEqual(shot.characters[0].from, { x: 10, y: 20 });
  assert.deepEqual(shot.characters[0].to, { x: 80, y: 20 });
  assert.equal(shot.characters[0].facing, "right");
  assert.equal(shot.characters[0].animation, "walk");
  assert.ok(result.report.changed_fields.length >= 3);
});
