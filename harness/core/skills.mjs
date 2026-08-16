import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveWorkspacePath, toWorkspaceRelative } from "./root.mjs";

const DEPENDENCY_CONDITIONS = new Set([
  "always",
  "content-input",
  "reasoning-needed",
  "verifier-required",
  "high-risk",
  "user-confirmed"
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalise(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/") : value;
}

function assertPortableRelative(value, label) {
  const normalized = normalise(value);
  if (typeof normalized !== "string" || normalized.trim() === "") throw new Error(`SKILL_PATH_REQUIRED ${label}`);
  if (path.isAbsolute(normalized) || /^[A-Za-z]:[\\/]/u.test(normalized)) throw new Error(`SKILL_ABSOLUTE_PATH_FORBIDDEN ${label}=${value}`);
  if (normalized.split("/").some(segment => segment === "..")) throw new Error(`SKILL_PATH_TRAVERSAL ${label}=${value}`);
  return normalized;
}

function listFiles(root) {
  const result = [];
  function visit(current, relative) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`SKILL_SYMLINK_FORBIDDEN ${childRelative}`);
      if (entry.isDirectory()) visit(child, childRelative);
      else if (entry.isFile()) result.push(childRelative.replaceAll("\\", "/"));
    }
  }
  visit(root, "");
  return result.sort();
}

function listSkillDirectories(root) {
  const result = [];
  function visit(current) {
    if (fs.existsSync(path.join(current, "SKILL.md"))) result.push(current);
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      visit(path.join(current, entry.name));
    }
  }
  visit(root);
  return result;
}

function readAgentDisplayName(file, id) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`SKILL_AGENT_METADATA_MISSING ${id}`);
  const content = fs.readFileSync(file, "utf8");
  const match = content.match(/^\s*display_name:\s*(?:"([^"]+)"|'([^']+)'|([^\r\n#]+))/mu);
  const value = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  if (!value) throw new Error(`SKILL_AGENT_DISPLAY_NAME_REQUIRED ${id}`);
  return value;
}

function treeHash(root) {
  const hash = crypto.createHash("sha256");
  for (const relative of listFiles(root)) {
    const content = fs.readFileSync(path.join(root, relative));
    hash.update(`path=${relative}\nsize=${content.length}\n`);
    hash.update(content);
    hash.update("\n");
  }
  return hash.digest("hex").toUpperCase();
}

function isInside(root, candidate) {
  const parent = path.resolve(root);
  const target = path.resolve(candidate);
  const prefix = `${parent}${path.sep}`;
  return target === parent || target.startsWith(prefix);
}

function skillEntry(registry, id) {
  return registry.skills.find(skill =>
    skill.id === id ||
    skill.display_name_zh_tw === id ||
    (Array.isArray(skill.aliases_zh_tw) && skill.aliases_zh_tw.includes(id)) ||
    (Array.isArray(skill.aliases) && skill.aliases.includes(id))
  ) ?? null;
}

function normaliseDependency(dependency) {
  if (typeof dependency === "string") return { id: dependency, required: true, when: "always", question: null, suggestion: null };
  if (!dependency || typeof dependency !== "object") return null;
  return {
    id: dependency.id,
    required: dependency.required !== false,
    when: dependency.when ?? "always",
    question: dependency.question ?? null,
    suggestion: dependency.suggestion ?? null,
    recommended_decision: dependency.recommended_decision ?? null
  };
}

function inputHasContent(task, route) {
  return Boolean(
    task.content_input === true ||
    task.input_path ||
    task.input?.path ||
    task.source_file ||
    (Array.isArray(task.source_files) && task.source_files.length) ||
    route.input_kind === "content"
  );
}

function conditionMatches(condition, context, route, nodes) {
  if (!condition || condition === "always") return true;
  if (condition === "content-input") return inputHasContent(context.task, route);
  if (condition === "reasoning-needed") return context.profile !== "simple" || context.task.reasoning_needed === true;
  if (condition === "verifier-required") return nodes.some(node => node.verification?.mode && node.verification.mode !== "none");
  if (condition === "high-risk") return ["high", "critical"].includes(String(context.task.risk ?? "").toLowerCase());
  return false;
}

function dependencyDecision(context, parentId, dependencyId) {
  const decisions = context.task.user_directives?.skill_dependency_decisions ?? context.task.skill_dependency_decisions ?? {};
  const key = `${parentId}->${dependencyId}`;
  const raw = decisions && typeof decisions === "object" ? (decisions[key] ?? decisions[dependencyId] ?? null) : null;
  const value = raw && typeof raw === "object" ? raw.decision : raw;
  if (value === true) return "approve";
  if (value === false) return "skip";
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["approve", "approved", "allow", "load", "include", "yes", "載入", "同意"].includes(normalized)) return "approve";
  if (["skip", "skipped", "deny", "reject", "no", "略過", "跳過", "不同意"].includes(normalized)) return "skip";
  return null;
}

function dependencyQuestion(registry, parentId, dependency) {
  const parent = skillEntry(registry, parentId);
  const child = skillEntry(registry, dependency.id);
  const parentName = parent?.display_name_zh_tw ?? parentId;
  const childName = child?.display_name_zh_tw ?? dependency.id;
  return {
    key: `${parentId}->${dependency.id}`,
    type: "skill-dependency-confirmation",
    parent_skill_id: parentId,
    parent_display_name_zh_tw: parentName,
    dependency_skill_id: child?.id ?? dependency.id,
    dependency_display_name_zh_tw: childName,
    question: dependency.question ?? `是否在「${parentName}」中載入「${childName}」？`,
    suggestion: dependency.suggestion ?? "建議只有在目前工作確實需要這個分支時才載入。",
    recommended_decision: dependency.recommended_decision === "approve" ? "approve" : "skip",
    options: [
      { value: "approve", label: "載入此 Skill", effect: `載入「${childName}」並保留為 supporting dependency。` },
      { value: "skip", label: "先略過", effect: `只使用「${parentName}」，不增加這條 optional dependency。` }
    ]
  };
}

function packageSummary(workspace, entry, packageRoot, contract) {
  const relativePackage = toWorkspaceRelative(workspace.root, packageRoot);
  return {
    id: entry.id,
    kind: entry.kind,
    version: entry.version ?? null,
    path: relativePackage,
    instruction_path: `${relativePackage}/SKILL.md`,
    package_files: listFiles(packageRoot),
    canonical_sha256: treeHash(packageRoot),
    contract_bytes: Buffer.byteLength(contract, "utf8"),
    contract_loaded: true,
    source: entry.source ?? null
  };
}

export function loadSkillRegistry(workspace) {
  const file = workspace.files?.skill_registry;
  if (!file) throw new Error("CONFIG_FILE_MISSING skill_registry");
  const registry = readJson(file);
  if (registry.schema_version !== 1 || registry.kind !== "local-skill-registry") throw new Error("SKILL_REGISTRY_SCHEMA_INVALID");
  if (!Array.isArray(registry.skills) || registry.skills.length === 0) throw new Error("SKILL_REGISTRY_EMPTY");
  const canonicalRootRelative = toWorkspaceRelative(workspace.root, workspace.paths.skills);
  if (normalise(registry.canonical_root) !== canonicalRootRelative) throw new Error(`SKILL_CANONICAL_ROOT_MISMATCH ${registry.canonical_root}`);

  const ids = new Set();
  const skills = registry.skills.map(entry => {
    if (!entry.id || ids.has(entry.id)) throw new Error(`SKILL_ID_INVALID ${entry.id ?? "<missing>"}`);
    if (typeof entry.display_name_zh_tw !== "string" || !entry.display_name_zh_tw.trim()) throw new Error(`SKILL_DISPLAY_NAME_REQUIRED ${entry.id}`);
    if (!/[\u3400-\u9fff]/u.test(entry.display_name_zh_tw)) throw new Error(`SKILL_DISPLAY_NAME_NOT_TRADITIONAL_CHINESE ${entry.id}`);
    ids.add(entry.id);
    const relativePath = assertPortableRelative(entry.path, `${entry.id}.path`);
    const packageRoot = resolveWorkspacePath(workspace.root, relativePath);
    if (!isInside(workspace.paths.skills, packageRoot)) throw new Error(`SKILL_OUTSIDE_CANONICAL_ROOT ${entry.id}`);
    if (!fs.existsSync(packageRoot) || !fs.statSync(packageRoot).isDirectory()) throw new Error(`SKILL_PACKAGE_MISSING ${entry.id}`);
    const requiredFiles = Array.isArray(entry.required_files) && entry.required_files.length ? entry.required_files : ["SKILL.md"];
    for (const required of requiredFiles) {
      const relativeRequired = assertPortableRelative(required, `${entry.id}.required_files`);
      const requiredFile = path.join(packageRoot, relativeRequired);
      if (!isInside(packageRoot, requiredFile) || !fs.existsSync(requiredFile) || !fs.statSync(requiredFile).isFile()) {
        throw new Error(`SKILL_REQUIRED_FILE_MISSING ${entry.id}/${relativeRequired}`);
      }
    }
    for (const projection of Object.values(entry.projections ?? {})) {
      if (projection?.path) assertPortableRelative(projection.path, `${entry.id}.projection`);
    }
    for (const rawDependency of entry.dependencies ?? []) {
      const dependency = normaliseDependency(rawDependency);
      if (!dependency?.id) throw new Error(`SKILL_DEPENDENCY_INVALID ${entry.id}`);
      if (!DEPENDENCY_CONDITIONS.has(dependency.when)) throw new Error(`SKILL_DEPENDENCY_CONDITION_UNSUPPORTED ${entry.id}:${dependency.when}`);
      if (dependency.when === "user-confirmed") {
        if (typeof dependency.question !== "string" || !dependency.question.trim()) throw new Error(`SKILL_DEPENDENCY_QUESTION_REQUIRED ${entry.id}->${dependency.id}`);
        if (typeof dependency.suggestion !== "string" || !dependency.suggestion.trim()) throw new Error(`SKILL_DEPENDENCY_SUGGESTION_REQUIRED ${entry.id}->${dependency.id}`);
        if (dependency.recommended_decision !== null && !["approve", "skip"].includes(dependency.recommended_decision)) throw new Error(`SKILL_DEPENDENCY_RECOMMENDATION_INVALID ${entry.id}->${dependency.id}`);
      }
    }
    if (registry.policy?.agents_display_name_required !== false) {
      const agentDisplayName = readAgentDisplayName(path.join(packageRoot, "agents", "openai.yaml"), entry.id);
      if (agentDisplayName !== entry.display_name_zh_tw) throw new Error(`SKILL_DISPLAY_NAME_MISMATCH ${entry.id}`);
    }
    const computed = treeHash(packageRoot);
    if (entry.canonical_sha256 && entry.canonical_sha256 !== computed) throw new Error(`SKILL_HASH_MISMATCH ${entry.id}`);
    return { ...entry, path: relativePath, computed_sha256: computed, package_files: listFiles(packageRoot) };
  });
  if (registry.policy?.registration_required !== false) {
    const registeredPaths = new Set(skills.map(skill => skill.path));
    for (const packageRoot of listSkillDirectories(workspace.paths.skills)) {
      const relative = toWorkspaceRelative(workspace.root, packageRoot);
      if (!registeredPaths.has(relative)) throw new Error(`SKILL_PACKAGE_UNREGISTERED ${relative}`);
    }
  }
  return {
    ...registry,
    canonical_root: canonicalRootRelative,
    source: toWorkspaceRelative(workspace.root, file),
    skills
  };
}

export function loadSkillPackage(workspace, registry, id) {
  const entry = skillEntry(registry, id);
  if (!entry) throw new Error(`SKILL_NOT_REGISTERED ${id}`);
  const packageRoot = resolveWorkspacePath(workspace.root, entry.path);
  const contractFile = path.join(packageRoot, "SKILL.md");
  const contract = fs.readFileSync(contractFile, "utf8");
  if (!contract.trim()) throw new Error(`SKILL_CONTRACT_EMPTY ${id}`);
  return {
    ...packageSummary(workspace, entry, packageRoot, contract),
    display_name_zh_tw: entry.display_name_zh_tw,
    aliases_zh_tw: entry.aliases_zh_tw ?? [],
    triggers: entry.triggers ?? [],
    dependencies: entry.dependencies ?? []
  };
}

export function resolveSkillPlan(context, route, nodes, nodeSkillRequests = []) {
  const registry = context.skillRegistry ?? loadSkillRegistry(context.workspace);
  const requestedPrimary = route.primary_skill ?? route.skill ?? context.task.user_directives?.primary_skill ?? context.task.primary_skill ?? null;
  const explicitSupporting = [
    ...(Array.isArray(route.supporting_skills) ? route.supporting_skills : []),
    ...(Array.isArray(context.task.user_directives?.supporting_skills) ? context.task.user_directives.supporting_skills : [])
  ];
  const selected = new Map();
  const unresolved = [];
  const warnings = [];
  const pendingUserDecisions = [];
  const skippedDependencies = [];
  const pendingDecisionKeys = new Set();
  const visiting = new Set();

  function add(requestedId, role, reason, required = true, parent = null) {
    if (!requestedId) return;
    const entry = skillEntry(registry, requestedId);
    const id = entry?.id ?? requestedId;
    if (selected.has(id)) return;
    if (visiting.has(id)) {
      unresolved.push({ id, requested: requestedId, required: true, reason: "dependency-cycle", parent });
      return;
    }
    if (!entry) {
      unresolved.push({ id, requested: requestedId, required, reason: "not-registered", parent });
      return;
    }
    visiting.add(id);
    let loaded;
    try {
      loaded = loadSkillPackage(context.workspace, registry, id);
    } catch (error) {
      visiting.delete(id);
      unresolved.push({ id, requested: requestedId, required, reason: error.message, parent });
      return;
    }
    selected.set(id, { ...loaded, role, reason, required, parent });
    for (const rawDependency of entry.dependencies ?? []) {
      const dependency = normaliseDependency(rawDependency);
      if (!dependency?.id) continue;
      const decision = dependencyDecision(context, id, dependency.id);
      if (dependency.when === "user-confirmed") {
        if (decision === "approve") {
          add(dependency.id, "supporting", `dependency:${id}`, dependency.required, id);
        } else if (decision === "skip") {
          if (dependency.required) {
            unresolved.push({ id: dependency.id, requested: dependency.id, required: true, reason: "required-dependency-rejected", parent: id });
          } else {
            skippedDependencies.push({ parent: id, dependency: dependency.id, reason: "user-skipped" });
          }
        } else {
          const question = dependencyQuestion(registry, id, dependency);
          if (!pendingDecisionKeys.has(question.key)) {
            pendingDecisionKeys.add(question.key);
            pendingUserDecisions.push(question);
          }
        }
        continue;
      }
      if (!conditionMatches(dependency.when, context, route, nodes)) continue;
      add(dependency.id, "supporting", `dependency:${id}`, dependency.required, id);
    }
    visiting.delete(id);
  }

  const requestedNodeSkills = [...new Set(nodeSkillRequests.filter(Boolean))];
  if (requestedPrimary) add(requestedPrimary, "primary", "requested-primary", true);
  for (const id of explicitSupporting) add(id, "supporting", "requested-supporting", false);
  for (const id of requestedNodeSkills) {
    if (id !== requestedPrimary) add(id, requestedPrimary ? "supporting" : "primary", "requested-node", true);
  }
  const reasoningRequested = Boolean((requestedPrimary || requestedNodeSkills.length) && (context.profile !== "simple" || context.task.reasoning_needed === true));
  if (reasoningRequested && requestedPrimary !== "reasoning-kernel") add("reasoning-kernel", "supporting", "conditional-reasoning", false);

  const nodeSkillById = new Map(nodes.map((node, index) => [node.id, nodeSkillRequests[index] ?? null]));
  const nodeResults = nodes.map(node => {
    const requested = nodeSkillById.get(node.id) ?? requestedPrimary ?? null;
    if (!requested) return { ...node, skill: { status: "not_requested", requested: null, selected: null } };
    const canonicalId = skillEntry(registry, requested)?.id ?? requested;
    const loaded = selected.get(canonicalId);
    if (loaded) {
      return {
        ...node,
        skill: {
          status: "ready",
          requested,
          selected: loaded.id,
          display_name_zh_tw: loaded.display_name_zh_tw,
          role: loaded.role,
          path: loaded.path,
          canonical_sha256: loaded.canonical_sha256,
          contract_loaded: loaded.contract_loaded
        }
      };
    }
    const gap = unresolved.find(item => item.id === canonicalId || item.requested === requested);
    return {
      ...node,
      skill: {
        status: "deferred",
        requested,
        selected: null,
        reason: gap?.reason ?? "skill-not-loaded"
      }
    };
  });

  const requiredUnresolved = unresolved.filter(item => item.required);
  if (unresolved.some(item => !item.required)) warnings.push(...unresolved.filter(item => !item.required).map(item => `OPTIONAL_SKILL_DEFERRED ${item.id}`));
  if (requiredUnresolved.length) warnings.push(...requiredUnresolved.map(item => `REQUIRED_SKILL_DEFERRED ${item.id}`));
  if (pendingUserDecisions.length) warnings.push(...pendingUserDecisions.map(item => `USER_CONFIRMATION_REQUIRED ${item.key}`));
  const status = requiredUnresolved.length ? "deferred" : pendingUserDecisions.length ? "awaiting_user" : "ok";
  return {
    status,
    policy: registry.policy ?? {},
    primary_skill: requestedPrimary,
    primary_skill_id: skillEntry(registry, requestedPrimary)?.id ?? null,
    selected_skills: [...selected.values()].map(skill => ({
      id: skill.id,
      display_name_zh_tw: skill.display_name_zh_tw,
      kind: skill.kind,
      role: skill.role,
      reason: skill.reason,
      path: skill.path,
      canonical_sha256: skill.canonical_sha256,
      contract_loaded: skill.contract_loaded,
      package_files: skill.package_files
    })),
    unresolved,
    required_unresolved: requiredUnresolved,
    pending_user_decisions: pendingUserDecisions,
    skipped_dependencies: skippedDependencies,
    warnings,
    nodes: nodeResults,
    preload_all: false
  };
}
