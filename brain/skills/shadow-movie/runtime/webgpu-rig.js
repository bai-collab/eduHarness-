(function attachShadowMovieWebGpuRig(global) {
  "use strict";

  var WORKGROUP_SIZE = 64;
  var PARAM_BYTES = 16;
  var PARAM_STRIDE = 256;

  // The two compute entry points share buffers so a single bind group can be
  // reused. Bone passes are dispatched in depth order; the object pass comes
  // after all bone passes and therefore reads completed parent world matrices.
  var WEBGPU_RIG_WGSL = `
struct Params {
  boneCount: u32,
  targetDepth: u32,
  objectCount: u32,
  _padding: u32,
};

struct Affine {
  a: f32,
  b: f32,
  c: f32,
  d: f32,
  e: f32,
  f: f32,
};

@group(0) @binding(0) var<storage, read> boneInput: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> boneWorld: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> objectInput: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> objectWorld: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: Params;

fn fromTRS(x: f32, y: f32, angle: f32, scaleX: f32, scaleY: f32) -> Affine {
  let radians = angle * 0.017453292519943295;
  let cosValue = cos(radians);
  let sinValue = sin(radians);
  return Affine(
    cosValue * scaleX,
    sinValue * scaleX,
    -sinValue * scaleY,
    cosValue * scaleY,
    x,
    y
  );
}

fn fromRows(row0: vec4<f32>, row1: vec4<f32>) -> Affine {
  return Affine(row0.x, row1.x, row0.y, row1.y, row0.z, row1.z);
}

fn toRow0(matrix: Affine) -> vec4<f32> {
  return vec4<f32>(matrix.a, matrix.c, matrix.e, 0.0);
}

fn toRow1(matrix: Affine) -> vec4<f32> {
  return vec4<f32>(matrix.b, matrix.d, matrix.f, 0.0);
}

fn multiply(parent: Affine, local: Affine) -> Affine {
  return Affine(
    parent.a * local.a + parent.c * local.b,
    parent.b * local.a + parent.d * local.b,
    parent.a * local.c + parent.c * local.d,
    parent.b * local.c + parent.d * local.d,
    parent.a * local.e + parent.c * local.f + parent.e,
    parent.b * local.e + parent.d * local.f + parent.f
  );
}

fn translationOnly(matrix: Affine) -> Affine {
  return Affine(1.0, 0.0, 0.0, 1.0, matrix.e, matrix.f);
}

fn scaleOnly(matrix: Affine) -> Affine {
  let xLength = max(sqrt(matrix.a * matrix.a + matrix.b * matrix.b), 0.000001);
  let yLength = max(sqrt(matrix.c * matrix.c + matrix.d * matrix.d), 0.000001);
  return Affine(xLength, 0.0, 0.0, yLength, matrix.e, matrix.f);
}

fn removeScale(matrix: Affine) -> Affine {
  let xLength = max(sqrt(matrix.a * matrix.a + matrix.b * matrix.b), 0.000001);
  let yLength = max(sqrt(matrix.c * matrix.c + matrix.d * matrix.d), 0.000001);
  return Affine(
    matrix.a / xLength,
    matrix.b / xLength,
    matrix.c / yLength,
    matrix.d / yLength,
    matrix.e,
    matrix.f
  );
}

fn objectBase(bone: Affine, inheritRotation: f32, inheritScale: f32) -> Affine {
  if (inheritRotation < 0.5) {
    if (inheritScale < 0.5) {
      return translationOnly(bone);
    }
    return scaleOnly(bone);
  }
  if (inheritScale < 0.5) {
    return removeScale(bone);
  }
  return bone;
}

@compute @workgroup_size(64)
fn bone_main(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= params.boneCount) {
    return;
  }
  let input = boneInput[index * 2u];
  let metadata = boneInput[index * 2u + 1u];
  if (u32(metadata.x + 0.5) != params.targetDepth) {
    return;
  }

  let local = fromTRS(input.x, input.y, input.z, metadata.y, metadata.z);
  var world = local;
  if (input.w >= 0.0) {
    let parentIndex = u32(input.w + 0.5);
    let parent = fromRows(boneWorld[parentIndex * 2u], boneWorld[parentIndex * 2u + 1u]);
    world = multiply(parent, local);
  }
  boneWorld[index * 2u] = toRow0(world);
  boneWorld[index * 2u + 1u] = toRow1(world);
}

@compute @workgroup_size(64)
fn object_main(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= params.objectCount) {
    return;
  }
  let input = objectInput[index * 2u];
  let flags = objectInput[index * 2u + 1u];
  let boneIndex = u32(input.x + 0.5);
  let bone = fromRows(boneWorld[boneIndex * 2u], boneWorld[boneIndex * 2u + 1u]);
  let base = objectBase(bone, flags.z, flags.w);
  let local = fromTRS(input.y, input.z, input.w, flags.x, flags.y);
  let world = multiply(base, local);
  objectWorld[index * 2u] = toRow0(world);
  objectWorld[index * 2u + 1u] = toRow1(world);
}
`;

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function finite(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function localPosition(value) {
    return {
      x: finite(value && value.x, 0),
      y: finite(value && value.y, 0)
    };
  }

  function localScale(value) {
    return {
      x: finite(value && value.x, 1),
      y: finite(value && value.y, 1)
    };
  }

  function buildRigLayout(rig) {
    if (!isRecord(rig) || !Array.isArray(rig.bones) || rig.bones.length === 0) {
      throw new Error("WEBGPU_RIG_BONES_REQUIRED");
    }
    var boneIndex = new Map();
    rig.bones.forEach(function (bone, index) {
      if (!isRecord(bone) || typeof bone.id !== "string" || !bone.id.trim()) {
        throw new Error("WEBGPU_RIG_BONE_ID_REQUIRED");
      }
      if (boneIndex.has(bone.id)) throw new Error("WEBGPU_RIG_DUPLICATE_BONE " + bone.id);
      boneIndex.set(bone.id, index);
    });

    var depthMemo = new Map();
    function depthFor(id, trail) {
      if (depthMemo.has(id)) return depthMemo.get(id);
      var bone = rig.bones[id];
      if (!bone) throw new Error("WEBGPU_RIG_UNKNOWN_BONE " + id);
      var path = trail || [];
      if (path.includes(id)) throw new Error("WEBGPU_RIG_CYCLE " + path.concat(id).join(" -> "));
      var depth = 0;
      if (bone.parent !== null && bone.parent !== undefined) {
        if (!boneIndex.has(bone.parent)) throw new Error("WEBGPU_RIG_UNKNOWN_PARENT " + bone.parent);
        depth = depthFor(boneIndex.get(bone.parent), path.concat(id)) + 1;
      }
      depthMemo.set(id, depth);
      return depth;
    }

    var bones = rig.bones.map(function (bone, index) {
      var position = localPosition(bone.local_position);
      var scale = localScale(bone.local_scale);
      var parentIndex = bone.parent === null || bone.parent === undefined ? -1 : boneIndex.get(bone.parent);
      return {
        id: bone.id,
        parent: bone.parent === undefined ? null : bone.parent,
        parentIndex: parentIndex,
        depth: depthFor(index),
        localPosition: position,
        localRotation: finite(bone.local_rotation, 0),
        localScale: scale,
        control: typeof bone.control === "string" ? bone.control : null,
        positionControlX: isRecord(bone.position_control) && typeof bone.position_control.x === "string" ? bone.position_control.x : null,
        positionControlY: isRecord(bone.position_control) && typeof bone.position_control.y === "string" ? bone.position_control.y : null
      };
    });

    var rawAttachments = [];
    if (Array.isArray(rig.attachments)) rawAttachments = rawAttachments.concat(rig.attachments);
    if (Array.isArray(rig.objects)) rawAttachments = rawAttachments.concat(rig.objects);
    var attachmentIds = new Set();
    var attachments = rawAttachments.map(function (attachment, index) {
      if (!isRecord(attachment) || typeof attachment.id !== "string" || !attachment.id.trim()) {
        throw new Error("WEBGPU_RIG_ATTACHMENT_ID_REQUIRED");
      }
      if (attachmentIds.has(attachment.id)) throw new Error("WEBGPU_RIG_DUPLICATE_ATTACHMENT " + attachment.id);
      attachmentIds.add(attachment.id);
      if (typeof attachment.bone !== "string" || !boneIndex.has(attachment.bone)) {
        throw new Error("WEBGPU_RIG_ATTACHMENT_BONE_UNKNOWN " + attachment.id);
      }
      var position = localPosition(attachment.local_position);
      var scale = localScale(attachment.local_scale);
      return {
        id: attachment.id,
        kind: attachment.kind || (Array.isArray(rig.objects) && index >= (rig.attachments || []).length ? "object" : "part"),
        bone: attachment.bone,
        boneIndex: boneIndex.get(attachment.bone),
        localPosition: position,
        localRotation: finite(attachment.local_rotation, 0),
        scaleX: scale.x * (attachment.mirror ? -1 : 1),
        scaleY: scale.y,
        inheritRotation: attachment.inherit_rotation !== false,
        inheritScale: attachment.inherit_scale !== false,
        asset: typeof attachment.asset === "string" ? attachment.asset : null,
        z: finite(attachment.z, 0)
      };
    });

    var maxDepth = bones.reduce(function (max, bone) { return Math.max(max, bone.depth); }, 0);
    return { bones: bones, attachments: attachments, maxDepth: maxDepth };
  }

  function channelValue(pose, control) {
    if (!control) return 0;
    var channels = isRecord(pose && pose.channels) ? pose.channels : pose;
    return finite(channels && channels[control], 0);
  }

  function bufferUsage() {
    return global.GPUBufferUsage;
  }

  function mapModeRead() {
    return global.GPUMapMode.READ;
  }

  class WebGpuRig {
    constructor(device, layout) {
      this.device = device;
      this.layout = layout;
      this.boneCount = layout.bones.length;
      this.objectCount = layout.attachments.length;
      this.paramObjectOffset = (layout.maxDepth + 1) * PARAM_STRIDE;
      this.paramsBuffer = device.createBuffer({
        size: this.paramObjectOffset + PARAM_STRIDE,
        usage: bufferUsage().UNIFORM | bufferUsage().COPY_DST
      });
      this.boneInputBuffer = device.createBuffer({
        size: Math.max(16, this.boneCount * 2 * 16),
        usage: bufferUsage().STORAGE | bufferUsage().COPY_DST
      });
      this.boneWorldBuffer = device.createBuffer({
        size: Math.max(16, this.boneCount * 2 * 16),
        usage: bufferUsage().STORAGE | bufferUsage().COPY_DST
      });
      this.objectInputBuffer = device.createBuffer({
        size: Math.max(16, this.objectCount * 2 * 16),
        usage: bufferUsage().STORAGE | bufferUsage().COPY_DST
      });
      this.objectWorldBuffer = device.createBuffer({
        size: Math.max(16, this.objectCount * 2 * 16),
        usage: bufferUsage().STORAGE | bufferUsage().COPY_SRC
      });
      this.readbackBuffer = device.createBuffer({
        size: Math.max(16, this.objectCount * 2 * 16),
        usage: bufferUsage().COPY_DST | bufferUsage().MAP_READ
      });

      var shader = device.createShaderModule({ code: WEBGPU_RIG_WGSL });
      var computeStage = global.GPUShaderStage ? global.GPUShaderStage.COMPUTE : 4;
      this.bindGroupLayout = device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: computeStage, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: computeStage, buffer: { type: "storage" } },
        { binding: 2, visibility: computeStage, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: computeStage, buffer: { type: "storage" } },
        { binding: 4, visibility: computeStage, buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: PARAM_BYTES } }
      ] });
      var pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });
      this.bonePipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: shader, entryPoint: "bone_main" }
      });
      this.objectPipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: shader, entryPoint: "object_main" }
      });
      this.bindGroup = device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.boneInputBuffer } },
          { binding: 1, resource: { buffer: this.boneWorldBuffer } },
          { binding: 2, resource: { buffer: this.objectInputBuffer } },
          { binding: 3, resource: { buffer: this.objectWorldBuffer } },
          { binding: 4, resource: { buffer: this.paramsBuffer, offset: 0, size: PARAM_BYTES } }
        ]
      });

      this.writeStaticParameters();
      this.writeStaticAttachments();
      this.pending = Promise.resolve();
    }

    writeStaticParameters() {
      var boneCount = this.boneCount;
      var objectCount = this.objectCount;
      for (var depth = 0; depth <= this.layout.maxDepth; depth += 1) {
        this.device.queue.writeBuffer(this.paramsBuffer, depth * PARAM_STRIDE, new Uint32Array([boneCount, depth, objectCount, 0]));
      }
      this.device.queue.writeBuffer(this.paramsBuffer, this.paramObjectOffset, new Uint32Array([boneCount, 0, objectCount, 0]));
    }

    writeStaticAttachments() {
      var values = new Float32Array(Math.max(8, this.objectCount * 8));
      this.layout.attachments.forEach(function (attachment, index) {
        var offset = index * 8;
        values[offset] = attachment.boneIndex;
        values[offset + 1] = attachment.localPosition.x;
        values[offset + 2] = attachment.localPosition.y;
        values[offset + 3] = attachment.localRotation;
        values[offset + 4] = attachment.scaleX;
        values[offset + 5] = attachment.scaleY;
        values[offset + 6] = attachment.inheritRotation ? 1 : 0;
        values[offset + 7] = attachment.inheritScale ? 1 : 0;
      });
      this.device.queue.writeBuffer(this.objectInputBuffer, 0, values);
    }

    update(pose) {
      var values = new Float32Array(Math.max(8, this.boneCount * 8));
      this.layout.bones.forEach(function (bone, index) {
        var offset = index * 8;
        values[offset] = bone.localPosition.x + channelValue(pose, bone.positionControlX);
        values[offset + 1] = bone.localPosition.y + channelValue(pose, bone.positionControlY);
        values[offset + 2] = bone.localRotation + channelValue(pose, bone.control);
        values[offset + 3] = bone.parentIndex;
        values[offset + 4] = bone.depth;
        values[offset + 5] = bone.localScale.x;
        values[offset + 6] = bone.localScale.y;
        values[offset + 7] = 0;
      });
      this.device.queue.writeBuffer(this.boneInputBuffer, 0, values);

      var encoder = this.device.createCommandEncoder({ label: "shadow-movie-rig-compute" });
      for (var depth = 0; depth <= this.layout.maxDepth; depth += 1) {
        var bonePass = encoder.beginComputePass({ label: "shadow-movie-bones-depth-" + depth });
        bonePass.setPipeline(this.bonePipeline);
        bonePass.setBindGroup(0, this.bindGroup, [depth * PARAM_STRIDE]);
        bonePass.dispatchWorkgroups(Math.max(1, Math.ceil(this.boneCount / WORKGROUP_SIZE)));
        bonePass.end();
      }
      var objectPass = encoder.beginComputePass({ label: "shadow-movie-object-attachments" });
      objectPass.setPipeline(this.objectPipeline);
      objectPass.setBindGroup(0, this.bindGroup, [this.paramObjectOffset]);
      objectPass.dispatchWorkgroups(Math.max(1, Math.ceil(this.objectCount / WORKGROUP_SIZE)));
      objectPass.end();
      this.device.queue.submit([encoder.finish()]);
      this.pending = this.device.queue.onSubmittedWorkDone();
      return this.pending;
    }

    async readObjectWorldMatrices() {
      await this.pending;
      var encoder = this.device.createCommandEncoder({ label: "shadow-movie-rig-readback" });
      encoder.copyBufferToBuffer(this.objectWorldBuffer, 0, this.readbackBuffer, 0, Math.max(16, this.objectCount * 2 * 16));
      this.device.queue.submit([encoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      await this.readbackBuffer.mapAsync(mapModeRead());
      var mapped = this.readbackBuffer.getMappedRange();
      var result = new Float32Array(mapped.slice(0));
      this.readbackBuffer.unmap();
      return result;
    }

    getObjectWorldBuffer() {
      return this.objectWorldBuffer;
    }

    destroy() {
      [this.paramsBuffer, this.boneInputBuffer, this.boneWorldBuffer, this.objectInputBuffer, this.objectWorldBuffer, this.readbackBuffer].forEach(function (buffer) {
        buffer.destroy();
      });
    }
  }

  async function create(options) {
    var settings = options || {};
    var layout = settings.layout || buildRigLayout(settings.rig);
    if (!global.navigator || !global.navigator.gpu) return { supported: false, reason: "WEBGPU_UNAVAILABLE", layout: layout };
    var adapter = settings.adapter || await global.navigator.gpu.requestAdapter();
    if (!adapter) return { supported: false, reason: "WEBGPU_ADAPTER_UNAVAILABLE", layout: layout };
    var device = settings.device || await adapter.requestDevice();
    if (!device) return { supported: false, reason: "WEBGPU_DEVICE_UNAVAILABLE", layout: layout };
    return { supported: true, layout: layout, rig: new WebGpuRig(device, layout), adapter: adapter, device: device };
  }

  global.ShadowMovieWebGpuRig = {
    WORKGROUP_SIZE: WORKGROUP_SIZE,
    WGSL: WEBGPU_RIG_WGSL,
    buildLayout: buildRigLayout,
    create: create
  };
})(window);
