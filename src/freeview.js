/* ════════════════════════════════════════════
   Free view — the same diorama, full screen, orbitable.
   Drag to orbit, wheel / pinch to zoom, right-drag / two fingers to pan.
   ════════════════════════════════════════════ */
import '@fontsource/archivo-black/400.css';
import '@fontsource-variable/space-grotesk';
import './styles/freeview.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createIsland } from './js/island.js';
import { budgetTextures, textureMode, budgetForMode } from './js/texbudget.js';

import modelUrl from '../doraemon-resturant.glb?url';

const TARGET_SIZE = 12;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── DOM ─────────────────────────────────── */
const canvas = document.getElementById('stage');
const loaderEl = document.getElementById('fv-loader');
const barEl = document.getElementById('fv-bar');
const countEl = document.getElementById('fv-count');
const autoBtn = document.getElementById('fv-auto');
const resetBtn = document.getElementById('fv-reset');
const fullBtn = document.getElementById('fv-full');
const toastEl = document.getElementById('fv-toast');

/* ── renderer ────────────────────────────── */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a12, 0.006);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 400);

/* environment for the lit island */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

/* ── lights (same palette as the scrollytelling scene) ── */
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x241408, 1.3));

const key = new THREE.DirectionalLight(0xffe6c8, 2.1);
key.position.set(-14, 22, -16);
scene.add(key);

const rim = new THREE.DirectionalLight(0x4aa8ff, 1.5);
rim.position.set(16, 10, 14);
scene.add(rim);

const fill = new THREE.DirectionalLight(0xff7a4a, 0.9);
fill.position.set(10, 4, -18);
scene.add(fill);

const warmGlow = new THREE.PointLight(0xffb257, 22, 26, 2);
warmGlow.position.set(0, 3, 2);
scene.add(warmGlow);

/* ── dust motes ──────────────────────────── */
let dust = null;
function buildDust(radius, height) {
  const COUNT = 380;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = radius * (0.3 + Math.random() * 1.15);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * (height * 1.2 + 3);
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,245,225,1)');
  g.addColorStop(0.35, 'rgba(255,210,150,0.5)');
  g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const sprite = new THREE.CanvasTexture(cv);
  sprite.colorSpace = THREE.SRGBColorSpace;

  dust = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.32,
      map: sprite,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.8,
      color: 0xffd9a8,
    })
  );
  dust.frustumCulled = false;
  scene.add(dust);
}

/* ── model ───────────────────────────────── */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.6;
controls.screenSpacePanning = true;
controls.minDistance = 6;
controls.maxDistance = 62;
controls.maxPolarAngle = Math.PI * 0.495; // never dip under the island
controls.minPolarAngle = 0.02;
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.42;
controls.target.set(0, 3, 0);
controls.keyPanSpeed = 12;
controls.listenToKeyEvents(window); // arrow keys pan, +/- zoom

let home = { position: new THREE.Vector3(), target: new THREE.Vector3(), dist: 30 };
let height = 4.6;
let radius = 8;

function placeModel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const clean = o.name.replace(/[.\s]/g, '');
    if (clean.startsWith('Sphere_Material017')) {
      o.visible = false;
      return;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      m.side = THREE.FrontSide;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      if (m.normalMap) m.normalMap.colorSpace = THREE.NoColorSpace;
      if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;
      if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      if (m.map) m.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
  });

  // cap oversized uploads BEFORE the first render (8K backdrop card)
  const report = budgetTextures(renderer, root, { budgetMB: budgetForMode(textureMode()) });
  if (report.resized?.length) {
    console.info(
      `[free view] textures ${report.totalMB} MB (budget ${report.budgetMB} MB), ${report.resized.length} resized`
    );
  }

  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const b = new THREE.Box3().setFromObject(o);
    if (!b.isEmpty()) box.union(b);
  });

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = TARGET_SIZE / Math.max(size.x, size.z);

  const holder = new THREE.Group();
  holder.name = 'diorama';
  holder.add(root);
  root.position.set(-center.x, -box.min.y, -center.z);
  holder.scale.setScalar(scale);
  scene.add(holder);

  height = size.y * scale;
  const halfX = (size.x * scale) / 2;
  const halfZ = (size.z * scale) / 2;
  radius = Math.max(halfX, halfZ) * 1.12 + 1.5;

  const island = createIsland(radius, Math.max(0.8, radius * 0.14));
  scene.add(island.group);

  buildDust(radius, height);

  // set the lens for this aspect, then fit the island in the tighter axis
  fitFov();
  frameView();
  userMoved = false;
}

/* ── framing ─────────────────────────────── */
let userMoved = false;

function computeHome() {
  const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tx = ty * camera.aspect;
  const halfFit = Math.max(0.06, Math.min(tx, ty)); // the tighter axis wins
  const dist = (radius * 1.14) / (halfFit * 0.86);

  const target = new THREE.Vector3(0, height * 0.5, 0);
  const theta = -0.06 * Math.PI; // same front three-quarter as the hero
  const phi = 0.3;
  const position = new THREE.Vector3(
    Math.sin(theta) * Math.cos(phi) * dist,
    target.y + Math.sin(phi) * dist,
    Math.cos(theta) * Math.cos(phi) * dist
  );
  return { position, target, dist };
}

function frameView(snap = true) {
  home = computeHome();
  controls.minDistance = Math.max(4, radius * 0.55);
  controls.maxDistance = home.dist * 1.9;

  if (!snap) return;
  camera.position.copy(home.position);
  controls.target.copy(home.target);
  controls.update();
}

/* ── responsive framing: pull back on portrait screens ── */
function fitFov() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  const portrait = THREE.MathUtils.clamp((1 - aspect) / 0.55, 0, 1);
  camera.fov = 38 + portrait * 16;
  camera.updateProjectionMatrix();
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  fitFov();
  if (radius > 0 && !userMoved) frameView();
}
window.addEventListener('resize', resize);

/* ── loader ──────────────────────────────── */
function setProgress(p) {
  const v = Math.max(0, Math.min(1, p));
  barEl.style.transform = `scaleX(${v})`;
  countEl.textContent = String(Math.round(v * 100)).padStart(2, '0');
}

function hideLoader() {
  setProgress(1);
  setTimeout(() => loaderEl.classList.add('is-done'), 260);
}

const gltfLoader = new GLTFLoader();
gltfLoader.load(
  modelUrl,
  (gltf) => {
    placeModel(gltf.scene);
    hideLoader();
    renderer.setAnimationLoop(tick);
  },
  (evt) => {
    if (evt.lengthComputable && evt.total) setProgress((evt.loaded / evt.total) * 0.98);
  },
  (err) => {
    console.error('[free view] failed to load the diorama', err);
    loaderEl.querySelector('.fv__loader-label').textContent = 'the diorama could not be loaded';
    toast('model failed to load', 4000);
  }
);

/* ── render loop ─────────────────────────── */
const clock = new THREE.Clock();
let contextLost = false;

function tick() {
  if (contextLost) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (dust) {
    dust.rotation.y = time * 0.012;
    dust.position.y = Math.sin(time * 0.4) * 0.16;
  }
  warmGlow.intensity = 20 + Math.sin(time * 2.1) * 2.6 + Math.sin(time * 5.7) * 1.2;

  controls.update();
  renderer.render(scene, camera);
}

/* ── context loss safety ─────────────────── */
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  contextLost = true;
  toast('GPU context lost — drag to recover', 3000);
});
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  resize();
  renderer.setAnimationLoop(tick);
  toast('view restored', 1800);
});

/* ── UI ──────────────────────────────────── */
let toastTimer = 0;
function toast(msg, ms = 2200) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-shown'), ms);
}

const syncAutoBtn = () => {
  autoBtn?.classList.toggle('is-on', controls.autoRotate);
  autoBtn?.setAttribute('aria-pressed', String(controls.autoRotate));
};

autoBtn?.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  syncAutoBtn();
  toast(controls.autoRotate ? 'auto spin on' : 'auto spin off', 1400);
});

// a drag pauses the spin for a moment, then it eases back in
let resumeTimer = 0;
const pauseSpin = () => {
  if (!controls.autoRotate || reduceMotion) return;
  controls.autoRotate = false;
  syncAutoBtn();
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    controls.autoRotate = true;
    syncAutoBtn();
  }, 6000);
};
controls.addEventListener('start', () => {
  userMoved = true;
});
canvas.addEventListener('pointerdown', pauseSpin, { passive: true });
canvas.addEventListener('wheel', pauseSpin, { passive: true });

resetBtn?.addEventListener('click', () => {
  userMoved = false;
  frameView();
  toast('view reset', 1400);
});

fullBtn?.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('fullscreen unavailable', 2000);
  }
});

document.addEventListener('fullscreenchange', () => {
  if (fullBtn) fullBtn.classList.toggle('is-on', !!document.fullscreenElement);
  setTimeout(resize, 120);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') resetBtn?.click();
  if (e.key === ' ') {
    e.preventDefault();
    autoBtn?.click();
  }
});

canvas.addEventListener('pointerdown', () => canvas.classList.add('is-dragging'));
window.addEventListener('pointerup', () => canvas.classList.remove('is-dragging'));

syncAutoBtn();

/* expose a tiny handle for diagnostics */
window.__freeview = { scene, camera, controls, renderer };
