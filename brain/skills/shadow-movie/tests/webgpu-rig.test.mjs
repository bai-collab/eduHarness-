import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { validateRigDocument } from "../scripts/validate.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = fs.readFileSync(path.join(PACKAGE_ROOT, "runtime", "webgpu-rig.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(runtime, context, { filename: "webgpu-rig.js" });
const api = context.window.ShadowMovieWebGpuRig;

const sampleRig = {
  version: "0.1.0",
  bones: [
    { id: "torso", parent: null, local_position: { x: 0, y: 0 }, position_control: { x: "walkX" } },
    { id: "thigh", parent: "torso", local_position: { x: 85, y: 125 }, local_rotation: 2, control: "thighAngle" },
    { id: "shin", parent: "thigh", local_position: { x: 56, y: 131 }, control: "shinAngle" }
  ],
  attachments: [
    {
      id: "thigh-part",
      kind: "part",
      bone: "thigh",
      asset: "part-thigh",
      local_position: { x: -96, y: -75 },
      joint_anchor: {
        role: "hip",
        source_size: { width: 1254, height: 1254 },
        source_px: { x: 490, y: 360 }
      }
    }
  ],
  objects: [
    { id: "postal-bag", kind: "prop", bone: "torso", asset: "prop-bag", local_position: { x: -80, y: 70 }, local_scale: { x: 1, y: 1 } }
  ]
};

test("rig validator accepts bone hierarchy and object attachments", () => {
  const result = validateRigDocument(sampleRig);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
});

test("rig validator rejects mirrored attachment without a joint anchor", () => {
  const broken = structuredClone(sampleRig);
  broken.attachments[0].mirror = true;
  delete broken.attachments[0].joint_anchor;
  const result = validateRigDocument(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === "MIRROR_JOINT_ANCHOR_REQUIRED"));
});

test("WebGPU layout compiles parent links into indices and depth batches", async () => {
  const layout = api.buildLayout(sampleRig);
  assert.deepEqual(layout.bones.map((bone) => bone.parentIndex), [-1, 0, 1]);
  assert.deepEqual(layout.bones.map((bone) => bone.depth), [0, 1, 2]);
  assert.equal(layout.bones[0].positionControlX, "walkX");
  assert.equal(layout.bones[1].localRotation, 2);
  assert.equal(layout.attachments[0].boneIndex, 1);
  assert.equal(layout.attachments[1].boneIndex, 0);
  assert.equal(layout.attachments[1].kind, "prop");
  assert.match(api.WGSL, /fn bone_main/);
  assert.match(api.WGSL, /fn object_main/);
  assert.match(api.WGSL, /fn scaleOnly/);
  assert.match(api.WGSL, /targetDepth/);
  const fallback = await api.create({ layout });
  assert.equal(fallback.supported, false);
  assert.equal(fallback.reason, "WEBGPU_UNAVAILABLE");
});

test("WebGPU layout rejects cycles and unknown attachment bones", () => {
  const cyclic = structuredClone(sampleRig);
  cyclic.bones[0].parent = "shin";
  assert.throws(() => api.buildLayout(cyclic), /WEBGPU_RIG_CYCLE/);

  const broken = structuredClone(sampleRig);
  broken.objects[0].bone = "missing-bone";
  assert.throws(() => api.buildLayout(broken), /WEBGPU_RIG_ATTACHMENT_BONE_UNKNOWN/);
});
