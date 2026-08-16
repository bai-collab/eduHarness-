import { findWorkspaceRoot } from "../core/root.mjs";
import { loadWorkspace } from "../core/config.mjs";
import { inspectBrain, readBrainDocument, searchBrain } from "../core/brain.mjs";
import { applyBrainMigration, planBrainMigration, verifyBrainMigration } from "../core/brain-migration.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  console.log(`Usage:\n  node harness/cli/brain.mjs inspect [--root <path>]\n  node harness/cli/brain.mjs verify [--details] [--root <path>]\n  node harness/cli/brain.mjs search <query> [--limit <n>] [--root <path>]\n  node harness/cli/brain.mjs read <workspace-relative-path> [--max-chars <n>] [--root <path>]\n  node harness/cli/brain.mjs migrate --source <old-workspace> [--include-note-mirror] [--apply] [--root <path>]`);
}

const [command, ...args] = process.argv.slice(2);
try {
  const explicitRoot = option(args, "--root");
  const root = explicitRoot ? findWorkspaceRoot(explicitRoot) : findWorkspaceRoot(process.cwd());
  const workspace = loadWorkspace(root);
  if (command === "inspect") {
    console.log(JSON.stringify(inspectBrain(workspace), null, 2));
  } else if (command === "verify") {
    const result = verifyBrainMigration(workspace);
    const output = args.includes("--details")
      ? result
      : {
          status: result.status,
          errors: result.errors,
          manifest: result.manifest,
          checked_files: result.checks?.length ?? 0,
          collections: result.inspection?.collections ?? []
        };
    console.log(JSON.stringify(output, null, 2));
    if (result.status !== "ok") process.exitCode = 1;
  } else if (command === "search") {
    const query = args.filter((value, index) => !value.startsWith("--") && args[index - 1] !== "--root" && args[index - 1] !== "--limit").join(" ");
    const result = searchBrain(workspace, query, { limit: Number(option(args, "--limit") ?? 8) });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "read") {
    const relativePath = args.find((value, index) => !value.startsWith("--") && args[index - 1] !== "--root" && args[index - 1] !== "--max-chars");
    if (!relativePath) throw new Error("BRAIN_DOCUMENT_REQUIRED");
    console.log(JSON.stringify(readBrainDocument(workspace, relativePath, { maxChars: Number(option(args, "--max-chars") ?? 20000) }), null, 2));
  } else if (command === "migrate") {
    const sourceRoot = option(args, "--source");
    if (!sourceRoot) throw new Error("BRAIN_MIGRATION_SOURCE_REQUIRED");
    const includeNoteMirror = args.includes("--include-note-mirror");
    const options = { sourceRoot, workspaceRoot: workspace.root, includeNoteMirror };
    if (!args.includes("--apply")) {
      console.log(JSON.stringify(planBrainMigration(options), null, 2));
    } else {
      const result = applyBrainMigration(options);
      console.log(JSON.stringify({
        status: "ok",
        manifest: result.manifest_file,
        counts: result.manifest.counts,
        include_note_mirror: result.manifest.include_note_mirror
      }, null, 2));
    }
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
