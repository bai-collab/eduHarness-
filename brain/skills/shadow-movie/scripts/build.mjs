import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeSvgFile } from "./sanitize-svg.mjs";
import { validateDemoDir } from "./validate.mjs";
import { validateVisualReview } from "./validate-visual-review.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function resolveInside(root, relative, label) {
  if (typeof relative !== "string" || !relative.trim() || relative.includes("\\") || path.posix.isAbsolute(relative) || relative.includes("://")) {
    throw new Error("BUILD_PATH_INVALID " + label);
  }
  const resolved = path.resolve(root, relative);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("BUILD_PATH_OUTSIDE_ROOT " + label);
  return resolved;
}

function scriptSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function replaceMarker(template, marker, replacement) {
  if (!template.includes(marker)) throw new Error("BUILD_MARKER_MISSING " + marker);
  return template.replace(marker, replacement);
}

function readMediaSource(sourceFile, relative) {
  const extension = path.extname(relative).toLowerCase();
  if (extension === ".svg") return sanitizeSvgFile(sourceFile);
  if (extension === ".png") return "data:image/png;base64," + fs.readFileSync(sourceFile).toString("base64");
  throw new Error("BUILD_ASSET_FORMAT_UNSUPPORTED " + relative);
}

function collectSources(inputRoot, assets) {
  const sources = {};
  for (const asset of assets) {
    const assetSources = {};
    const sourceEntries = asset.type === "character"
      ? Object.entries(asset.views ?? {})
      : Object.entries(asset.layers ?? {});
    for (const [key, relative] of sourceEntries) {
      const sourceFile = resolveInside(inputRoot, relative, asset.id + "." + key);
      if (!fs.existsSync(sourceFile)) throw new Error("BUILD_ASSET_MISSING " + relative);
      assetSources[key] = readMediaSource(sourceFile, relative);
    }
    if (asset.src) {
      const sourceFile = resolveInside(inputRoot, asset.src, asset.id + ".src");
      if (!fs.existsSync(sourceFile)) throw new Error("BUILD_ASSET_MISSING " + asset.src);
      assetSources.src = readMediaSource(sourceFile, asset.src);
    }
    if (asset.frame_sequence?.frames) {
      assetSources.frame_sequence = {
        frames: asset.frame_sequence.frames.map((relative, index) => {
          const sourceFile = resolveInside(inputRoot, relative, asset.id + ".frame_" + index);
          if (!fs.existsSync(sourceFile)) throw new Error("BUILD_ASSET_MISSING " + relative);
          return readMediaSource(sourceFile, relative);
        })
      };
    }
    sources[asset.id] = assetSources;
  }
  return sources;
}

function expectedPathsForAsset(asset) {
  return [
    ...(asset.type === "character" ? Object.values(asset.views ?? {}) : Object.values(asset.layers ?? {})),
    ...(asset.src ? [asset.src] : []),
    ...(asset.frame_sequence?.frames ?? [])
  ];
}

export function buildPackage({
  root = PACKAGE_ROOT,
  input = path.join(root, "demo"),
  output = path.join(root, "demo", "dist"),
  force = false,
  requireVisualReview = false,
  visualReviewGate = "C"
} = {}) {
  const packageRoot = path.resolve(root);
  const inputRoot = path.resolve(input);
  const outputRoot = path.resolve(output);
  if (inputRoot === outputRoot) throw new Error("BUILD_OUTPUT_MUST_NOT_EQUAL_INPUT");
  const validation = validateDemoDir(inputRoot);
  if (!validation.ok) throw new Error("BUILD_CONTRACT_INVALID\n" + validation.errors.map(error => error.code + ": " + error.detail).join("\n"));
  const assets = validation.assets.assets;
  const expectedAssetFiles = assets.map(asset => ({
    id: asset.id,
    paths: expectedPathsForAsset(asset)
  }));
  const visualReview = requireVisualReview
    ? validateVisualReview(inputRoot, {
      required: true,
      gate: visualReviewGate,
      expectedAssetIds: assets.map(asset => asset.id),
      expectedAssetFiles
    })
    : { ok: true, status: "not-requested", errors: [], warnings: [], gate: null };
  if (!visualReview.ok) {
    throw new Error("VISUAL_REVIEW_INVALID\n" + visualReview.errors.map(error => error.code + ": " + error.detail).join("\n"));
  }
  if (fs.existsSync(outputRoot)) {
    if (!force) throw new Error("BUILD_OUTPUT_EXISTS " + outputRoot + "; 使用 --force 才能覆寫");
    const existingManifest = path.join(outputRoot, "build-manifest.json");
    let ownsOutput = false;
    try {
      const parsedManifest = JSON.parse(fs.readFileSync(existingManifest, "utf8"));
      ownsOutput = parsedManifest.format === "shadow-movie-static-bundle";
    } catch (error) {
      ownsOutput = false;
    }
    if (!ownsOutput) throw new Error("BUILD_REFUSE_OVERWRITE_NON_SHADOW_OUTPUT " + outputRoot);
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(outputRoot, { recursive: true });

  const runtimeRoot = path.join(packageRoot, "runtime");
  const template = fs.readFileSync(path.join(runtimeRoot, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(runtimeRoot, "movie.css"), "utf8");
  const webGpuRig = fs.readFileSync(path.join(runtimeRoot, "webgpu-rig.js"), "utf8");
  const runtime = fs.readFileSync(path.join(runtimeRoot, "movie.js"), "utf8");
  const bundle = {
    manifest: validation.manifest,
    script: validation.script,
    storyboard: validation.storyboard,
    assets: {
      assets,
      sources: collectSources(inputRoot, assets)
    }
  };
  const bundleJson = scriptSafeJson(bundle);
  let html = template;
  html = replaceMarker(html, "<!-- __SHADOW_MOVIE_CSS__ -->", "<style>\n" + css + "\n</style>");
  html = replaceMarker(html, "<!-- __SHADOW_MOVIE_BUNDLE__ -->", "<script>globalThis.__SHADOW_MOVIE_BUNDLE__=" + bundleJson + ";</script>");
  html = replaceMarker(html, "<!-- __SHADOW_MOVIE_RUNTIME__ -->", "<script>\n" + webGpuRig + "\n</script>\n<script>\n" + runtime + "\n</script>");
  fs.writeFileSync(path.join(outputRoot, "index.html"), html, "utf8");

  const sourceFingerprint = sha256(JSON.stringify({
    manifest: validation.manifest,
    script: validation.script,
    storyboard: validation.storyboard,
    assets: assets.map(asset => asset.id)
  }));
  const buildManifest = {
    build_version: "0.2.0",
    format: "shadow-movie-static-bundle",
    generated_files: ["index.html", "build-manifest.json"],
    asset_count: assets.length,
    shot_count: validation.storyboard.shots.length,
    total_duration: validation.totalDuration,
    source_fingerprint: sourceFingerprint,
    visual_review: {
      status: visualReview.status,
      gate: visualReview.gate
    }
  };
  fs.writeFileSync(path.join(outputRoot, "build-manifest.json"), JSON.stringify(buildManifest, null, 2) + "\n", "utf8");
  return { output: outputRoot, buildManifest, validation, visualReview };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const root = option(args, "--root") ? path.resolve(option(args, "--root")) : PACKAGE_ROOT;
  const input = option(args, "--input") ? path.resolve(option(args, "--input")) : path.join(root, "demo");
  const output = option(args, "--output") ? path.resolve(option(args, "--output")) : path.join(root, "demo", "dist");
  try {
    const result = buildPackage({
      root,
      input,
      output,
      force: args.includes("--force"),
      requireVisualReview: args.includes("--require-visual-review"),
      visualReviewGate: option(args, "--visual-review-gate") ?? "C"
    });
    console.log(JSON.stringify({
      status: "ok",
      output: result.output,
      asset_count: result.buildManifest.asset_count,
      shot_count: result.buildManifest.shot_count,
      total_duration: result.buildManifest.total_duration,
      visual_review: result.buildManifest.visual_review
    }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
