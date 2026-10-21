import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_VERSION = "0.1.0";
const DEFAULT_FILE = "visual-review.json";
const MASTER_PROMPT_ID = "shadow-puppet-master-visual";
const MASTER_PROMPT_SOURCE = "shadow-movie/references/master-visual-prompt.md";
const MODES = new Set(["reference", "art-direction"]);
const GATES = new Set(["C", "D", "E"]);
const GATE_STATUSES = new Set(["pending", "needs_revision", "approved"]);
const APPROVAL_STATUSES = new Set(["pending", "approved"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const MEDIA_EXTENSIONS = new Set([".png", ".svg"]);
const CRITERIA = [
  { id: "composition", label: "構圖與比例" },
  { id: "silhouette", label: "剪影與造型" },
  { id: "material-light", label: "皮影材質與光影" },
  { id: "cutout-detail", label: "鏤空與細節密度" },
  { id: "joints-rods", label: "關節與操偶桿" },
  { id: "depth-occlusion", label: "景深與遮擋" },
  { id: "motion-integrity", label: "動畫後的骨架完整性" },
  { id: "web-rendering", label: "HTML 實機畫面" }
];
const CRITERIA_BY_ID = new Map(CRITERIA.map(criteria => [criteria.id, criteria]));
const BASE_CRITERIA = CRITERIA.slice(0, 6).map(criteria => criteria.id);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function add(errors, code, detail) {
  errors.push({ code, detail });
}

function checkKeys(value, allowed, location, errors) {
  if (!isRecord(value)) {
    add(errors, "VISUAL_OBJECT_REQUIRED", `${location} 必須是物件`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) add(errors, "VISUAL_REVIEW_UNKNOWN_FIELD", `${location}.${key} 不是 visual review 契約欄位`);
  }
}

function checkString(value, location, errors, code = "VISUAL_STRING_REQUIRED") {
  if (typeof value !== "string" || !value.trim()) add(errors, code, `${location} 必須是非空字串`);
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function safeRelativePath(root, value, location, errors, {
  invalidCode = "VISUAL_PATH_INVALID",
  outsideCode = "VISUAL_PATH_OUTSIDE_ROOT",
  extensionCode = "VISUAL_PATH_EXTENSION_INVALID",
  extensions = null
} = {}) {
  if (typeof value !== "string" || !value.trim() || value.includes("\\") || value.includes("\0")) {
    add(errors, invalidCode, `${location} 必須是使用 / 的相對路徑`);
    return null;
  }
  const segments = value.split("/");
  const normalised = path.posix.normalize(value);
  if (path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.includes("://") || segments.includes("..")) {
    add(errors, outsideCode, `${location} 不得離開輸入根目錄或指向 URL`);
    return null;
  }
  if (extensions && !extensions.has(path.posix.extname(normalised).toLowerCase())) {
    add(errors, extensionCode, `${location} 必須是 ${[...extensions].join(", ")} 檔案`);
  }
  const resolved = path.resolve(root, normalised);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    add(errors, outsideCode, `${location} 超出輸入根目錄`);
    return null;
  }
  return resolved;
}

function checkExistingPath(root, value, location, errors, {
  invalidCode,
  outsideCode,
  extensionCode,
  missingCode,
  extensions
} = {}) {
  const file = safeRelativePath(root, value, location, errors, {
    invalidCode,
    outsideCode,
    extensionCode,
    extensions
  });
  if (file && !isFile(file)) add(errors, missingCode, `${location} 不存在：${value}`);
  return file;
}

function normaliseGate(value) {
  const normalised = String(value ?? "all").toUpperCase();
  return normalised === "ALL" ? "all" : normalised;
}

function gatesRequiredFor(gate) {
  if (gate === "C") return ["C"];
  if (gate === "D") return ["C", "D"];
  return ["C", "D", "E"];
}

function criteriaRequiredFor(gate) {
  if (gate === "C") return BASE_CRITERIA;
  if (gate === "D") return [...BASE_CRITERIA, "motion-integrity"];
  return CRITERIA.map(criteria => criteria.id);
}

function validateReference(review, root, errors) {
  if (review.mode === "reference") {
    if (!isRecord(review.reference)) {
      add(errors, "VISUAL_REFERENCE_REQUIRED", "reference 模式必須提供 reference style anchor");
      return;
    }
    checkKeys(review.reference, new Set(["path", "role", "approval"]), "reference", errors);
    checkExistingPath(root, review.reference.path, "reference.path", errors, {
      invalidCode: "VISUAL_REFERENCE_PATH_INVALID",
      outsideCode: "VISUAL_REFERENCE_PATH_OUTSIDE_ROOT",
      extensionCode: "VISUAL_REFERENCE_EXTENSION_INVALID",
      missingCode: "VISUAL_REFERENCE_FILE_MISSING",
      extensions: IMAGE_EXTENSIONS
    });
    if (review.reference.role !== "style-anchor") add(errors, "VISUAL_REFERENCE_ROLE_INVALID", "reference.role 必須是 style-anchor");
    if (review.reference.approval !== "user-approved") add(errors, "VISUAL_REFERENCE_APPROVAL_REQUIRED", "reference.approval 必須明確記錄 user-approved");
    return;
  }
  if (review.reference !== undefined && review.reference !== null) {
    if (!isRecord(review.reference)) {
      add(errors, "VISUAL_REFERENCE_INVALID", "art-direction 模式的 reference 若存在必須是物件");
      return;
    }
    checkKeys(review.reference, new Set(["path", "role", "approval"]), "reference", errors);
    checkExistingPath(root, review.reference.path, "reference.path", errors, {
      invalidCode: "VISUAL_REFERENCE_PATH_INVALID",
      outsideCode: "VISUAL_REFERENCE_PATH_OUTSIDE_ROOT",
      extensionCode: "VISUAL_REFERENCE_EXTENSION_INVALID",
      missingCode: "VISUAL_REFERENCE_FILE_MISSING",
      extensions: IMAGE_EXTENSIONS
    });
  }
}

function validatePromptLock(review, errors) {
  if (review.mode === "reference" && !isRecord(review.prompt_lock)) {
    add(errors, "VISUAL_PROMPT_LOCK_REQUIRED", "reference 模式必須記錄先生圖 prompt_lock");
    return;
  }
  if (review.prompt_lock === undefined) return;
  if (!isRecord(review.prompt_lock)) {
    add(errors, "VISUAL_PROMPT_LOCK_INVALID", "prompt_lock 必須是物件");
    return;
  }
  checkKeys(review.prompt_lock, new Set(["id", "version", "status", "source"]), "prompt_lock", errors);
  checkString(review.prompt_lock.id, "prompt_lock.id", errors);
  checkString(review.prompt_lock.version, "prompt_lock.version", errors);
  checkString(review.prompt_lock.source, "prompt_lock.source", errors);
  if (review.prompt_lock.id !== MASTER_PROMPT_ID) add(errors, "VISUAL_PROMPT_ID_INVALID", `prompt_lock.id 必須是 ${MASTER_PROMPT_ID}`);
  if (!/^\d+\.\d+\.\d+$/u.test(String(review.prompt_lock.version ?? ""))) add(errors, "VISUAL_PROMPT_VERSION_INVALID", "prompt_lock.version 必須是三段式版本，例如 1.0.0");
  if (review.prompt_lock.status !== "locked") add(errors, "VISUAL_PROMPT_NOT_LOCKED", "prompt_lock.status 必須是 locked");
  if (review.prompt_lock.source !== MASTER_PROMPT_SOURCE) add(errors, "VISUAL_PROMPT_SOURCE_INVALID", `prompt_lock.source 必須是 ${MASTER_PROMPT_SOURCE}`);
}

function validateAssetMappings(review, root, errors, expectedAssetIds, expectedAssetFiles) {
  if (!Array.isArray(review.asset_mappings)) {
    add(errors, "VISUAL_MAPPING_REQUIRED", "asset_mappings 必須是陣列");
    return new Map();
  }
  if (review.mode === "reference" && review.asset_mappings.length === 0) {
    add(errors, "VISUAL_MAPPING_REQUIRED", "reference 模式至少要有一筆 asset_mappings");
  }
  const mappings = new Map();
  for (const [index, mapping] of review.asset_mappings.entries()) {
    const location = `asset_mappings[${index}]`;
    checkKeys(mapping, new Set(["asset_id", "asset_paths", "reference_path", "source_region", "derivation", "status"]), location, errors);
    checkString(mapping?.asset_id, `${location}.asset_id`, errors);
    if (mappings.has(mapping?.asset_id)) add(errors, "VISUAL_MAPPING_DUPLICATE", `asset_mappings 重複：${mapping?.asset_id}`);
    mappings.set(mapping?.asset_id, mapping);
    if (!Array.isArray(mapping?.asset_paths) || mapping.asset_paths.length === 0) {
      add(errors, "VISUAL_ASSET_PATHS_REQUIRED", `${location}.asset_paths 至少要有一個實際 SVG／PNG 路徑`);
    } else {
      const assetPaths = new Set();
      for (const [assetPathIndex, assetPath] of mapping.asset_paths.entries()) {
        checkExistingPath(root, assetPath, `${location}.asset_paths[${assetPathIndex}]`, errors, {
          invalidCode: "VISUAL_ASSET_PATH_INVALID",
          outsideCode: "VISUAL_ASSET_PATH_OUTSIDE_ROOT",
          extensionCode: "VISUAL_ASSET_EXTENSION_INVALID",
          missingCode: "VISUAL_ASSET_FILE_MISSING",
          extensions: MEDIA_EXTENSIONS
        });
        assetPaths.add(assetPath);
      }
      if (expectedAssetFiles?.has(mapping?.asset_id)) {
        const expectedPaths = expectedAssetFiles.get(mapping.asset_id);
        for (const expectedPath of expectedPaths) {
          if (!assetPaths.has(expectedPath)) add(errors, "VISUAL_ASSET_PATH_MISSING", `${location}.asset_paths 缺少 assets.json 路徑：${expectedPath}`);
        }
        for (const actualPath of assetPaths) {
          if (!expectedPaths.has(actualPath)) add(errors, "VISUAL_ASSET_PATH_UNKNOWN", `${location}.asset_paths 不是 assets.json 路徑：${actualPath}`);
        }
      }
    }
    checkExistingPath(root, mapping?.reference_path, `${location}.reference_path`, errors, {
      invalidCode: "VISUAL_MAPPING_PATH_INVALID",
      outsideCode: "VISUAL_MAPPING_PATH_OUTSIDE_ROOT",
      extensionCode: "VISUAL_MAPPING_EXTENSION_INVALID",
      missingCode: "VISUAL_MAPPING_FILE_MISSING",
      extensions: IMAGE_EXTENSIONS
    });
    checkString(mapping?.source_region, `${location}.source_region`, errors);
    checkString(mapping?.derivation, `${location}.derivation`, errors);
    if (!["draft", "reviewed", "approved"].includes(mapping?.status)) {
      add(errors, "VISUAL_MAPPING_STATUS_INVALID", `${location}.status 必須是 draft、reviewed 或 approved`);
    }
    if (expectedAssetIds && !expectedAssetIds.has(mapping?.asset_id)) {
      add(errors, "VISUAL_MAPPING_ASSET_UNKNOWN", `${location}.asset_id 不在 assets.json：${mapping?.asset_id}`);
    }
  }
  if (review.mode === "reference" && expectedAssetIds) {
    for (const assetId of expectedAssetIds) {
      if (!mappings.has(assetId)) add(errors, "VISUAL_MAPPING_ASSET_MISSING", `缺少資產來源映射：${assetId}`);
    }
  }
  return mappings;
}

function validateCriteria(review, root, errors) {
  if (!Array.isArray(review.criteria)) {
    add(errors, "VISUAL_CRITERIA_REQUIRED", "criteria 必須是陣列");
    return new Map();
  }
  const criteria = new Map();
  for (const [index, item] of review.criteria.entries()) {
    const location = `criteria[${index}]`;
    checkKeys(item, new Set(["id", "status", "evidence", "notes"]), location, errors);
    checkString(item?.id, `${location}.id`, errors);
    if (!CRITERIA_BY_ID.has(item?.id)) add(errors, "VISUAL_CRITERIA_UNKNOWN", `${location}.id 不在視覺檢查清單`);
    if (criteria.has(item?.id)) add(errors, "VISUAL_CRITERIA_DUPLICATE", `criteria 重複：${item?.id}`);
    criteria.set(item?.id, item);
    if (!GATE_STATUSES.has(item?.status)) add(errors, "VISUAL_CRITERIA_STATUS_INVALID", `${location}.status 必須是 pending、needs_revision 或 pass 所對應的 gate 狀態`);
    if (!Array.isArray(item?.evidence)) {
      add(errors, "VISUAL_CRITERIA_EVIDENCE_REQUIRED", `${location}.evidence 必須是陣列`);
    } else {
      for (const [evidenceIndex, evidence] of item.evidence.entries()) {
        checkExistingPath(root, evidence, `${location}.evidence[${evidenceIndex}]`, errors, {
          invalidCode: "VISUAL_EVIDENCE_PATH_INVALID",
          outsideCode: "VISUAL_EVIDENCE_PATH_OUTSIDE_ROOT",
          extensionCode: "VISUAL_EVIDENCE_EXTENSION_INVALID",
          missingCode: "VISUAL_EVIDENCE_FILE_MISSING",
          extensions: IMAGE_EXTENSIONS
        });
      }
    }
    if (item?.notes !== undefined) checkString(item.notes, `${location}.notes`, errors);
  }
  return criteria;
}

function validateApproval(value, location, errors) {
  if (!isRecord(value)) {
    add(errors, "VISUAL_USER_APPROVAL_REQUIRED", `${location} 必須是物件`);
    return;
  }
  checkKeys(value, new Set(["status", "message"]), location, errors);
  if (!APPROVAL_STATUSES.has(value.status)) add(errors, "VISUAL_APPROVAL_STATUS_INVALID", `${location}.status 必須是 pending 或 approved`);
  if (value.status === "approved") checkString(value.message, `${location}.message`, errors, "VISUAL_APPROVAL_MESSAGE_REQUIRED");
}

function validateGates(review, root, errors) {
  if (!isRecord(review.gates)) {
    add(errors, "VISUAL_GATES_REQUIRED", "gates 必須是物件");
    return;
  }
  checkKeys(review.gates, new Set(["C", "D", "E"]), "gates", errors);
  for (const gate of GATES) {
    const value = review.gates[gate];
    if (value === undefined) continue;
    const location = `gates.${gate}`;
    checkKeys(value, new Set(["status", "evidence", "notes", "user_approval"]), location, errors);
    if (!GATE_STATUSES.has(value?.status)) add(errors, "VISUAL_GATE_STATUS_INVALID", `${location}.status 必須是 pending、needs_revision 或 approved`);
    if (!Array.isArray(value?.evidence)) {
      add(errors, "VISUAL_GATE_EVIDENCE_REQUIRED", `${location}.evidence 必須是陣列`);
    } else {
      for (const [evidenceIndex, evidence] of value.evidence.entries()) {
        checkExistingPath(root, evidence, `${location}.evidence[${evidenceIndex}]`, errors, {
          invalidCode: "VISUAL_EVIDENCE_PATH_INVALID",
          outsideCode: "VISUAL_EVIDENCE_PATH_OUTSIDE_ROOT",
          extensionCode: "VISUAL_EVIDENCE_EXTENSION_INVALID",
          missingCode: "VISUAL_EVIDENCE_FILE_MISSING",
          extensions: IMAGE_EXTENSIONS
        });
      }
    }
    if (value?.notes !== undefined) checkString(value.notes, `${location}.notes`, errors);
    if (value?.user_approval !== undefined) validateApproval(value.user_approval, `${location}.user_approval`, errors);
  }
}

function validateFinalConfirmation(review, errors) {
  if (review.user_confirmation === undefined) return;
  validateApproval(review.user_confirmation, "user_confirmation", errors);
}

function validateRequiredGateState(review, criteria, errors, requestedGate) {
  for (const gate of gatesRequiredFor(requestedGate)) {
    const location = `gates.${gate}`;
    const value = review.gates?.[gate];
    if (!isRecord(value)) {
      add(errors, "VISUAL_GATE_MISSING", `${location} 尚未建立`);
      continue;
    }
    if (value.status !== "approved") add(errors, "VISUAL_GATE_NOT_APPROVED", `${location} 必須是 approved 才能通過 ${requestedGate} gate`);
    if (!Array.isArray(value.evidence) || value.evidence.length === 0) add(errors, "VISUAL_GATE_EVIDENCE_REQUIRED", `${location}.evidence 至少要有一張視覺證據`);
    if (!isRecord(value.user_approval) || value.user_approval.status !== "approved") {
      add(errors, "VISUAL_GATE_USER_APPROVAL_REQUIRED", `${location}.user_approval 必須記錄使用者 approved`);
    }
  }
  for (const criteriaId of criteriaRequiredFor(requestedGate)) {
    const value = criteria.get(criteriaId);
    if (!isRecord(value)) {
      add(errors, "VISUAL_CRITERIA_MISSING", `缺少視覺檢查項目：${criteriaId}`);
      continue;
    }
    if (value.status !== "approved") add(errors, "VISUAL_CRITERIA_NOT_APPROVED", `criteria.${criteriaId} 必須是 approved 才能通過 ${requestedGate} gate`);
    if (!Array.isArray(value.evidence) || value.evidence.length === 0) add(errors, "VISUAL_CRITERIA_EVIDENCE_REQUIRED", `criteria.${criteriaId}.evidence 不得為空`);
  }
  if (requestedGate === "E" || requestedGate === "all") {
    if (!isRecord(review.user_confirmation) || review.user_confirmation.status !== "approved") {
      add(errors, "VISUAL_USER_CONFIRMATION_REQUIRED", "E gate 必須有最終 user_confirmation approved");
    }
  }
}

function validateReviewDocument(review, root, { gate, expectedAssetIds = null, expectedAssetFiles = null } = {}) {
  const errors = [];
  checkKeys(review, new Set(["version", "mode", "prompt_lock", "reference", "asset_mappings", "criteria", "gates", "user_confirmation"]), "visual-review", errors);
  if (review?.version !== REVIEW_VERSION) add(errors, "VISUAL_REVIEW_VERSION_INVALID", `visual-review.version 必須是 ${REVIEW_VERSION}`);
  if (!MODES.has(review?.mode)) add(errors, "VISUAL_REVIEW_MODE_INVALID", "visual-review.mode 必須是 reference 或 art-direction");
  validatePromptLock(review, errors);
  validateReference(review, root, errors);
  const mappings = validateAssetMappings(review, root, errors, expectedAssetIds, expectedAssetFiles);
  const criteria = validateCriteria(review, root, errors);
  validateGates(review, root, errors);
  validateFinalConfirmation(review, errors);
  if (review.mode === "reference") {
    for (const [assetId, mapping] of mappings) {
      if (mapping?.status !== "approved") add(errors, "VISUAL_MAPPING_NOT_APPROVED", `asset_mappings.${assetId} 必須是 approved 才能通過 ${gate} gate`);
    }
  }
  validateRequiredGateState(review, criteria, errors, gate);
  return { errors, review };
}

export function validateVisualReview(root, {
  file = DEFAULT_FILE,
  required = false,
  gate = "all",
  expectedAssetIds = null,
  expectedAssetFiles = null
} = {}) {
  const reviewRoot = path.resolve(root);
  const errors = [];
  const warnings = [];
  let rootIsDirectory = false;
  try {
    rootIsDirectory = fs.statSync(reviewRoot).isDirectory();
  } catch {
    rootIsDirectory = false;
  }
  if (!rootIsDirectory) {
    return { ok: false, status: "invalid", errors: [{ code: "VISUAL_REVIEW_ROOT_MISSING", detail: reviewRoot }], warnings, root: reviewRoot, file: null, gate: null };
  }
  const requestedGate = normaliseGate(gate);
  if (!(requestedGate === "all" || GATES.has(requestedGate))) {
    return { ok: false, status: "invalid", errors: [{ code: "VISUAL_GATE_ARGUMENT_INVALID", detail: `gate 必須是 C、D、E 或 all：${gate}` }], warnings, root: reviewRoot, file: null, gate: requestedGate };
  }
  const reviewFile = safeRelativePath(reviewRoot, file, "visual-review file", {
    invalidCode: "VISUAL_REVIEW_FILE_PATH_INVALID",
    outsideCode: "VISUAL_REVIEW_FILE_PATH_OUTSIDE_ROOT",
    extensionCode: "VISUAL_REVIEW_FILE_EXTENSION_INVALID",
    extensions: new Set([".json"])
  });
  if (!reviewFile) return { ok: false, status: "invalid", errors, warnings, root: reviewRoot, file: null, gate: requestedGate };
  if (!isFile(reviewFile)) {
    if (required) add(errors, "VISUAL_REVIEW_FILE_MISSING", `${file} 不存在`);
    else return { ok: true, status: "not-requested", errors: [], warnings, root: reviewRoot, file: reviewFile, gate: requestedGate };
    return { ok: false, status: "invalid", errors, warnings, root: reviewRoot, file: reviewFile, gate: requestedGate };
  }
  let review;
  try {
    review = JSON.parse(fs.readFileSync(reviewFile, "utf8"));
  } catch (error) {
    add(errors, "VISUAL_REVIEW_JSON_INVALID", `visual-review.json 無法解析：${error.message}`);
    return { ok: false, status: "invalid", errors, warnings, root: reviewRoot, file: reviewFile, gate: requestedGate };
  }
  if (!isRecord(review)) add(errors, "VISUAL_REVIEW_OBJECT_REQUIRED", "visual-review.json 頂層必須是物件");
  const checked = isRecord(review)
    ? validateReviewDocument(review, reviewRoot, {
      gate: requestedGate,
      expectedAssetIds: expectedAssetIds ? new Set(expectedAssetIds) : null,
      expectedAssetFiles: expectedAssetFiles
        ? new Map(expectedAssetFiles.map(item => [item.id, new Set(item.paths)]))
        : null
    })
    : { errors: [], review };
  errors.push(...checked.errors);
  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? "approved" : "invalid",
    errors,
    warnings,
    root: reviewRoot,
    file: reviewFile,
    gate: requestedGate,
    review
  };
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const root = option(args, "--root") ? path.resolve(option(args, "--root")) : PACKAGE_ROOT;
  const result = validateVisualReview(root, {
    file: option(args, "--file") ?? DEFAULT_FILE,
    required: args.includes("--required"),
    gate: option(args, "--gate") ?? "all"
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
