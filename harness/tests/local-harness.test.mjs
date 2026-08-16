import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { findWorkspaceRoot, resolveWorkspacePath, toWorkspaceRelative } from "../core/root.mjs";
import { loadWorkspace } from "../core/config.mjs";
import { loadRegistry } from "../core/registry.mjs";
import { loadSkillRegistry } from "../core/skills.mjs";
import { loadPlatformRegistry } from "../core/routes.mjs";
import { buildPlan } from "../core/planner.mjs";
import { inspectBrain, readBrainDocument, searchBrain } from "../core/brain.mjs";
import { verifyBrainMigration } from "../core/brain-migration.mjs";

const ROOT = findWorkspaceRoot(import.meta.dirname);
const PORTABLE_PATH_PATTERN = new RegExp(String.raw`(?<![A-Za-z0-9])[A-Za-z]:[\\/]` + "|/" + "Users" + "/|/" + "home" + "/", "u");

test("workspace root is discovered without a drive-specific path", () => {
  assert.equal(toWorkspaceRelative(ROOT, ROOT), ".");
  assert.equal(toWorkspaceRelative(ROOT, resolveWorkspacePath(ROOT, "brain/index.json")), "brain/index.json");
  assert.throws(() => resolveWorkspacePath(ROOT, "../outside"), /TRAVERSAL|OUTSIDE_ROOT/);
});

test("portable config and registry load", () => {
  const workspace = loadWorkspace(ROOT);
  const registry = loadRegistry(workspace);
  const skills = loadSkillRegistry(workspace);
  const platforms = loadPlatformRegistry(workspace);
  assert.equal(workspace.config.mode, "local-only");
  assert.equal(registry.blocks.length, 11);
  assert.equal(skills.skills.length, 17);
  assert.equal(skills.policy.registration_required, true);
  assert.equal(skills.policy.traditional_chinese_display_name_required, true);
  assert.equal(platforms.platforms.length, 5);
  assert.equal(workspace.config.routing.primary_agent, "primary-agent");
  for (const value of Object.values(workspace.config.paths)) {
    assert.equal(path.isAbsolute(value), false, "portable config must not contain absolute paths");
  }
  for (const skill of skills.skills) {
    assert.equal(skill.path.startsWith("brain/skills/"), true);
    assert.match(skill.display_name_zh_tw, /[\u3400-\u9fff]/u);
    assert.equal(skill.computed_sha256.length, 64);
    for (const file of skill.package_files) {
      const content = fs.readFileSync(path.join(ROOT, skill.path, file), "utf8");
      assert.equal(PORTABLE_PATH_PATTERN.test(content), false, `${skill.id}/${file}`);
    }
  }
});

test("Skill dependency topology is complete, acyclic, and does not auto-load optional edges", () => {
  const registry = loadSkillRegistry(loadWorkspace(ROOT));
  const ids = new Set(registry.skills.map(skill => skill.id));
  const graph = new Map(registry.skills.map(skill => [skill.id, []]));
  for (const skill of registry.skills) {
    for (const rawDependency of skill.dependencies ?? []) {
      const dependency = typeof rawDependency === "string"
        ? { id: rawDependency, required: true, when: "always" }
        : rawDependency;
      assert.equal(ids.has(dependency.id), true, `${skill.id}->${dependency.id}`);
      assert.notEqual(dependency.when === "always" && dependency.required === false, true, `${skill.id}->${dependency.id}`);
      graph.get(skill.id).push(dependency.id);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    assert.equal(visiting.has(id), false, `dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id)) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
});

test("simple tool-bound Skill is selected without loading reasoning support", async () => {
  const plan = await buildPlan({
    goal: "讀取文件內容並準備 Markdown",
    profile: "simple",
    input_path: "workspace/sample.docx",
    route: {
      primary_skill: "document-to-markdown-ingestion",
      nodes: [{ id: "ingest", objective: "準備文件內容", platform: "rule-tool", capability: "execution" }]
    }
  }, ROOT);
  const selection = plan.artifacts.skill_resolution;
  assert.equal(plan.status, "planned");
  assert.deepEqual(selection.selected_skills.map(skill => skill.id), ["document-to-markdown-ingestion"]);
  assert.equal(selection.nodes[0].skill.selected, "document-to-markdown-ingestion");
  assert.equal(selection.nodes[0].skill.contract_loaded, true);
});

test("Traditional Chinese visible Skill name resolves to the stable internal id", async () => {
  const plan = await buildPlan({
    goal: "用中文名稱選擇教案 Skill",
    profile: "simple",
    route: {
      primary_skill: "教案撰寫",
      nodes: [{ id: "draft", objective: "整理教案草稿", platform: "primary-agent" }]
    }
  }, ROOT);
  assert.equal(plan.status, "planned");
  assert.equal(plan.artifacts.skill_resolution.primary_skill, "教案撰寫");
  assert.equal(plan.artifacts.skill_resolution.primary_skill_id, "lesson-plan-authoring");
  assert.equal(plan.artifacts.skill_resolution.nodes[0].skill.display_name_zh_tw, "教案撰寫");
  assert.equal(plan.artifacts.route_plan.nodes[0].skill, undefined);
});

test("migrated visual Skill resolves by its Traditional Chinese visible name", async () => {
  const plan = await buildPlan({
    goal: "規劃角色與場景美工",
    profile: "simple",
    route: {
      primary_skill: "美工與分鏡設計",
      nodes: [{ id: "art", objective: "整理角色與場景規格", platform: "primary-agent" }]
    }
  }, ROOT);
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.artifacts.skill_resolution.selected_skills.map(skill => skill.id), ["visual-art-storyboard"]);
  assert.equal(plan.artifacts.skill_resolution.nodes[0].skill.display_name_zh_tw, "美工與分鏡設計");
  assert.equal(plan.artifacts.route_plan.nodes[0].skill, undefined);
});

test("migrated Web workflow loads its required quest-game dependency without preloading all Skills", async () => {
  const plan = await buildPlan({
    goal: "規劃教育 Web 闖關遊戲",
    profile: "simple",
    user_directives: {
      skill_dependency_decisions: {
        "educational-web-game-workflow->web-layout-topology-analysis": "approve"
      }
    },
    route: {
      primary_skill: "教育 Web 教學遊戲工作流",
      nodes: [{ id: "web", objective: "建立教育 Web 遊戲規格", platform: "primary-agent" }]
    }
  }, ROOT);
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.artifacts.skill_resolution.selected_skills.map(skill => skill.id), [
    "educational-web-game-workflow",
    "material-to-quest-game",
    "web-layout-topology-analysis"
  ]);
});

test("Web production asks before loading the layout topology Skill", async () => {
  const task = {
    goal: "先分析教育 Web 頁面的區塊與元件關係",
    profile: "simple",
    route: {
      primary_skill: "教育 Web 教學遊戲工作流",
      nodes: [{ id: "layout", objective: "建立版面分析輸入", platform: "primary-agent" }]
    }
  };
  const pending = await buildPlan(task, ROOT);
  const question = pending.artifacts.skill_resolution.pending_user_decisions.find(entry => entry.key === "educational-web-game-workflow->web-layout-topology-analysis");
  assert.equal(pending.status, "awaiting_user");
  assert.ok(question);
  assert.equal(question.recommended_decision, "approve");
  assert.match(question.question, /版面區塊/);
  assert.match(question.suggestion, /建議教育遊戲/);
  assert.equal(pending.artifacts.route_plan.nodes[0].skill, undefined);

  const approved = await buildPlan({
    ...task,
    user_directives: {
      skill_dependency_decisions: {
        "educational-web-game-workflow->web-layout-topology-analysis": "approve"
      }
    }
  }, ROOT);
  assert.equal(approved.status, "planned");
  assert.equal(approved.artifacts.skill_resolution.selected_skills.some(skill => skill.id === "web-layout-topology-analysis"), true);
  assert.equal(approved.artifacts.route_plan.nodes[0].skill, undefined);
});

test("conditional Skill dependencies ask the user and provide a recommendation", async () => {
  const cases = [
    {
      primary_skill: "闖關遊戲 Three.js 導入",
      key: "quest-threejs-adoption->material-to-quest-game",
      question_pattern: /教材轉闖關遊戲/,
      suggestion_pattern: /已有 quest spec/
    }
  ];
  for (const item of cases) {
    const plan = await buildPlan({
      goal: `確認 ${item.primary_skill} 的 optional dependency`,
      profile: "simple",
      route: {
        primary_skill: item.primary_skill,
        nodes: [{ id: "skill-check", objective: "確認 Skill 依賴", platform: "primary-agent" }]
      }
    }, ROOT);
    const selection = plan.artifacts.skill_resolution;
    const question = selection.pending_user_decisions.find(entry => entry.key === item.key);
    assert.equal(plan.status, "awaiting_user");
    assert.equal(selection.status, "awaiting_user");
    assert.ok(question);
    assert.equal(question.recommended_decision, "skip");
    assert.match(question.question, item.question_pattern);
    assert.match(question.suggestion, item.suggestion_pattern);
    assert.equal(plan.artifacts.user_decision.skill_dependency_decision_required, true);
    assert.equal(plan.artifacts.route_plan.nodes[0].skill, undefined);
  }
});

test("Skill resolution cannot change Route Plan topology or verifier budget", async () => {
  const base = {
    goal: "比較相同路由在有無 Skill 時的拓樸",
    profile: "standard",
    user_directives: { decision: "approve" },
    route: {
      nodes: [{ id: "same-node", objective: "準備同一個節點", platform: "primary-agent" }]
    }
  };
  const withoutSkill = await buildPlan(base, ROOT);
  const withSkill = await buildPlan({
    ...base,
    route: { ...base.route, primary_skill: "lesson-plan-authoring" }
  }, ROOT);
  assert.deepEqual(withSkill.artifacts.route_plan, withoutSkill.artifacts.route_plan);
  assert.equal(Object.hasOwn(withSkill.artifacts.route_plan, "primary_skill"), false);
  assert.equal(Object.hasOwn(withSkill.artifacts.route_plan.nodes[0], "skill"), false);
  assert.deepEqual(withoutSkill.artifacts.skill_resolution.selected_skills, []);
  assert.equal(withSkill.artifacts.skill_resolution.selected_skills[0].id, "lesson-plan-authoring");
});

test("standard Primary Skill receives conditional reasoning support", async () => {
  const plan = await buildPlan({
    goal: "撰寫一份可覆核教案草稿",
    profile: "standard",
    user_directives: { decision: "approve" },
    route: {
      primary_skill: "lesson-plan-authoring",
      nodes: [{ id: "draft", objective: "建立目標活動評量對齊草稿", platform: "primary-agent", capability: "architecture" }]
    }
  }, ROOT);
  const selection = plan.artifacts.skill_resolution;
  assert.equal(plan.status, "planned");
  assert.deepEqual(selection.selected_skills.map(skill => skill.id), ["lesson-plan-authoring", "reasoning-kernel"]);
  assert.equal(selection.selected_skills.find(skill => skill.id === "reasoning-kernel").role, "supporting");
  assert.equal(selection.nodes[0].skill.selected, "lesson-plan-authoring");
  assert.equal(plan.artifacts.route_plan.nodes[0].skill, undefined);
});

test("Primary Skill dependencies activate only when their condition matches", async () => {
  const plan = await buildPlan({
    goal: "以文件內容作為教案來源",
    profile: "standard",
    input_path: "workspace/source.docx",
    route: {
      primary_skill: "lesson-plan-authoring",
      nodes: [{ id: "draft", objective: "讀取來源後建立教案草稿", platform: "primary-agent" }]
    }
  }, ROOT);
  assert.deepEqual(plan.artifacts.skill_resolution.selected_skills.map(skill => skill.id), [
    "lesson-plan-authoring",
    "document-to-markdown-ingestion",
    "reasoning-kernel"
  ]);
});

test("simple task can complete without reasoning or external runtime", async () => {
  const plan = await buildPlan({ goal: "整理標題", profile: "simple" }, ROOT);
  assert.equal(plan.status, "planned");
  assert.equal(plan.artifacts.execution.adapter, "rule-tool");
  assert.equal(plan.artifacts.verification.passed, true);
  assert.equal(plan.artifacts.route_plan.nodes.length, 1);
  assert.equal(plan.artifacts.route_plan.nodes[0].verification.mode, "none");
  assert.equal(plan.artifacts.platform_preflight.fallback_count, 0);
  assert.equal(plan.artifacts.verification.agent_verifier_queue.count, 0);
  assert.equal(plan.artifacts.context.paths.registry, "harness/config/registry.json");
  assert.equal(JSON.stringify(plan).includes("source-root"), false);
});

test("standard route schedules one final verifier instead of one per node", async () => {
  const plan = await buildPlan({
    goal: "執行已核准的本機結構檢查",
    profile: "standard",
    user_directives: { decision: "approve" },
    route: {
      nodes: [
        { id: "check-a", objective: "檢查 A", platform: "rule-tool", capability: "execution" },
        { id: "check-b", objective: "檢查 B", platform: "rule-tool", capability: "execution" }
      ]
    }
  }, ROOT);
  assert.equal(plan.status, "planned");
  assert.equal(plan.artifacts.verification.passed, true);
  assert.equal(plan.artifacts.verification.agent_verifier_queue.mode, "final");
  assert.equal(plan.artifacts.verification.agent_verifier_queue.count, 1);
  assert.deepEqual(plan.artifacts.verification.agent_verifier_queue.node_verifiers, []);
});

test("dispatch follows route dependencies even when input nodes are out of order", async () => {
  const plan = await buildPlan({
    goal: "依拓樸順序準備本機工作",
    profile: "standard",
    user_directives: { decision: "approve" },
    route: {
      nodes: [
        { id: "second", objective: "第二步", depends_on: ["first"], platform: "primary-agent" },
        { id: "first", objective: "第一步", platform: "primary-agent" }
      ]
    }
  }, ROOT);
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.artifacts.dispatch_plan.nodes.map(node => node.id), ["first", "second"]);
});

test("route cycles are rejected before user authority or execution", async () => {
  await assert.rejects(
    buildPlan({
      goal: "拒絕循環路徑",
      profile: "standard",
      route: {
        nodes: [
          { id: "a", objective: "A", depends_on: ["b"] },
          { id: "b", objective: "B", depends_on: ["a"] }
        ]
      }
    }, ROOT),
    /ROUTE_CYCLE_DETECTED/
  );
});

test("complex task pauses for user authority", async () => {
  const plan = await buildPlan({
    goal: "比較兩個架構",
    profile: "complex",
    ambiguity: true,
    route: {
      nodes: [
        { id: "inspect", objective: "盤點兩個架構", platform: "claude", capability: "architecture", fallback: "primary-agent" },
        { id: "compare", objective: "整理差異", platform: "codex", capability: "architecture", fallback: "primary-agent" }
      ]
    }
  }, ROOT);
  assert.equal(plan.status, "awaiting_user");
  assert.equal(plan.artifacts.user_decision.execution_allowed, false);
  assert.equal(plan.artifacts.execution, undefined);
  assert.equal(plan.artifacts.platform_preflight.fallback_count, 2);
  assert.equal(plan.artifacts.resolved_route.nodes[0].actual.platform, "primary-agent");
  assert.equal(plan.artifacts.resolved_route.nodes[0].preflight.status, "fallback");
  assert.equal(plan.artifacts.dispatch_plan, undefined);
  assert.equal(Array.isArray(plan.artifacts.model_instruction.return_fields), true);
});

test("user approval allows the selected path", async () => {
  const plan = await buildPlan({
    goal: "執行已核准的本機檢查",
    profile: "complex",
    user_directives: {
      decision: "approve",
      blocks: ["classify", "user-authority", "execute", "verify"]
    }
  }, ROOT);
  assert.equal(plan.status, "planned");
  assert.equal(plan.artifacts.user_decision.decision, "approve");
  assert.equal(plan.artifacts.dispatch_plan.nodes.length, 1);
  assert.equal(plan.artifacts.verification.passed, true);
});

test("user stop is final and prevents execution", async () => {
  const plan = await buildPlan({
    goal: "不要執行這個方案",
    profile: "standard",
    user_directives: { decision: "stop" }
  }, ROOT);
  assert.equal(plan.status, "stopped_by_user");
  assert.equal(plan.artifacts.execution, undefined);
});

test("user can remove optional blocks without changing the safety blocks", async () => {
  const plan = await buildPlan({
    goal: "用最短本機路徑完成檢查",
    profile: "standard",
    user_directives: { skip_blocks: ["context", "reason", "reconcile"], decision: "approve" }
  }, ROOT);
  assert.deepEqual(plan.requested_blocks, ["classify", "route-plan", "platform-preflight", "user-authority", "dispatch", "execute", "verify"]);
  assert.equal(plan.artifacts.verification.passed, true);
});

test("route plan keeps a bounded verifier budget and falls back from unavailable platforms", async () => {
  const plan = await buildPlan({
    goal: "建立有界的跨平台分析路徑",
    profile: "complex",
    route: {
      nodes: [
        { id: "inspect", objective: "盤點來源", platform: "claude", role: "architecture", capability: "architecture", fallback: "primary-agent" },
        { id: "synthesize", objective: "整合結果", platform: "primary-agent", role: "architecture", capability: "architecture" },
        { id: "implement", objective: "準備修改", platform: "codex", role: "executor", capability: "execution", fallback: "primary-agent" }
      ]
    }
  }, ROOT);
  assert.equal(plan.status, "awaiting_user");
  assert.equal(plan.artifacts.route_plan.verification_policy.scheduled_node_verifiers.length, 1);
  assert.equal(plan.artifacts.platform_preflight.fallback_count, 2);
  assert.equal(plan.artifacts.resolved_route.nodes[0].actual.platform, "primary-agent");
  assert.equal(plan.artifacts.resolved_route.nodes[2].actual.platform, "primary-agent");
});

test("portable Brain without migration manifest is not-applicable and locally searchable", () => {
  const workspace = loadWorkspace(ROOT);
  const inspection = inspectBrain(workspace);
  assert.equal(inspection.status, "ok");
  const collections = new Map(inspection.collections.map(collection => [collection.id, collection]));
  assert.deepEqual([...collections.keys()], ["skills", "knowledge", "templates"]);
  assert.equal(collections.get("knowledge").markdown_files, 9);
  assert.equal(collections.has("experience"), false);
  assert.equal(collections.has("error_log"), false);
  assert.equal(collections.has("note_library"), false);

  const verification = verifyBrainMigration(workspace);
  assert.equal(verification.status, "not-applicable");
  assert.deepEqual(verification.errors, []);
  assert.equal(verification.manifest, null);
  assert.equal(verification.reason, "migration-manifest-not-present");
  assert.equal(verification.inspection.status, "ok");

  const matches = searchBrain(workspace, "可攜 Brain 知識", { limit: 8 });
  assert.equal(matches.status, "ok");
  assert.equal(matches.results.some(result => result.collection === "knowledge"), true);

  const document = readBrainDocument(workspace, "brain/knowledge/harness-engineering-context-tools.md");
  assert.equal(document.path, "brain/knowledge/harness-engineering-context-tools.md");
  assert.equal(document.sha256.length, 64);
  assert.equal(fs.existsSync(path.join(ROOT, "brain/migration-manifest.json")), false);
});
test("context loads Brain candidates without changing Route Plan topology", async () => {
  const plan = await buildPlan({
    goal: "確認可攜 Brain 知識路徑",
    profile: "simple",
    route: { nodes: [{ id: "inspect", objective: "讀取治理經驗", platform: "primary-agent" }] }
  }, ROOT);
  assert.equal(plan.status, "planned");
  assert.equal(plan.artifacts.context.brain.loaded, true);
  assert.equal(plan.artifacts.context.brain.matches.some(result => result.collection === "knowledge"), true);
  assert.deepEqual(plan.artifacts.route_plan.nodes.map(node => node.id), ["inspect"]);
});

test("portable files do not contain the old fixed workspace paths", () => {
  const files = [
    "AGENTS.md",
    "README.md",
    "harness/config/local-harness.json",
    "harness/config/registry.json",
    "harness/config/platform-registry.json",
    "harness/config/route-profiles.json",
    "harness/config/skill-registry.json",
    "harness/core/root.mjs",
    "harness/core/brain.mjs",
    "harness/core/brain-migration.mjs",
    "harness/core/routes.mjs",
    "harness/docs/architecture.md",
    "brain/index.json",
    "brain/SKILL.md"
  ];
  for (const relative of files) {
    const content = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.equal(PORTABLE_PATH_PATTERN.test(content), false, relative);
  }
  const workspace = loadWorkspace(ROOT);
  const skills = loadSkillRegistry(workspace);
  for (const skill of skills.skills) {
    for (const relative of skill.package_files) {
      const content = fs.readFileSync(path.join(ROOT, skill.path, relative), "utf8");
      assert.equal(PORTABLE_PATH_PATTERN.test(content), false, `${skill.id}/${relative}`);
    }
  }
});

