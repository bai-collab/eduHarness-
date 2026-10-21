import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeSvgFile } from "./sanitize-svg.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_PARALLAX = { sky: 0, far: 0.2, middle: 0.5, ground: 1 };
const CAMERA_TYPES = new Set(["wide", "medium", "close-up", "extreme-close-up", "pan", "zoom", "static", "tracking"]);
const VIEWS = new Set(["side", "front", "back"]);
const FACINGS = new Set(["forward", "left", "right", "static"]);
const ANIMATIONS = new Set(["idle", "walk", "fly", "look_up", "riding"]);
const ASSET_FORMATS = new Set(["svg", "png"]);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_BIT_DEPTHS = new Map([
  [0, new Set([1, 2, 4, 8, 16])],
  [2, new Set([8, 16])],
  [3, new Set([1, 2, 4, 8])],
  [4, new Set([8, 16])],
  [6, new Set([8, 16])]
]);
const MAX_PNG_BYTES = 32 * 1024 * 1024;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function add(errors, code, detail) {
  errors.push({ code, detail });
}

function checkKeys(value, allowed, location, errors) {
  if (!isRecord(value)) {
    add(errors, "OBJECT_REQUIRED", `${location} 必須是物件`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) add(errors, "UNKNOWN_FIELD", `${location}.${key} 不是 v0.2 欄位`);
  }
}

function checkString(value, location, errors) {
  if (typeof value !== "string" || !value.trim()) add(errors, "STRING_REQUIRED", `${location} 必須是非空字串`);
}

function checkPositiveNumber(value, location, errors) {
  if (!finiteNumber(value) || value <= 0) add(errors, "POSITIVE_NUMBER_REQUIRED", `${location} 必須是大於 0 的數字`);
}

function checkPosition(value, location, errors, { scale = false } = {}) {
  if (!isRecord(value)) {
    add(errors, "POSITION_REQUIRED", `${location} 必須包含 x、y`);
    return;
  }
  checkKeys(value, new Set(scale ? ["x", "y", "scale"] : ["x", "y"]), location, errors);
  if (!finiteNumber(value.x)) add(errors, "COORDINATE_INVALID", `${location}.x 必須是有限數字`);
  if (!finiteNumber(value.y)) add(errors, "COORDINATE_INVALID", `${location}.y 必須是有限數字`);
  if (scale && (!finiteNumber(value.scale) || value.scale <= 0)) add(errors, "SCALE_INVALID", `${location}.scale 必須大於 0`);
}

function checkScale(value, location, errors) {
  if (!isRecord(value)) {
    add(errors, "SCALE_REQUIRED", `${location} 必須包含 x、y`);
    return;
  }
  checkKeys(value, new Set(["x", "y"]), location, errors);
  if (!finiteNumber(value.x) || value.x <= 0) add(errors, "SCALE_INVALID", `${location}.x 必須大於 0`);
  if (!finiteNumber(value.y) || value.y <= 0) add(errors, "SCALE_INVALID", `${location}.y 必須大於 0`);
}

function checkPositionControl(value, location, errors) {
  if (!isRecord(value)) {
    add(errors, "POSITION_CONTROL_REQUIRED", `${location} 必須是包含 x／y channel 名稱的物件`);
    return;
  }
  checkKeys(value, new Set(["x", "y"]), location, errors);
  for (const axis of ["x", "y"]) {
    if (value[axis] !== undefined && value[axis] !== null) checkString(value[axis], `${location}.${axis}`, errors);
  }
}

function checkJointAnchor(value, location, errors) {
  if (!isRecord(value)) {
    add(errors, "JOINT_ANCHOR_REQUIRED", `${location} 必須包含 role、source_size、source_px`);
    return;
  }
  checkKeys(value, new Set(["role", "source_size", "source_px"]), location, errors);
  checkString(value.role, `${location}.role`, errors);
  if (!isRecord(value.source_size)) {
    add(errors, "JOINT_ANCHOR_SIZE_REQUIRED", `${location}.source_size 必須包含 width、height`);
  } else {
    checkKeys(value.source_size, new Set(["width", "height"]), `${location}.source_size`, errors);
    checkPositiveNumber(value.source_size.width, `${location}.source_size.width`, errors);
    checkPositiveNumber(value.source_size.height, `${location}.source_size.height`, errors);
  }
  checkPosition(value.source_px, `${location}.source_px`, errors);
}

function safeRelativePath(root, value, location, errors, extension = null) {
  if (typeof value !== "string" || !value.trim() || value.includes("\\") || value.includes("\0")) {
    add(errors, "PATH_INVALID", `${location} 必須是使用 / 的相對路徑`);
    return null;
  }
  const normalised = path.posix.normalize(value);
  if (path.posix.isAbsolute(value) || value.split("/").includes("..") || normalised === ".." || normalised.startsWith("../") || value.includes("://")) {
    add(errors, "PATH_OUTSIDE_ROOT", `${location} 不得離開 Demo 根目錄或指向 URL`);
    return null;
  }
  if (extension && !normalised.toLowerCase().endsWith(extension)) add(errors, "PATH_EXTENSION_INVALID", `${location} 必須以 ${extension} 結尾`);
  const resolved = path.resolve(root, normalised);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    add(errors, "PATH_OUTSIDE_ROOT", `${location} 超出 Demo 根目錄`);
    return null;
  }
  return resolved;
}

function readJson(root, relative, errors, label) {
  const file = safeRelativePath(root, relative, `${label} path`, errors, ".json");
  if (!file || !fs.existsSync(file)) {
    add(errors, "FILE_MISSING", `${label} 不存在：${relative}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    add(errors, "JSON_INVALID", `${label} 無法解析：${error.message}`);
    return null;
  }
}

function validateManifest(manifest, root, errors) {
  checkKeys(manifest, new Set(["title", "version", "fps", "resolution", "style", "render", "scenes", "files"]), "movie", errors);
  checkString(manifest?.title, "movie.title", errors);
  if (manifest?.version !== "0.2.0") add(errors, "VERSION_INVALID", "movie.version 必須是 0.2.0");
  if (!Number.isInteger(manifest?.fps) || manifest.fps < 12 || manifest.fps > 60) add(errors, "FPS_INVALID", "movie.fps 必須是 12–60 的整數");
  checkKeys(manifest?.resolution, new Set(["width", "height"]), "movie.resolution", errors);
  for (const key of ["width", "height"]) {
    if (!Number.isInteger(manifest?.resolution?.[key]) || manifest.resolution[key] <= 0) add(errors, "RESOLUTION_INVALID", `movie.resolution.${key} 必須是正整數`);
  }
  checkKeys(manifest?.style, new Set(["type", "lighting", "color_palette", "parallax"]), "movie.style", errors);
  if (!new Set(["shadow_puppet", "paper_cut", "silhouette"]).has(manifest?.style?.type)) add(errors, "STYLE_INVALID", "movie.style.type 不在支援集合");
  checkKeys(manifest?.style?.parallax, new Set(["sky", "far", "middle", "ground"]), "movie.style.parallax", errors);
  for (const [key, expected] of Object.entries(REQUIRED_PARALLAX)) {
    if (manifest?.style?.parallax?.[key] !== expected) add(errors, "PARALLAX_INVALID", `movie.style.parallax.${key} 必須是 ${expected}`);
  }
  if (manifest?.render !== undefined) {
    checkKeys(manifest.render, new Set(["backend", "interpolation"]), "movie.render", errors);
    if (manifest.render.backend !== undefined && !["auto", "svg-cpu", "webgpu"].includes(manifest.render.backend)) add(errors, "RENDER_BACKEND_INVALID", "movie.render.backend 不在支援集合");
    if (manifest.render.interpolation !== undefined && typeof manifest.render.interpolation !== "boolean") add(errors, "RENDER_INTERPOLATION_INVALID", "movie.render.interpolation 必須是布林值");
  }
  if (!Array.isArray(manifest?.scenes) || !manifest.scenes.length) add(errors, "SCENES_REQUIRED", "movie.scenes 不得為空");
  const sceneIds = new Set();
  for (const [index, sceneId] of (manifest?.scenes ?? []).entries()) {
    checkString(sceneId, `movie.scenes[${index}]`, errors);
    if (sceneIds.has(sceneId)) add(errors, "DUPLICATE_ID", `movie.scenes 重複：${sceneId}`);
    sceneIds.add(sceneId);
  }
  checkKeys(manifest?.files, new Set(["script", "storyboard", "assets"]), "movie.files", errors);
  for (const key of ["script", "storyboard", "assets"]) safeRelativePath(root, manifest?.files?.[key], `movie.files.${key}`, errors, ".json");
  return sceneIds;
}

function validateScript(script, sceneIds, errors) {
  checkKeys(script, new Set(["title", "scenes"]), "script", errors);
  checkString(script?.title, "script.title", errors);
  if (!Array.isArray(script?.scenes) || !script.scenes.length) add(errors, "SCRIPT_SCENES_REQUIRED", "script.scenes 不得為空");
  const found = new Set();
  for (const [index, scene] of (script?.scenes ?? []).entries()) {
    const location = `script.scenes[${index}]`;
    checkKeys(scene, new Set(["scene_id", "title", "location", "time", "description", "characters", "dialogue", "narration", "sound", "duration_estimate"]), location, errors);
    checkString(scene?.scene_id, `${location}.scene_id`, errors);
    checkString(scene?.title, `${location}.title`, errors);
    checkPositiveNumber(scene?.duration_estimate, `${location}.duration_estimate`, errors);
    if (sceneIds && !sceneIds.has(scene?.scene_id)) add(errors, "SCENE_REFERENCE_MISSING", `${location}.scene_id 未出現在 movie.scenes`);
    if (found.has(scene?.scene_id)) add(errors, "DUPLICATE_ID", `script scene 重複：${scene?.scene_id}`);
    found.add(scene?.scene_id);
  }
  if (sceneIds) for (const sceneId of sceneIds) if (!found.has(sceneId)) add(errors, "SCENE_REFERENCE_MISSING", `movie.scenes 缺少 script scene：${sceneId}`);
  return found;
}

export function readPngMetadata(file) {
  const stat = fs.statSync(file);
  if (stat.size > MAX_PNG_BYTES) throw new Error(`PNG_UNSAFE 檔案超過 ${MAX_PNG_BYTES} bytes`);
  const buffer = fs.readFileSync(file);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("PNG_INVALID 檔案簽名不是 PNG");
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") throw new Error("PNG_INVALID 缺少有效 IHDR header");
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const compression = buffer[26];
  const filter = buffer[27];
  const interlace = buffer[28];
  if (!width || !height || width > 32768 || height > 32768) throw new Error("PNG_INVALID 尺寸必須介於 1 到 32768 像素");
  if (!PNG_BIT_DEPTHS.has(colorType) || !PNG_BIT_DEPTHS.get(colorType).has(bitDepth)) throw new Error("PNG_INVALID 不支援的 color type／bit depth 組合");
  if (compression !== 0 || filter !== 0 || ![0, 1].includes(interlace)) throw new Error("PNG_INVALID IHDR 壓縮、filter 或 interlace 欄位無效");
  return {
    format: "png",
    width,
    height,
    bitDepth,
    colorType,
    hasAlpha: colorType === 4 || colorType === 6,
    interlace
  };
}

function validateAssetPath(root, value, location, errors, { format = null, requireAlpha = false } = {}) {
  const file = safeRelativePath(root, value, location, errors, format ? `.${format}` : null);
  if (!file || !fs.existsSync(file)) {
    add(errors, "ASSET_FILE_MISSING", `${location} 不存在：${value}`);
    return null;
  }
  const extension = path.extname(file).toLowerCase();
  if (extension === ".svg") {
    try {
      sanitizeSvgFile(file);
      return { file, format: "svg" };
    } catch (error) {
      add(errors, "SVG_UNSAFE", error.message);
      return null;
    }
  }
  if (extension === ".png") {
    try {
      const metadata = readPngMetadata(file);
      if (requireAlpha && !metadata.hasAlpha) add(errors, "PNG_ALPHA_REQUIRED", `${location} 必須保留 alpha 透明通道`);
      return { file, format: "png", metadata };
    } catch (error) {
      add(errors, "PNG_INVALID", `${location}：${error.message}`);
      return null;
    }
  }
  add(errors, "ASSET_FORMAT_UNSUPPORTED", `${location} 只支援 .svg 或 .png`);
  return null;
}

function validateFrameSequence(asset, root, location, errors) {
  const sequence = asset.frame_sequence;
  checkKeys(sequence, new Set(["frames", "hold_ticks", "phase_ticks", "loop"]), location, errors);
  if (asset.type !== "character") add(errors, "FRAME_SEQUENCE_TYPE_INVALID", `${location} 目前只支援 character asset`);
  if (asset.format !== "png") add(errors, "FRAME_SEQUENCE_FORMAT_INVALID", `${location} 目前只支援 format=png`);
  if (!Array.isArray(sequence?.frames) || sequence.frames.length === 0) {
    add(errors, "FRAME_SEQUENCE_REQUIRED", `${location}.frames 至少要有一張 PNG`);
  }
  if (sequence?.hold_ticks !== undefined && (!Number.isInteger(sequence.hold_ticks) || sequence.hold_ticks < 1)) {
    add(errors, "FRAME_HOLD_TICKS_INVALID", `${location}.hold_ticks 必須是大於 0 的整數`);
  }
  if (sequence?.phase_ticks !== undefined && (!Number.isInteger(sequence.phase_ticks) || sequence.phase_ticks < 0)) {
    add(errors, "FRAME_PHASE_TICKS_INVALID", `${location}.phase_ticks 必須是不小於 0 的整數`);
  }
  if (sequence?.loop !== undefined && typeof sequence.loop !== "boolean") add(errors, "FRAME_LOOP_INVALID", `${location}.loop 必須是布林值`);
  const dimensions = [];
  for (const [index, source] of (sequence?.frames ?? []).entries()) {
    const result = validateAssetPath(root, source, `${location}.frames[${index}]`, errors, {
      format: asset.format,
      requireAlpha: asset.type === "character"
    });
    if (result?.metadata) dimensions.push(result.metadata);
  }
  const first = dimensions[0];
  if (first && dimensions.some(metadata => metadata.width !== first.width || metadata.height !== first.height)) {
    add(errors, "FRAME_DIMENSIONS_MISMATCH", `${location}.frames 必須使用相同的 PNG 寬高`);
  }
}

function validateRig(rig, location, errors) {
  checkKeys(rig, new Set(["version", "bones", "attachments", "objects"]), location, errors);
  if (rig?.version !== "0.1.0") add(errors, "RIG_VERSION_INVALID", `${location}.version 必須是 0.1.0`);
  if (!Array.isArray(rig?.bones) || !rig.bones.length) {
    add(errors, "RIG_BONES_REQUIRED", `${location}.bones 不得為空`);
    return;
  }

  const boneIds = new Map();
  for (const [index, bone] of rig.bones.entries()) {
    const boneLocation = `${location}.bones[${index}]`;
    checkKeys(bone, new Set(["id", "parent", "local_position", "local_rotation", "local_scale", "control", "position_control", "rest_stage_origin"]), boneLocation, errors);
    checkString(bone?.id, `${boneLocation}.id`, errors);
    if (boneIds.has(bone?.id)) add(errors, "DUPLICATE_ID", `${location}.bones 重複：${bone?.id}`);
    boneIds.set(bone?.id, index);
    if (bone?.parent !== null && typeof bone?.parent !== "string") add(errors, "RIG_PARENT_INVALID", `${boneLocation}.parent 必須是字串或 null`);
    checkPosition(bone?.local_position, `${boneLocation}.local_position`, errors);
    if (bone?.local_rotation !== undefined && !finiteNumber(bone.local_rotation)) add(errors, "ROTATION_INVALID", `${boneLocation}.local_rotation 必須是有限數字`);
    if (bone?.local_scale !== undefined) checkScale(bone.local_scale, `${boneLocation}.local_scale`, errors);
    if (bone?.control !== undefined && bone.control !== null) checkString(bone.control, `${boneLocation}.control`, errors);
    if (bone?.position_control !== undefined) checkPositionControl(bone.position_control, `${boneLocation}.position_control`, errors);
    if (bone?.rest_stage_origin !== undefined) checkPosition(bone.rest_stage_origin, `${boneLocation}.rest_stage_origin`, errors);
  }

  const depthMemo = new Map();
  function depthFor(index, visiting = new Set()) {
    if (depthMemo.has(index)) return depthMemo.get(index);
    if (visiting.has(index)) {
      add(errors, "RIG_CYCLE", `${location}.bones 發現 parent 循環`);
      return 0;
    }
    const bone = rig.bones[index];
    if (bone?.parent === null || bone?.parent === undefined) {
      depthMemo.set(index, 0);
      return 0;
    }
    const parentIndex = boneIds.get(bone.parent);
    if (parentIndex === undefined) {
      add(errors, "RIG_PARENT_REFERENCE_MISSING", `${location}.bones[${index}].parent 找不到：${bone.parent}`);
      depthMemo.set(index, 0);
      return 0;
    }
    const next = new Set(visiting);
    next.add(index);
    const depth = depthFor(parentIndex, next) + 1;
    depthMemo.set(index, depth);
    return depth;
  }
  for (let index = 0; index < rig.bones.length; index += 1) depthFor(index);

  const attachments = [
    ...(Array.isArray(rig.attachments) ? rig.attachments : []),
    ...(Array.isArray(rig.objects) ? rig.objects : [])
  ];
  if (rig.attachments !== undefined && !Array.isArray(rig.attachments)) add(errors, "RIG_ATTACHMENTS_INVALID", `${location}.attachments 必須是陣列`);
  if (rig.objects !== undefined && !Array.isArray(rig.objects)) add(errors, "RIG_OBJECTS_INVALID", `${location}.objects 必須是陣列`);
  const attachmentIds = new Set();
  for (const [index, attachment] of attachments.entries()) {
    const attachmentLocation = `${location}.attachments_and_objects[${index}]`;
    checkKeys(attachment, new Set(["id", "kind", "bone", "asset", "local_position", "local_rotation", "local_scale", "mirror", "joint_anchor", "inherit_rotation", "inherit_scale", "z"]), attachmentLocation, errors);
    checkString(attachment?.id, `${attachmentLocation}.id`, errors);
    if (attachmentIds.has(attachment?.id)) add(errors, "DUPLICATE_ID", `${location}.attachments／objects 重複：${attachment?.id}`);
    attachmentIds.add(attachment?.id);
    checkString(attachment?.bone, `${attachmentLocation}.bone`, errors);
    if (!boneIds.has(attachment?.bone)) add(errors, "RIG_ATTACHMENT_BONE_MISSING", `${attachmentLocation}.bone 找不到：${attachment?.bone}`);
    checkString(attachment?.asset, `${attachmentLocation}.asset`, errors);
    checkPosition(attachment?.local_position, `${attachmentLocation}.local_position`, errors);
    if (attachment?.local_rotation !== undefined && !finiteNumber(attachment.local_rotation)) add(errors, "ROTATION_INVALID", `${attachmentLocation}.local_rotation 必須是有限數字`);
    if (attachment?.local_scale !== undefined) checkScale(attachment.local_scale, `${attachmentLocation}.local_scale`, errors);
    if (attachment?.joint_anchor !== undefined) checkJointAnchor(attachment.joint_anchor, `${attachmentLocation}.joint_anchor`, errors);
    if (attachment?.mirror === true && attachment?.joint_anchor === undefined) add(errors, "MIRROR_JOINT_ANCHOR_REQUIRED", `${attachmentLocation}.mirror=true 必須提供 joint_anchor`);
    for (const key of ["mirror", "inherit_rotation", "inherit_scale"]) {
      if (attachment?.[key] !== undefined && typeof attachment[key] !== "boolean") add(errors, "BOOLEAN_INVALID", `${attachmentLocation}.${key} 必須是布林值`);
    }
    if (attachment?.z !== undefined && !finiteNumber(attachment.z)) add(errors, "Z_INVALID", `${attachmentLocation}.z 必須是有限數字`);
  }
}

function validateAssets(assetsDocument, root, errors) {
  checkKeys(assetsDocument, new Set(["assets"]), "assets", errors);
  if (!Array.isArray(assetsDocument?.assets) || !assetsDocument.assets.length) add(errors, "ASSETS_REQUIRED", "assets.assets 不得為空");
  const assetIds = new Set();
  const assets = new Map();
  for (const [index, asset] of (assetsDocument?.assets ?? []).entries()) {
    const location = `assets.assets[${index}]`;
    checkKeys(asset, new Set(["id", "name", "type", "format", "src", "views", "layers", "parts", "animations", "rig", "frame_sequence"]), location, errors);
    checkString(asset?.id, `${location}.id`, errors);
    checkString(asset?.name, `${location}.name`, errors);
    if (!["character", "background"].includes(asset?.type)) add(errors, "ASSET_TYPE_INVALID", `${location}.type 不在支援集合`);
    if (!ASSET_FORMATS.has(asset?.format)) add(errors, "ASSET_FORMAT_INVALID", `${location}.format 必須是 svg 或 png`);
    if (assetIds.has(asset?.id)) add(errors, "DUPLICATE_ID", `asset 重複：${asset?.id}`);
    assetIds.add(asset?.id);
    assets.set(asset?.id, asset);
    if (asset?.src !== undefined) validateAssetPath(root, asset.src, `${location}.src`, errors, {
      format: asset.format,
      requireAlpha: asset.type === "character"
    });
    if (asset?.type === "character") {
      const hasViews = isRecord(asset?.views) && Object.keys(asset.views).length > 0;
      const hasSrc = typeof asset?.src === "string" && asset.src.trim().length > 0;
      const hasFrameSequence = isRecord(asset?.frame_sequence) && Array.isArray(asset.frame_sequence.frames) && asset.frame_sequence.frames.length > 0;
      if (!hasViews && !hasSrc && !hasFrameSequence) add(errors, "CHARACTER_VIEW_REQUIRED", `${location} 必須提供 src、views 或 frame_sequence`);
      if (asset?.views !== undefined && !isRecord(asset.views)) add(errors, "ASSET_VIEWS_INVALID", `${location}.views 必須是物件`);
      for (const [view, source] of Object.entries(isRecord(asset?.views) ? asset.views : {})) {
        if (!VIEWS.has(view)) add(errors, "VIEW_INVALID", `${location}.views.${view} 不是 side/front/back`);
        validateAssetPath(root, source, `${location}.views.${view}`, errors, {
          format: asset.format,
          requireAlpha: true
        });
      }
    }
    if (asset?.type === "background") {
      const hasSrc = typeof asset?.src === "string" && asset.src.trim().length > 0;
      const hasLayers = isRecord(asset?.layers) && Object.values(asset.layers).some(value => typeof value === "string" && value.trim().length > 0);
      if (!hasSrc && !hasLayers) add(errors, "BACKGROUND_SOURCE_REQUIRED", `${location} 必須提供 src 或 layers`);
      if (asset?.layers !== undefined && !isRecord(asset.layers)) add(errors, "ASSET_LAYERS_INVALID", `${location}.layers 必須是物件`);
      for (const layer of ["far", "middle", "ground"]) {
        if (isRecord(asset?.layers) && asset.layers[layer] !== undefined) validateAssetPath(root, asset.layers[layer], `${location}.layers.${layer}`, errors, { format: asset.format });
      }
    }
    if (asset?.frame_sequence !== undefined) validateFrameSequence(asset, root, `${location}.frame_sequence`, errors);
    if (asset?.rig !== undefined) validateRig(asset.rig, `${location}.rig`, errors);
  }
  return assets;
}

function validateCharacter(character, location, ids, errors) {
  checkKeys(character, new Set(["id", "from", "to", "scale", "rotation", "view", "facing", "animation", "mount_on", "mount_offset"]), location, errors);
  checkString(character?.id, `${location}.id`, errors);
  if (ids.has(character?.id)) add(errors, "DUPLICATE_ID", `${location}.id 在同一鏡頭重複：${character?.id}`);
  ids.add(character?.id);
  if (character?.from === undefined && !character?.mount_on) add(errors, "CHARACTER_POSITION_REQUIRED", `${location} 必須有 from 或 mount_on`);
  if (character?.from !== undefined) checkPosition(character.from, `${location}.from`, errors);
  if (character?.to !== undefined) checkPosition(character.to, `${location}.to`, errors);
  if (character?.scale !== undefined && (!finiteNumber(character.scale) || character.scale <= 0)) add(errors, "SCALE_INVALID", `${location}.scale 必須大於 0`);
  if (character?.rotation !== undefined && !finiteNumber(character.rotation)) add(errors, "ROTATION_INVALID", `${location}.rotation 必須是有限數字`);
  if (character?.view !== undefined && !VIEWS.has(character.view)) add(errors, "VIEW_INVALID", `${location}.view 不在支援集合`);
  if (character?.facing !== undefined && !FACINGS.has(character.facing)) add(errors, "FACING_INVALID", `${location}.facing 不在支援集合`);
  if (character?.animation !== undefined && !ANIMATIONS.has(character.animation)) add(errors, "ANIMATION_INVALID", `${location}.animation 不在支援集合`);
  if (character?.mount_on !== undefined) {
    checkString(character.mount_on, `${location}.mount_on`, errors);
    checkPosition(character.mount_offset, `${location}.mount_offset`, errors);
    if (character.mount_on === character.id) add(errors, "MOUNT_CYCLE", `${location} 不得掛載自己`);
  }
}

function validateStoryboard(storyboard, sceneIds, assets, errors) {
  checkKeys(storyboard, new Set(["shots"]), "storyboard", errors);
  if (!Array.isArray(storyboard?.shots) || !storyboard.shots.length) add(errors, "SHOTS_REQUIRED", "storyboard.shots 不得為空");
  const shotIds = new Set();
  const sceneDurations = new Map();
  for (const [index, shot] of (storyboard?.shots ?? []).entries()) {
    const location = `storyboard.shots[${index}]`;
    checkKeys(shot, new Set(["shot_id", "scene_id", "duration", "camera", "background", "characters", "subtitles"]), location, errors);
    checkString(shot?.shot_id, `${location}.shot_id`, errors);
    if (shotIds.has(shot?.shot_id)) add(errors, "DUPLICATE_ID", `shot 重複：${shot?.shot_id}`);
    shotIds.add(shot?.shot_id);
    if (sceneIds && !sceneIds.has(shot?.scene_id)) add(errors, "SCENE_REFERENCE_MISSING", `${location}.scene_id 未出現在 movie.scenes`);
    checkPositiveNumber(shot?.duration, `${location}.duration`, errors);
    sceneDurations.set(shot?.scene_id, (sceneDurations.get(shot?.scene_id) ?? 0) + (finiteNumber(shot?.duration) ? shot.duration : 0));
    checkKeys(shot?.camera, new Set(["type", "from", "to"]), `${location}.camera`, errors);
    if (!CAMERA_TYPES.has(shot?.camera?.type)) add(errors, "CAMERA_TYPE_INVALID", `${location}.camera.type 不在支援集合`);
    checkPosition(shot?.camera?.from, `${location}.camera.from`, errors, { scale: true });
    if (shot?.camera?.to !== undefined) checkPosition(shot.camera.to, `${location}.camera.to`, errors, { scale: true });
    if (!assets?.has(shot?.background) || assets.get(shot.background)?.type !== "background") add(errors, "BACKGROUND_REFERENCE_MISSING", `${location}.background 找不到 background asset：${shot?.background}`);
    if (!Array.isArray(shot?.characters)) add(errors, "CHARACTERS_REQUIRED", `${location}.characters 必須是陣列`);
    const characterIds = new Set();
    for (const [characterIndex, character] of (shot?.characters ?? []).entries()) {
      const characterLocation = `${location}.characters[${characterIndex}]`;
      validateCharacter(character, characterLocation, characterIds, errors);
      if (!assets?.has(character?.id) || assets.get(character.id)?.type !== "character") add(errors, "CHARACTER_REFERENCE_MISSING", `${characterLocation}.id 找不到 character asset：${character?.id}`);
    }
    for (const character of shot?.characters ?? []) {
      if (character?.mount_on && !characterIds.has(character.mount_on)) add(errors, "MOUNT_REFERENCE_MISSING", `${location} 的 mount_on 找不到：${character.mount_on}`);
    }
    const visiting = new Set();
    const visited = new Set();
    const byId = new Map((shot?.characters ?? []).map(character => [character.id, character]));
    const visit = id => {
      if (visiting.has(id)) {
        add(errors, "MOUNT_CYCLE", `${location} 發現 mount_on 循環`);
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      const parent = byId.get(id)?.mount_on;
      if (parent && byId.has(parent)) visit(parent);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of byId.keys()) visit(id);
    if (shot?.subtitles !== undefined && !Array.isArray(shot.subtitles)) add(errors, "SUBTITLES_INVALID", `${location}.subtitles 必須是陣列`);
    for (const [subtitleIndex, subtitle] of (shot?.subtitles ?? []).entries()) {
      const subtitleLocation = `${location}.subtitles[${subtitleIndex}]`;
      checkKeys(subtitle, new Set(["start", "end", "text"]), subtitleLocation, errors);
      if (!finiteNumber(subtitle?.start) || subtitle.start < 0) add(errors, "SUBTITLE_START_INVALID", `${subtitleLocation}.start 必須不小於 0`);
      if (!finiteNumber(subtitle?.end) || subtitle.end <= (subtitle?.start ?? 0) || subtitle.end > (shot?.duration ?? 0)) add(errors, "SUBTITLE_END_INVALID", `${subtitleLocation}.end 必須大於 start 且不超過鏡頭長度`);
      if (typeof subtitle?.text !== "string" || !subtitle.text.trim()) add(errors, "SUBTITLE_TEXT_REQUIRED", `${subtitleLocation}.text 不得為空`);
    }
  }
  return sceneDurations;
}

export function validateDemoDir(demoRoot) {
  const root = path.resolve(demoRoot);
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return { ok: false, errors: [{ code: "DEMO_ROOT_MISSING", detail: root }], warnings };
  const manifestFile = path.join(root, "movie.json");
  if (!fs.existsSync(manifestFile)) return { ok: false, errors: [{ code: "MANIFEST_MISSING", detail: "movie.json" }], warnings };
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch (error) {
    return { ok: false, errors: [{ code: "JSON_INVALID", detail: `movie.json：${error.message}` }], warnings };
  }
  const sceneIds = validateManifest(manifest, root, errors);
  const script = readJson(root, manifest?.files?.script, errors, "script");
  const storyboard = readJson(root, manifest?.files?.storyboard, errors, "storyboard");
  const assetsDocument = readJson(root, manifest?.files?.assets, errors, "assets");
  const scriptSceneIds = script ? validateScript(script, sceneIds, errors) : new Set();
  const assets = assetsDocument ? validateAssets(assetsDocument, root, errors) : new Map();
  const sceneDurations = storyboard ? validateStoryboard(storyboard, sceneIds, assets, errors) : new Map();
  for (const sceneId of sceneIds ?? []) {
    const scriptScene = (script?.scenes ?? []).find(scene => scene.scene_id === sceneId);
    const storyboardDuration = sceneDurations.get(sceneId);
    if (scriptScene && finiteNumber(storyboardDuration) && Math.abs(storyboardDuration - scriptScene.duration_estimate) > 0.01) {
      add(errors, "DURATION_MISMATCH", `${sceneId} 的 storyboard ${storyboardDuration}s 與 script ${scriptScene.duration_estimate}s 不一致`);
    }
  }
  const totalDuration = [...sceneDurations.values()].reduce((sum, value) => sum + value, 0);
  if (manifest && storyboard && totalDuration <= 0) add(errors, "DURATION_INVALID", "所有鏡頭總長度必須大於 0");
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    root,
    manifest,
    script,
    storyboard,
    assets: assetsDocument,
    totalDuration,
    sceneIds: [...(sceneIds ?? [])],
    scriptSceneIds: [...scriptSceneIds]
  };
}

export function validateStoryboardDocument(storyboard, { sceneIds = new Set(), assets = new Map() } = {}) {
  const errors = [];
  validateStoryboard(storyboard, sceneIds, assets, errors);
  return { ok: errors.length === 0, errors };
}

export function validateRigDocument(rig) {
  const errors = [];
  validateRig(rig, "rig", errors);
  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const rootArgument = process.argv.indexOf("--root");
  const root = rootArgument >= 0 ? process.argv[rootArgument + 1] : PACKAGE_ROOT;
  const result = validateDemoDir(root);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
