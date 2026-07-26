# Three.js Recipes — 圖片轉3D

Contents:

1. Page skeleton (runnable)
2. Camera constraints
3. Lighting rigs by mood
4. Procedural textures (canvas helper)
5. Sky dome
6. Particles (dust / snow / rain / fireflies)
7. Bloom post-processing
8. Camera intro flight
9. Raycaster interaction
10. Audio (gesture-gated)
11. Performance & mobile checklist
12. Offline / Artifact delivery (inlining three.js)

---

## 1. Page skeleton

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>場景標題</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#000}
  #app{position:fixed;inset:0}
  .overlay{position:fixed;left:0;right:0;bottom:24px;text-align:center;color:#fff;
    font:14px/1.6 system-ui;opacity:.75;pointer-events:none;transition:opacity 1s}
  .overlay.hidden{opacity:0}
</style>
<script type="importmap">
{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
}}
</script>
</head>
<body>
<div id="app"></div>
<div class="overlay" id="hint">拖曳環繞・滾輪縮放</div>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x91a3b8, 18, 60);            // from scene spec
const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 200);
camera.position.set(0, 3.2, 10);                         // = original image composition
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.4, 0);                          // visual focal point
controls.enableDamping = true;
controls.minDistance = 4;  controls.maxDistance = 18;
controls.minPolarAngle = 0.9; controls.maxPolarAngle = 1.45;

// ... build scene here ...

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  controls.update();
  // idle life here (drift, flicker, particle fall)
  renderer.render(scene, camera);
});
['pointerdown','wheel','touchstart'].forEach(e =>
  addEventListener(e, () => hint.classList.add('hidden'), { once: true }));
</script>
</body>
</html>
```

Serve with any static server (`python -m http.server 8123`) — ES modules are blocked over `file://`.

## 2. Camera constraints

Clamp so viewers never see the unbuilt back of the set:

- Interior / stage scenes: `minAzimuthAngle` / `maxAzimuthAngle` ±0.6–1.2 rad around the default view.
- Exteriors with a full skybox: leave azimuth free, clamp `maxPolarAngle ≈ 1.5` so the camera never dives underground.
- `minDistance` keeps the camera outside geometry; `maxDistance` keeps fog/sky dome from breaking the illusion.

## 3. Lighting rigs by mood

| Mood | Rig |
|---|---|
| 白天晴朗 | `DirectionalLight('#fff2d9', 2.5)` castShadow + `HemisphereLight(skyColor, groundColor, 0.6)` |
| 黃昏 | `DirectionalLight('#ffb36b', 2.0)` at low angle + `HemisphereLight('#6478b8', '#3a2c22', 0.5)` + warm fog |
| 夜晚 | Moon `DirectionalLight('#6b7ea8', 0.4)` + PointLights as practicals (lamps, windows) + bloom |
| 室內 | SpotLight through the "window" direction + low AmbientLight + emissive fixtures |
| 霓虹/賽博 | Emissive materials (`emissiveIntensity` 2–4) + UnrealBloomPass + near-black ambient |

Shadow setup: `light.shadow.mapSize.set(2048, 2048)`; fit the shadow camera box to the scene bounds; `bias = -0.0005` against acne. Match the key light's azimuth/elevation to the shadows visible in the image — wrong light direction is the most common "looks off" cause.

## 4. Procedural textures

```js
function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Example: speckled ground
const groundTex = canvasTexture(512, (ctx, s) => {
  ctx.fillStyle = '#8a7a66'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(${60+Math.random()*40|0},${50+Math.random()*35|0},${40+Math.random()*30|0},${Math.random()*0.25})`;
    ctx.fillRect(Math.random()*s, Math.random()*s, 2, 2);
  }
});
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(6, 6);
```

Patterns that read well from canvas: speckle/noise fills, radial + linear gradients, stripes/planks (dark seam lines + jitter), brick (offset rows), window grids for distant buildings (bright rects on dark, some lit some not). Use `roughness` 0.7–1.0 for matte natural surfaces; reserve low roughness + high `envMapIntensity` for glass/metal/water.

## 5. Sky dome

```js
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(90, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top:    { value: new THREE.Color('#2b4a7a') },
      bottom: { value: new THREE.Color('#d9a066') }
    },
    vertexShader: `varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bottom;
      void main(){ float h = normalize(vP).y*0.5+0.5;
        gl_FragColor = vec4(mix(bottom, top, smoothstep(0.02, 0.6, h)), 1.0); }`
  })
);
scene.add(sky);
```

Sample `top`/`bottom` straight from the image's sky. Add a sun/moon glow by mixing a third color near a uniform direction if the image shows one. Keep `scene.fog` color close to the horizon color so geometry fades into the sky instead of cutting out.

## 6. Particles

```js
function particles(count, spread, size, color, opacity) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count*3);
  for (let i = 0; i < count*3; i++) p[i] = (Math.random()-0.5)*spread;
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    size, color, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
}
```

- 塵埃/光斑: 200–400 points, slow sinusoidal drift in the loop.
- 雪: decrement `y` per frame with per-particle speed; reset to top below 0; small x-sway.
- 雨: same fall logic but fast, thin, `opacity 0.3`, or stretched `LineSegments`.
- 螢火蟲: few dozen warm points, per-particle phase for pulsing opacity (set `material.opacity` groups or vertex colors).

Mutate `geometry.attributes.position.array` then set `needsUpdate = true` — no per-frame allocations.

## 7. Bloom

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.8, 0.85));
// loop: composer.render() instead of renderer.render(); resize: composer.setSize(...)
```

Use for night/neon/emissive scenes only; daylight scenes rarely benefit. Threshold ≥ 0.85 keeps bloom on emissives instead of washing the whole frame.

## 8. Camera intro flight

```js
const from = camera.position.clone().add(new THREE.Vector3(0, 4, 6));
const to = camera.position.clone();
let t0 = null; controls.enabled = false;
function intro(now) {
  t0 ??= now;
  const k = Math.min((now - t0) / 1800, 1);
  const e = 1 - Math.pow(1 - k, 3);                     // easeOutCubic
  camera.position.lerpVectors(from, to, e);
  camera.lookAt(controls.target);
  if (k < 1) requestAnimationFrame(intro); else controls.enabled = true;
}
requestAnimationFrame(intro);
```

Ends exactly at the default (comparison) pose. Skip the intro when screenshotting for the verify loop, or wait for it to finish first.

## 9. Raycaster interaction

```js
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
const pickables = [];                                    // meshes that react
addEventListener('pointermove', e => {
  pointer.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(pickables)[0];
  document.body.style.cursor = hit ? 'pointer' : '';
  // highlight: lerp emissiveIntensity up on hit.object, down on others
});
```

## 10. Audio (gesture-gated)

Browsers block autoplay — start on first gesture, synthesize ambience with WebAudio (no external files):

```js
addEventListener('pointerdown', () => {
  const ctx = new AudioContext();
  const noise = ctx.createBufferSource(), buf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*0.15;
  noise.buffer = buf; noise.loop = true;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 400; // wind
  const gain = ctx.createGain(); gain.gain.value = 0.05;
  noise.connect(filter).connect(gain).connect(ctx.destination); noise.start();
}, { once: true });
```

Filtered noise = wind/rain/sea; slow-attack detuned oscillators = pads. Always include a mute button.

## 11. Performance & mobile checklist

- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`
- `InstancedMesh` for any repeated object (trees, posts, rocks, windows)
- Shadow map ≤ 2048; only the key light casts shadows
- Fog hides the far plane — never rely on a visible hard horizon edge
- No allocations inside the animation loop (reuse vectors)
- OrbitControls handles touch natively; verify pinch-zoom against min/maxDistance
- Target: smooth on integrated GPU; if choppy, drop shadow size before dropping geometry

## 12. Offline / Artifact delivery

claude.ai Artifacts block all external hosts (CSP) — the CDN import map will not load. Two options, in order of preference:

1. **Bundle**: keep scene code in `scene.js`, then
   `npx esbuild scene.js --bundle --minify --format=iife --outfile=bundle.js`
   and paste `bundle.js` into a single inline `<script>`. Verify the bundled page locally before publishing.
2. **No-addon build**: if bundling is unavailable, drop `three/addons` entirely — replace OrbitControls with the mini controller below, skip post-processing — and inline `three.module.min.js` via an import map `data:` URL. Test carefully; import-map data URLs are the fragile path.

```js
// Mini orbit controller (no addons; drag to orbit, wheel to zoom, inertial damping)
function makeOrbit(camera, dom, target, opt = {}) {
  const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
  const o = { minR: opt.minR ?? s.radius*0.5, maxR: opt.maxR ?? s.radius*2,
              minPhi: opt.minPhi ?? 0.4, maxPhi: opt.maxPhi ?? 1.5,
              minTheta: opt.minTheta ?? -Infinity, maxTheta: opt.maxTheta ?? Infinity };
  let vT = 0, vP = 0, vR = 0, drag = null;
  dom.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); });
  dom.addEventListener('pointermove', e => {
    if (!drag) return;
    vT -= (e.clientX - drag.x) * 0.005; vP -= (e.clientY - drag.y) * 0.005;
    drag = { x: e.clientX, y: e.clientY };
  });
  dom.addEventListener('pointerup', () => drag = null);
  dom.addEventListener('wheel', e => { e.preventDefault(); vR += e.deltaY * 0.001; }, { passive: false });
  return { update() {
    s.theta = Math.min(o.maxTheta, Math.max(o.minTheta, s.theta + vT));
    s.phi   = Math.min(o.maxPhi,   Math.max(o.minPhi,   s.phi + vP));
    s.radius = Math.min(o.maxR, Math.max(o.minR, s.radius * (1 + vR)));
    vT *= 0.85; vP *= 0.85; vR *= 0.8;
    camera.position.setFromSpherical(s).add(target);
    camera.lookAt(target);
  } };
}
```
