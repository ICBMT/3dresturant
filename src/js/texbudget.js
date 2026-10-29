/* ════════════════════════════════════════════
   GPU texture budget — shared by the scrollytelling scene and the
   free-view page.

   The source GLB ships an 8192×8192 JPEG (a backdrop card). Decoded and
   mip-mapped that is ~360 MB of VRAM for one map, and ~500 MB for the set.
   Uploading it on the first drawn frame stalls the GPU and can drop the
   WebGL context, which reads as "the model appears, then goes blank".

   This caps only the *upload* size: the .glb on disk is never modified, no
   mesh, UV or texture file is touched.
   ════════════════════════════════════════════ */

export const MIN_TEX_SIDE = 256;

/** read ?textures=full|low|auto from the URL */
export function textureMode() {
  try {
    return new URLSearchParams(window.location.search).get('textures') || 'auto';
  } catch {
    return 'auto';
  }
}

export function budgetForMode(mode) {
  if (mode === 'full') return Infinity;
  if (mode === 'low') return 80;
  return 160;
}

function texBytes(w, h, tex) {
  const mips = tex.generateMipmaps ? 1.34 : 1;
  return w * h * 4 * mips;
}

function totalBytes(items) {
  // a texture shared by several material slots is only uploaded once
  const live = new Map();
  for (const it of items) {
    live.set(it.tex.uuid, Math.max(live.get(it.tex.uuid) || 0, it.bytes));
  }
  let sum = 0;
  for (const b of live.values()) sum += b;
  return sum;
}

function downscale(item, targetLongSide, cache, replaced) {
  const { tex } = item;
  const longSide = Math.max(item.w, item.h);
  if (!longSide || targetLongSide >= longSide) return;

  const scale = targetLongSide / longSide;
  const nw = Math.max(1, Math.round(item.w * scale));
  const nh = Math.max(1, Math.round(item.h * scale));
  if (!item.resizedFrom) item.resizedFrom = `${item.w}×${item.h}`;

  let entry = cache.get(item.img);
  if (!entry || entry.w !== nw || entry.h !== nh) {
    const cv = document.createElement('canvas');
    cv.width = nw;
    cv.height = nh;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    try {
      ctx.drawImage(tex.image, 0, 0, nw, nh);
    } catch {
      return; // not drawable — leave the original in place
    }
    entry = { canvas: cv, w: nw, h: nh };
    cache.set(item.img, entry);
  }

  if (item.img !== entry.canvas) replaced.add(item.img);
  tex.image = entry.canvas;
  tex.needsUpdate = true;

  item.w = entry.w;
  item.h = entry.h;
  item.bytes = texBytes(item.w, item.h, tex);
}

/** free decoded bitmaps we replaced — an 8K JPEG is ~270 MB of RAM */
function releaseReplaced(items, replaced) {
  const stillUsed = new Set(items.map((it) => it.tex.image));
  for (const img of replaced) {
    if (stillUsed.has(img)) continue;
    if (typeof img.close === 'function') {
      try {
        img.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * @param {import('three').WebGLRenderer} renderer
 * @param {import('three').Object3D} root
 * @param {{ mode?: string, budgetMB?: number }} [opts]
 * @returns {{totalMB:number,budgetMB:number,maxTextureSize:number,resized:Array}}
 */
export function budgetTextures(renderer, root, opts = {}) {
  const mode = opts.mode || textureMode();
  const budgetMB = opts.budgetMB ?? budgetForMode(mode);
  const maxTex = renderer.capabilities.maxTextureSize || 4096;

  const seen = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture && v.image && !seen.has(v.uuid)) {
          seen.set(v.uuid, { tex: v, mat: m.name || '', prop: key });
        }
      }
    }
  });

  const items = [...seen.values()].map(({ tex, mat, prop }) => {
    const img = tex.image;
    const w = img.width || 0;
    const h = img.height || 0;
    return { tex, mat, prop, w, h, bytes: texBytes(w, h, tex), img };
  });

  if (!items.length) {
    return { totalMB: 0, budgetMB, resized: [], maxTextureSize: maxTex };
  }

  const cache = new Map();
  const replaced = new Set();

  // never exceed what the hardware can sample
  for (const it of items) {
    if (Math.max(it.w, it.h) > maxTex) downscale(it, maxTex, cache, replaced);
  }

  // then fit the memory budget, biggest map first
  let guard = 0;
  while (totalBytes(items) / 1e6 > budgetMB && guard++ < 48) {
    const biggest = items
      .filter((it) => Math.max(it.w, it.h) > MIN_TEX_SIDE)
      .sort((a, b) => b.bytes - a.bytes)[0];
    if (!biggest) break;
    downscale(
      biggest,
      Math.max(MIN_TEX_SIDE, Math.round(Math.max(biggest.w, biggest.h) / 2)),
      cache,
      replaced
    );
  }

  releaseReplaced(items, replaced);

  return {
    totalMB: +(totalBytes(items) / 1e6).toFixed(1),
    budgetMB,
    maxTextureSize: maxTex,
    resized: items
      .filter((it) => it.resizedFrom)
      .map((it) => ({ from: it.resizedFrom, to: `${it.w}×${it.h}`, mat: it.mat, prop: it.prop })),
  };
}
