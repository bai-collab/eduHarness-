---
name: image-to-3d-scene
description: 'Rebuild a supplied scene image as an interactive, freely orbitable Three.js 3D showcase page that faithfully matches its spatial layout, lighting, palette, and atmosphere using only procedural assets (canvas textures, shaders, particles — no image generation), then verify fidelity by serving the page, screenshotting it in a real browser, and comparing against the original until publishable. Use whenever the user provides or references an image and wants a 3D or interactive scene built from it — 圖片轉3D, 3D 展示頁, 可環繞場景, hero section, product showcase, portfolio landing — even if Three.js is not mentioned. Not for photogrammetry or 3D model file export (GLB/OBJ/FBX).'
---

# 圖片轉3D

Turn one scene image into a polished, orbitable Three.js showcase page that faithfully reconstructs the image's spatial layout, lighting, and atmosphere — procedural assets only, verified by screenshot comparison against the original.

Respond to the user in their language (zh-TW by default in this workspace). Page UI strings follow the scene's implied audience.

## Operating principles

- **No image generation exists here.** Every material is procedural: canvas textures, shaders, gradients, noise, particles. Treat this as an advantage — tiny files, instant load, crisp at any resolution.
- **Fidelity comes from the verify loop, not the first draft.** The page gets opened in a real browser, screenshotted, compared with the original, and fixed. Minimum two rounds.
- **Faithful-stylized beats uncanny-realistic.** Match space, light direction, palette, and mood exactly; simplify surface detail deliberately. Never promise photorealism from primitives.
- **The quality bar is 可公開發佈**: zero console errors, smooth orbit incl. touch, responsive resize, polished overlay, subtle idle motion. Say so in one line when delivering.

## Workflow

### 1. Analyze the image before any code

View the image with the Read tool. If no image was provided, ask for one — the only blocking question. Then write a compact scene spec:

| Field | Capture |
|---|---|
| Layout | Objects, positions, depth order, rough scale; original camera height + angle |
| Geometry plan | Primitive per object: box / plane / cylinder / lathe / extrude / InstancedMesh |
| Lighting | Key light direction + color temperature, fill, ambient, shadow hardness |
| Palette | 6–8 dominant hex colors read off the image |
| Atmosphere | Fog/haze, time of day, weather, mood |
| Style call | stylized-faithful / low-poly / realistic-leaning — whichever can actually hit the bar |

State the style call to the user in one line while building; do not wait for permission.

### 2. Build the single-file page

One HTML file. Import map pinned to `three@0.170.0` from CDN. Full skeleton and recipes: [references/threejs-recipes.md](references/threejs-recipes.md) — read it before writing the page. Non-negotiables:

- `outputColorSpace = SRGBColorSpace` + ACES tone mapping (without these, colors will not match the image)
- Default camera pose reproduces the original image's composition — this is the shot that gets compared
- OrbitControls with damping; clamp polar/azimuth/distance so the set never shows its unbuilt back side
- Lighting rig and fog straight from the scene spec
- Subtle idle life (drift, flicker, particles) so the scene never feels frozen
- Overlay: title + 「拖曳環繞・滾輪縮放」 hint that fades on first interaction
- Resize handler, `pixelRatio` capped at 2, works with touch

### 3. Verify loop (mandatory, ≥2 rounds)

ES modules do not load over `file://` — serve the folder on localhost (any static server), then:

1. Open the page in the browser pane, wait for first render, screenshot.
2. Compare against the original image: composition from the default camera, proportions, palette, light direction, mood. List concrete diffs.
3. Check zero console errors; drag the scene with the pointer to confirm orbit + damping actually work; watch for z-fighting and clipping while orbiting.
4. Fix, re-screenshot. Stop when remaining diffs are taste, not error.

The default-camera screenshot must read as a recognizable sibling of the original image. If no browser tooling is available in the current environment, say plainly that visual verification was not performed — never claim it was.

### 4. Deliver

- Report the file path, the serve command, verification rounds run, and what changed per round.
- Publishing as a claude.ai Artifact requires inlining three.js (CSP blocks CDN) — procedure in the references file, "Offline / Artifact delivery".

## User add-ons

When the user asks for extras (each has a recipe in the references file):

| Request | Approach |
|---|---|
| 燈光效果 | Spotlights, emissive practicals, UnrealBloomPass |
| 背景音樂 | WebAudio, gated behind first user gesture |
| 天氣變化 | Particle systems + fog/lighting state lerp |
| 鏡頭運動 | Eased intro flight to the default pose; optional slow idle orbit |
| 使用者互動 | Raycaster hover/click highlights |
| 粒子特效 | Additive-blended `THREE.Points` |

## Scope honesty

Not photogrammetry, not depth estimation, no GLB/OBJ export claims. Report actual screenshot findings — if the third round still misses the mood, say which part misses and what the next lever would be.

<!-- Origin: adapted from a community Codex prompt (image → Three.js scene, ImageGen assets); rebuilt for Claude/Codex dual runtime with procedural assets and a browser screenshot verify loop. -->
