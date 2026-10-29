/* ════════════════════════════════════════════
   Blob island — organic "painted png" pedestal
   the diorama restaurant sits on.
   ════════════════════════════════════════════ */
import * as THREE from 'three';

/* soft painted top texture (canvas → like a png blob fill) */
function makeTopTexture() {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');

  // warm painted base
  const g = ctx.createRadialGradient(S * 0.46, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.72);
  g.addColorStop(0, '#fffaf1');
  g.addColorStop(0.45, '#f7ead8');
  g.addColorStop(0.8, '#eed7bd');
  g.addColorStop(1, '#e3c4a6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // faint tint pools — vermilion / blue / gold washes
  const pools = [
    ['rgba(255,110,70,0.10)', 0.72, 0.3, 0.34],
    ['rgba(70,160,255,0.09)', 0.24, 0.66, 0.36],
    ['rgba(255,196,90,0.12)', 0.55, 0.78, 0.3],
    ['rgba(120,70,40,0.10)', 0.2, 0.2, 0.26],
  ];
  for (const [color, x, y, r] of pools) {
    const pg = ctx.createRadialGradient(S * x, S * y, 0, S * x, S * y, S * r);
    pg.addColorStop(0, color);
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, S, S);
  }

  // paper speckle
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // a couple of hand-drawn contour rings (artful, like painted iso lines)
  ctx.strokeStyle = 'rgba(120, 74, 44, 0.12)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse(S * 0.5, S * 0.5, S * (0.2 + k * 0.09), S * (0.16 + k * 0.085), 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* radial soft shadow sprite texture */
function makeShadowTexture() {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Build the blob island.
 * @param {number} R outer radius (world units, pre-scale)
 * @param {number} depth extrusion depth
 */
export function createIsland(R, depth = 0.85) {
  const group = new THREE.Group();
  group.name = 'blob-island';

  // organic outline — layered harmonics on a circle
  const pts = [];
  const N = 220;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r =
      R *
      (1 +
        0.062 * Math.sin(3 * a + 0.7) +
        0.045 * Math.sin(5 * a - 1.15) +
        0.028 * Math.sin(7 * a + 2.2) +
        0.018 * Math.sin(11 * a + 0.4));
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const shape = new THREE.Shape(pts);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.18,
    bevelSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.max.y, 0); // top face → y = 0
  geo.computeVertexNormals();

  const topTex = makeTopTexture();
  // extrude UVs live in raw shape-space — remap to 0..1
  topTex.wrapS = topTex.wrapT = THREE.ClampToEdgeWrapping;
  topTex.repeat.set(1 / (R * 2.3), 1 / (R * 2.3));
  topTex.offset.set(0.5, 0.5);

  const capMat = new THREE.MeshStandardMaterial({
    map: topTex,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.5,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#caa284'),
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.45,
  });

  const mesh = new THREE.Mesh(geo, [capMat, sideMat]); // group 0 = caps, 1 = walls
  mesh.receiveShadow = true;
  mesh.name = 'island-mesh';
  group.add(mesh);

  // soft floating shadow beneath the island
  const shTex = makeShadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 2.7, R * 2.7),
    new THREE.MeshBasicMaterial({
      map: shTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      color: 0x000000,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -depth - 1.35;
  shadow.renderOrder = -1;
  group.add(shadow);

  return { group, mesh, R };
}
