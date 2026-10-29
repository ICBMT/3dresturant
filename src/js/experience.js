/* ════════════════════════════════════════════
   The diorama — GLB restaurant on a blob island,
   scroll-driven camera rig, dust motes, lights.
   ════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import modelUrl from '../../doraemon-resturant.glb?url';
import { createIsland } from './island.js';

const TARGET_SIZE = 12; // longest horizontal edge of the diorama, world units
const DAMP = 3.6; // camera damping per second

/* ── camera keyframes ─────────────────────────
   theta: orbit angle (0 = behind the building, π = the open/front side)
   phi:   pitch above the horizon (rad)
   dist:  distance from target
   look:  target offset from diorama centre, fraction of its height
   shift: sideways aim offset (world units) — pushes the subject off-centre
          so it can share the frame with copy
*/
const POSES = [
  // hero — front three-quarter, the whole island floating
  { theta: Math.PI * -0.06, phi: 0.14, dist: 28.5, look: 0.62, fov: 32 },
  // statement — lift up and around the right corner
  { theta: Math.PI * 0.16, phi: 0.38, dist: 26, look: 0.46, fov: 33 },
  // story — slide round to the kitchen side, subject pushed right of the copy
  { theta: Math.PI * 0.34, phi: 0.2, dist: 24, look: 0.44, fov: 34, shift: -2.4 },
  // menu — low, close, straight down the open front
  { theta: Math.PI * 0.1, phi: 0.1, dist: 20, look: 0.4, fov: 36 },
  // crew — swing round to the host at the counter
  { theta: Math.PI * 1.42, phi: 0.17, dist: 8.6, look: 0.5, fov: 32, target: 'host', shift: 1.6 },
  // visit — pull back high and wide, the island as an object
  { theta: Math.PI * -0.3, phi: 0.4, dist: 33, look: 0.46, fov: 31 },
];
export class Experience {
  constructor(canvas, { onProgress } = {}) {
    this.canvas = canvas;
    this.onProgress = onProgress || (() => {});
    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2(0, 0);
    this.mouseTarget = new THREE.Vector2(0, 0);
    this.scroll = 0; // 0..1 target
    this.scrollSmooth = 0;
    this.poseIndex = 0;
    this.ready = false;
    this.hostPoint = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.radius = 12;
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._initialised = false;
  }

  async init() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a12, 0.0075);

    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 400);
    this.camera.position.set(0, 18, -30);

    // environment for the (lit) island
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    pmrem.dispose();

    this._addLights();
    await this._loadModel();
    this._buildDust();
    this._bindEvents();

    this.ready = true;
    this._onResize();
    this.resize();
    this._rendererReady = true;
  }

  /* ── lights: warm key + blue rim, matching the palette ── */
  _addLights() {
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x241408, 1.25);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffe6c8, 2.1);
    key.position.set(-14, 22, -16);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x4aa8ff, 1.6);
    rim.position.set(16, 10, 14);
    this.scene.add(rim);

    const fill = new THREE.DirectionalLight(0xff7a4a, 0.9);
    fill.position.set(10, 4, -18);
    this.scene.add(fill);

    // warm glow inside the restaurant windows / sign wall
    this.warmGlow = new THREE.PointLight(0xffb257, 22, 26, 2);
    this.warmGlow.position.set(0, 3, 2);
    this.scene.add(this.warmGlow);

    this.blueGlow = new THREE.PointLight(0x2f9dff, 14, 22, 2);
    this.blueGlow.position.set(4, 1.5, -6);
    this.scene.add(this.blueGlow);
  }

  _loadModel() {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          this._placeModel(gltf.scene);
          resolve();
        },
        (evt) => {
          if (evt.lengthComputable && evt.total) {
            this.onProgress(Math.min(0.985, evt.loaded / evt.total));
          }
        },
        (err) => reject(err)
      );
    });
  }

  /* ── scale, centre & drop the diorama onto the island ── */
  _placeModel(root) {

    root.traverse((o) => {
      if (!o.isMesh) return;
      // the baked-in sky sphere: hide it, we have a real environment now
      // (GLTFLoader strips dots from node names, so compare the clean form)
      const clean = o.name.replace(/[.\s]/g, '');
      if (clean.startsWith('Sphere_Material017')) {
        o.visible = false;
        o.userData.hidden = true;
        return;
      }
      o.frustumCulled = true;
      o.matrixAutoUpdate = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        m.side = THREE.FrontSide;
        if (m.map) {
          m.map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
          m.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    });

    // bounds of everything visible
    const box = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const b = new THREE.Box3().setFromObject(o);
      if (!b.isEmpty()) box.union(b);
    });

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = TARGET_SIZE / Math.max(size.x, size.z);
    const floorY = box.min.y;

    const holder = new THREE.Group();
    holder.name = 'diorama';
    holder.add(root);
    root.position.set(-center.x, -floorY, -center.z);
    holder.scale.setScalar(scale);
    holder.position.set(0, 0.02, 0);
    this.scene.add(holder);
    this.holder = holder;
    this.modelScale = scale;

    // world-space footprint → island radius
    const halfX = (size.x * scale) / 2;
    const halfZ = (size.z * scale) / 2;
    this.radius = Math.max(halfX, halfZ) * 1.12 + 1.5;

    this.center.set(0, (size.y * scale) * 0.5, 0);
    this.height = size.y * scale;

    // island under the diorama
    const island = createIsland(this.radius, Math.max(0.8, this.radius * 0.14));
    this.island = island.group;
    this.scene.add(this.island);

    // world matrices must be fresh before measuring the host
    this.scene.updateMatrixWorld(true);

    // find the host (Doraemon root .002) and compute his world-space point
    const hostRoot =
      root.getObjectByName('Sketchfab_model002') ||
      root.getObjectByName('Sketchfab_model.002') ||
      null;
    const hostSource = hostRoot || root;
    const hostBox = new THREE.Box3().setFromObject(hostSource);
    if (!hostBox.isEmpty()) {
      const c = hostBox.getCenter(new THREE.Vector3());
      this.hostPoint.copy(c);
    } else {
      this.hostPoint.set(0, this.height * 0.5, -this.radius * 0.3);
    }
    this.hostSize = hostBox.isEmpty() ? new THREE.Vector3(2, 2, 2) : hostBox.getSize(new THREE.Vector3());
    this.hostRadius = Math.max(this.hostSize.x, this.hostSize.y, this.hostSize.z);

    this._warmImageBitmaps();
    this.scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m.needsUpdate = true;
        });
      }
    });
  }

  /* some baked textures ship as ImageBitmaps; keep colours exact */
  _warmImageBitmaps() {
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        if (m.normalMap) m.normalMap.colorSpace = THREE.NoColorSpace;
        if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;
      }
    });
  }

  /* ── floating dust motes around the island ── */
  _buildDust() {
    const COUNT = 420;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const R = this.radius;
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = R * (0.3 + Math.random() * 1.15);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * (this.height * 1.15 + 3);
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,245,225,1)');
    g.addColorStop(0.35, 'rgba(255,210,150,0.55)');
    g.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(cv);
    sprite.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.PointsMaterial({
      size: 0.34,
      map: sprite,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
      sizeAttenuation: true,
      color: 0xffd9a8,
    });

    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);

    // warm halo ring sitting just under the island
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(this.radius * 0.9, this.radius * 1.55, 96, 1),
      new THREE.MeshBasicMaterial({
        color: 0xff6a3d,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -this.radius * 0.26;
    this.halo = ring;
    this.scene.add(ring);
  }

  _bindEvents() {
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    window.addEventListener('pointermove', (e) => {
      this.mouseTarget.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1
      );
    });

    this._onVis = () => {
      if (document.hidden) this.clock.stop();
      else this.clock.start();
    };
    document.addEventListener('visibilitychange', this._onVis);
  }

  resize() {
    if (!this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get poseCount() {
    return POSES.length;
  }

  /** scroll signal expressed as a fractional pose index (0 … poseCount-1) */
  setScroll(f) {
    this.scroll = THREE.MathUtils.clamp(f, 0, POSES.length - 1);
  }

  _poseTargets() {
    const segs = POSES.length - 1;
    const f = this.scroll;
    const i = Math.min(segs - 1, Math.floor(f));
    const t = THREE.MathUtils.clamp(f - i, 0, 1);
    const ease = t * t * (3 - 2 * t);
    const a = POSES[i];
    const b = POSES[i + 1];
    const hostMixA = a.target === 'host' ? 1 : 0;
    const hostMixB = b.target === 'host' ? 1 : 0;
    return {
      theta: THREE.MathUtils.lerp(a.theta, b.theta, ease),
      phi: THREE.MathUtils.lerp(a.phi, b.phi, ease),
      dist: THREE.MathUtils.lerp(a.dist, b.dist, ease),
      look: THREE.MathUtils.lerp(a.look, b.look, ease),
      fov: THREE.MathUtils.lerp(a.fov, b.fov, ease),
      shift: THREE.MathUtils.lerp(a.shift || 0, b.shift || 0, ease),
      hostMix: THREE.MathUtils.lerp(hostMixA, hostMixB, ease),
    };
  }

  start() {
    this.clock.start();
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this._tick();
    };
    loop();
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    // smooth the scroll signal a touch more (lenis already smooths)
    this.scrollSmooth += (this.scroll - this.scrollSmooth) * Math.min(1, dt * 5.5);
    this.mouse.lerp(this.mouseTarget, Math.min(1, dt * 2.6));

    const k = 1 - Math.exp(-DAMP * dt);
    const { theta, phi, dist, look, fov, shift, hostMix } = this._poseTargets();

    // narrow screens: widen the lens and step back so the island still fits
    const aspect = this.camera.aspect;
    const portrait = THREE.MathUtils.clamp((1 - aspect) / 0.55, 0, 1);
    const fovAdd = portrait * 18;

    // idle drift so the shot is never static
    const drift = Math.sin(time * 0.16) * 0.05 + Math.sin(time * 0.07) * 0.028;

    const host = this.hostPoint;
    const hostW = THREE.MathUtils.smoothstep(hostMix, 0.15, 0.95);

    // orbit centre — the diorama, or the host when we're on his shot
    const cx = host.x * hostW;
    const cy = THREE.MathUtils.lerp(this.height * look, host.y, hostW);
    const cz = host.z * hostW;

    const th = theta + drift + this.mouse.x * 0.03;
    const ph = THREE.MathUtils.clamp(phi + this.mouse.y * 0.018, 0.02, 1.35);

    // minimum distance that keeps the island inside the horizontal frustum
    const halfTanV = Math.tan(THREE.MathUtils.degToRad(fov + fovAdd) / 2);
    const needed = (this.radius * 1.06) / Math.max(0.06, 0.9 * halfTanV * aspect);
    const d = dist + Math.max(0, needed - dist) * (1 - hostW);

    // pointer parallax (subtle, in world units)
    const px = this.mouse.x * (0.5 + d * 0.045);
    const py = -this.mouse.y * (0.35 + d * 0.03);
    const bob = Math.sin(time * 0.55) * 0.14;

    // sideways aim offset, along the orbit's right axis
    const aimX = cx + Math.cos(th) * shift;
    const aimZ = cz - Math.sin(th) * shift;

    this._camPos.set(
      aimX + Math.sin(th) * Math.cos(ph) * d + px * 0.55,
      cy + Math.sin(ph) * d + bob + py * 0.4,
      aimZ + Math.cos(th) * Math.cos(ph) * d + px * 0.2
    );
    this._camLook.set(aimX + px * 0.1, cy + py * 0.08, aimZ);

    if (!this._initialised) {
      this.camera.position.copy(this._camPos);
      this._initialised = true;
    }
    this.camera.position.lerp(this._camPos, k);
    if (!this._lookInit) {
      this._lookSmooth = this._camLook.clone();
      this._lookInit = true;
    }
    this._lookSmooth.lerp(this._camLook, k);
    this.camera.lookAt(this._lookSmooth);

    const tf = fov + fovAdd;
    if (Math.abs(this.camera.fov - tf) > 0.01) {
      this.camera.fov += (tf - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
    }

    // world life
    if (this.holder) {
      this.holder.position.y = 0.02 + Math.sin(time * 0.7) * 0.055;
      this.holder.rotation.z = Math.sin(time * 0.35) * 0.0035;
    }
    if (this.dust) {
      const arr = this.dust.geometry.attributes.position.array;
      const n = arr.length / 3;
      for (let i = 0; i < n; i++) {
        arr[i * 3 + 1] += dt * (0.12 + (i % 7) * 0.026);
        if (arr[i * 3 + 1] > this.height * 1.4 + 4) arr[i * 3 + 1] = 0;
        arr[i * 3] += Math.sin(time * 0.5 + i) * dt * 0.05;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
      this.dust.rotation.y = time * 0.012;
    }
    if (this.halo) {
      this.halo.rotation.z = time * 0.05;
      this.halo.material.opacity = 0.09 + Math.sin(time * 1.1) * 0.025;
    }
    if (this.warmGlow) {
      this.warmGlow.intensity = 20 + Math.sin(time * 2.1) * 2.6 + Math.sin(time * 5.7) * 1.2;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
