import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildPackage } from "../scripts/build.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("build produces one canonical static bundle", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-build-"));
  try {
    const output = path.join(temporaryRoot, "dist");
    const result = buildPackage({
      root: PACKAGE_ROOT,
      input: path.join(PACKAGE_ROOT, "demo"),
      output
    });
    const html = fs.readFileSync(path.join(output, "index.html"), "utf8");
    const buildManifest = JSON.parse(fs.readFileSync(path.join(output, "build-manifest.json"), "utf8"));
    assert.equal(result.buildManifest.total_duration, 13);
    assert.equal(buildManifest.asset_count, 5);
    assert.match(html, /globalThis\.__SHADOW_MOVIE_BUNDLE__/);
    assert.match(html, /ShadowMovieWebGpuRig/);
    assert.match(html, /ShadowMoviePlayer/);
    assert.doesNotMatch(html, /const ASSETS/);
    assert.doesNotMatch(html, /const SHOTS/);
    assert.match(html, /shadow-xiaoming/);
    assert.match(html, /data:image\/png;base64,/);
    assert.match(html, /frame_sequence/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("build refuses to delete an unrelated existing directory", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-protected-"));
  try {
    const output = path.join(temporaryRoot, "dist");
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, "build-manifest.json"), JSON.stringify({ format: "other-tool" }), "utf8");
    assert.throws(() => buildPackage({
      root: PACKAGE_ROOT,
      input: path.join(PACKAGE_ROOT, "demo"),
      output,
      force: true
    }), /BUILD_REFUSE_OVERWRITE_NON_SHADOW_OUTPUT/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("build accepts a PNG full-frame background in the same mixed-media manifest", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-build-png-background-"));
  try {
    const input = path.join(temporaryRoot, "demo");
    const output = path.join(temporaryRoot, "dist");
    fs.cpSync(path.join(PACKAGE_ROOT, "demo"), input, { recursive: true });
    const assetsFile = path.join(input, "assets/assets.json");
    const assets = JSON.parse(fs.readFileSync(assetsFile, "utf8"));
    assets.assets.push({
      id: "bg_png_sample",
      name: "PNG 全幅背景示範",
      type: "background",
      format: "png",
      src: "assets/raster/sample.png"
    });
    fs.writeFileSync(assetsFile, JSON.stringify(assets, null, 2) + "\n", "utf8");
    const storyboardFile = path.join(input, "storyboard/storyboard.json");
    const storyboard = JSON.parse(fs.readFileSync(storyboardFile, "utf8"));
    storyboard.shots[0].background = "bg_png_sample";
    fs.writeFileSync(storyboardFile, JSON.stringify(storyboard, null, 2) + "\n", "utf8");
    const result = buildPackage({ root: PACKAGE_ROOT, input, output });
    const html = fs.readFileSync(path.join(output, "index.html"), "utf8");
    assert.equal(result.validation.ok, true);
    assert.match(html, /bg_png_sample/);
    assert.match(html, /data:image\/png;base64,/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
