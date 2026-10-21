import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function finite(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function reportChange(report, field) {
  report.changed_fields.push(field);
}

function reportWarning(report, message) {
  report.warnings.push(message);
}

function positionFromLegacy(value, fallback = {}) {
  if (value && typeof value === "object" && Number.isFinite(value.x) && Number.isFinite(value.y)) {
    return { x: value.x, y: value.y };
  }
  return { x: finite(fallback.x), y: finite(fallback.y) };
}

export function migrateCamera(camera = {}, report = { changed_fields: [], warnings: [] }) {
  const from = camera.from
    ? { ...positionFromLegacy(camera.from), scale: finite(camera.from.scale, finite(camera.scale, 1)) }
    : {
        x: finite(camera.startX, finite(camera.x)),
        y: finite(camera.startY, finite(camera.y)),
        scale: finite(camera.scale, 1)
      };
  const to = camera.to
    ? { ...positionFromLegacy(camera.to), scale: finite(camera.to.scale, from.scale) }
    : {
        x: finite(camera.endX, from.x),
        y: finite(camera.endY, from.y),
        scale: finite(camera.toScale, from.scale)
      };
  if (camera.startX !== undefined || camera.endX !== undefined || camera.toScale !== undefined) reportChange(report, "camera.startX/endX/toScale → camera.from/to");
  return {
    type: camera.type ?? (camera.startX !== undefined || camera.endX !== undefined ? "pan" : "static"),
    from,
    to
  };
}

export function migrateCharacter(character = {}, report = { changed_fields: [], warnings: [] }) {
  const result = { id: character.id ?? character.asset_id ?? "character" };
  const hasLegacyPosition = ["startX", "startY", "endX", "endY"].some(key => character[key] !== undefined);
  if (character.mount_on) {
    result.mount_on = character.mount_on;
    result.mount_offset = character.mount_offset
      ? positionFromLegacy(character.mount_offset)
      : { x: finite(character.mount_offset_x), y: finite(character.mount_offset_y) };
  } else {
    result.from = character.from
      ? positionFromLegacy(character.from)
      : { x: finite(character.startX, finite(character.x)), y: finite(character.startY, finite(character.y)) };
    result.to = character.to
      ? positionFromLegacy(character.to)
      : { x: finite(character.endX, result.from.x), y: finite(character.endY, result.from.y) };
  }
  if (hasLegacyPosition) reportChange(report, `${result.id}: startX/startY/endX/endY → from/to`);
  if (character.scale !== undefined) result.scale = finite(character.scale, 1);
  if (character.rotation !== undefined || character.tilt_angle !== undefined) {
    result.rotation = finite(character.rotation, finite(character.tilt_angle));
    if (character.tilt_angle !== undefined) reportChange(report, `${result.id}: tilt_angle → rotation`);
  }
  const view = character.view ?? character.view_mode ?? character.forced_view;
  if (view) result.view = view === "profile" ? "side" : view;
  const facing = character.facing ?? character.facing_mode ?? character.forced_facing;
  if (facing) {
    result.facing = facing === "auto" ? "static" : facing;
    if (character.forced_facing !== undefined || character.facing_mode !== undefined) reportChange(report, `${result.id}: forced_facing/facing_mode → facing`);
  }
  const animation = character.animation ?? character.anim ?? (
    character.fly ? "fly" : character.riding ? "riding" : character.head_look_up ? "look_up" : character.walk ? "walk" : undefined
  );
  if (animation) result.animation = animation;
  if (character.action || character.actions) reportWarning(report, `${result.id}: action/actions 未納入 v0.2，已略過；請改由 animation 或後續 props 擴充`);
  return result;
}

export function migrateStoryboard(input = {}) {
  const report = { source_version: "0.1", target_version: "0.2.0", changed_fields: [], warnings: [] };
  if (!Array.isArray(input.shots)) {
    reportWarning(report, "來源沒有 shots 陣列，無法產生 storyboard");
    return { storyboard: { shots: [] }, report };
  }
  const storyboard = {
    shots: input.shots.map((shot, index) => {
      const next = {
        shot_id: shot.shot_id ?? shot.id ?? `shot_${String(index + 1).padStart(2, "0")}`,
        scene_id: shot.scene_id ?? shot.scene ?? "scene_legacy",
        duration: finite(shot.duration, 1),
        camera: migrateCamera(shot.camera ?? shot, report),
        background: shot.background ?? shot.background_id ?? shot.bgGroup ?? "bg_village",
        characters: Array.isArray(shot.characters) ? shot.characters.map(character => migrateCharacter(character, report)) : []
      };
      if (Array.isArray(shot.subtitles)) next.subtitles = shot.subtitles.map(subtitle => ({
        start: finite(subtitle.start),
        end: finite(subtitle.end, finite(shot.duration, 1)),
        text: String(subtitle.text ?? "")
      }));
      if (shot.bgGroup !== undefined) reportChange(report, `${next.shot_id}: bgGroup → background`);
      if (shot.action || shot.actions) reportWarning(report, `${next.shot_id}: shot action/actions 未納入 v0.2，已略過`);
      return next;
    })
  };
  return { storyboard, report };
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const inputPath = option(process.argv.slice(2), "--input");
  const outputPath = option(process.argv.slice(2), "--output");
  if (!inputPath || !outputPath) {
    console.error("Usage: node migrate-v0.1-to-v0.2.mjs --input <legacy.json> --output <storyboard.json>");
    process.exitCode = 2;
  } else if (fs.existsSync(outputPath) && !process.argv.includes("--force")) {
    console.error(`OUTPUT_EXISTS ${outputPath}; 使用 --force 才能覆寫`);
    process.exitCode = 2;
  } else {
    const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    const result = migrateStoryboard(input);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(result.storyboard, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output: outputPath, report: result.report }, null, 2));
  }
}

