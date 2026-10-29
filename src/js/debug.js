/* ════════════════════════════════════════════
   ?debug=1 — live diagnostics overlay.
   Tells us whether the canvas is actually blank (GPU dropped) or whether
   something is painting over it (a layering bug).
   ════════════════════════════════════════════ */

export function initDebug(experience) {
  if (new URLSearchParams(window.location.search).get('debug') !== '1') return;

  const panel = document.createElement('div');
  panel.className = 'dbg';
  panel.innerHTML = `
    <div class="dbg__head">
      <strong>DIORAMA DIAGNOSTICS</strong>
      <button type="button" class="dbg__x" aria-label="close">×</button>
    </div>
    <pre class="dbg__body"></pre>
    <div class="dbg__row">
      <button type="button" data-act="copy">copy report</button>
      <button type="button" data-act="redraw">force redraw</button>
    </div>
  `;
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    .dbg{position:fixed;right:12px;bottom:12px;z-index:900;width:min(430px,calc(100vw - 24px));
      background:rgba(6,6,10,.93);border:1px solid #ff3d1f55;border-radius:10px;color:#e8e3da;
      font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;padding:10px 12px;
      box-shadow:0 20px 60px rgba(0,0,0,.6);backdrop-filter:none}
    .dbg__head{display:flex;justify-content:space-between;align-items:center;
      letter-spacing:.14em;font-size:10px;color:#ff6a45;margin-bottom:6px}
    .dbg__x{color:#e8e3da;font-size:16px;line-height:1;padding:0 2px}
    .dbg__body{margin:0;white-space:pre-wrap;word-break:break-word;color:#cfc9c0}
    .dbg__row{display:flex;gap:8px;margin-top:8px}
    .dbg__row button{border:1px solid #ffffff26;border-radius:6px;padding:4px 8px;
      font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#e8e3da}
    .dbg__row button:hover{border-color:#ff3d1f;color:#ff6a45}
  `;
  document.head.appendChild(style);

  const body = panel.querySelector('.dbg__body');
  const gl = experience.renderer.getContext();
  let frames = 0;
  let lastTime = performance.now();
  let fps = 0;
  let report = 'collecting…';

  let lastSample = 'not sampled';
  let frame = 0;

  const sampleCanvas = () => {
    // read a small patch from the drawing buffer: if everything is identical
    // the canvas is blank (context lost / nothing drawn)
    try {
      const w = 24;
      const h = 24;
      const px = new Uint8Array(w * h * 4);
      const x = Math.floor(gl.drawingBufferWidth / 2 - w / 2);
      const y = Math.floor(gl.drawingBufferHeight / 2 - h / 2);
      gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let min = 255;
      let max = 0;
      for (let i = 0; i < px.length; i += 4) {
        const v = px[i] + px[i + 1] + px[i + 2];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      return max - min > 6 ? `ok (contrast ${max - min})` : `BLANK (contrast ${max - min})`;
    } catch (e) {
      return 'unreadable (' + e.message + ')';
    }
  };

  // must run inside the draw call — the drawing buffer is cleared afterwards
  experience.onAfterRender = () => {
    if (frame++ % 45 !== 0) return;
    lastSample = sampleCanvas();
  };

  const topAtCentre = () => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    if (!el) return 'none';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  };

  const tick = () => {
    frames++;
    const now = performance.now();
    if (now - lastTime > 900) {
      fps = Math.round((frames * 1000) / (now - lastTime));
      frames = 0;
      lastTime = now;
      const info = experience.renderer.info;
      const rep = experience.textureReport || {};
      const lines = [
        `canvas      : ${lastSample}`,
        `context     : ${gl.isContextLost() ? 'LOST' : 'ok'}  losses: ${experience.contextLossCount}`,
        `element@ctr : ${topAtCentre()}`,
        `fps         : ${fps}`,
        `draw calls  : ${info.render.calls}  tris: ${info.render.triangles.toLocaleString()}`,
        `geometries  : ${info.memory.geometries}  textures: ${info.memory.textures}`,
        `pose        : ${experience.scroll.toFixed(2)} / ${experience.poseCount - 1}`,
        `tex budget  : ${rep.totalMB ?? '?'} MB / ${rep.budgetMB ?? '?'} MB (max ${rep.maxTextureSize ?? '?'})`,
        `downscaled  : ${(rep.resized || []).length}`,
        ...(rep.resized || []).slice(0, 4).map((r) => `· ${r.from} → ${r.to}  ${r.prop}`),
        `renderer    : ${(gl.getExtension('WEBGL_debug_renderer_info') && gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)) || 'hidden'}`,
      ];
      report = lines.join('\n');
      body.textContent = report;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  panel.querySelector('.dbg__x').addEventListener('click', () => panel.remove());
  panel.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(report);
      panel.querySelector('[data-act="copy"]').textContent = 'copied ✓';
    } catch {
      console.log(report);
    }
  });
  panel.querySelector('[data-act="redraw"]').addEventListener('click', () => {
    experience.resize();
    if (gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.restoreContext();
  });
}
