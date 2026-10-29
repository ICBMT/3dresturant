# Doraemon Diner — 3D scrollytelling site

A cinematic one-page site built around `doraemon-resturant.glb`: the restaurant
diorama sits on a floating **blob island**, the camera tours it as you scroll,
and the UI is driven by GSAP + Lenis.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Stack

| Layer | What |
| --- | --- |
| Bundler | Vite (vanilla JS modules) |
| 3D | three.js r186 — `GLTFLoader`, ACES tone mapping, PMREM `RoomEnvironment` |
| Motion | GSAP + ScrollTrigger, Lenis smooth scroll (integrated into the GSAP ticker) |
| Type | Archivo Black (display) + Space Grotesk Variable (body), self-hosted via @fontsource |

## Structure

```
index.html               markup: preloader, nav, 6 sections, footer
src/main.js              boot sequence, preloader, intro timeline
src/js/scroll.js         Lenis ⟷ GSAP ScrollTrigger bridge
src/js/experience.js     three.js scene, GLB placement, camera rig, dust, lights
src/js/island.js         the blob island (extruded organic shape + painted canvas texture)
src/js/ui.js             text splitting, reveals, cursor, nav, pinned horizontal menu,
                         counters, magnetic CTA, scroll→camera pose mapping
src/styles/base.css      tokens, background blobs/grain, preloader, cursor, header, nav
src/styles/sections.css  section layouts + responsive rules
public/images/           generated dish + editorial photography
doraemon-resturant.glb   the original 27 MB asset — served untouched
```

## How the diorama is handled

- The GLB is loaded **as-is** — original geometry, original textures, no
  compression, no downscaling. It is imported through Vite's `?url` so it is
  served byte-identical and never inlined.
- The only mesh that is hidden is the baked-in 32-unit environment sphere
  (`Sphere_Material.017`), because it would seal the model inside a fake sky;
  a real scene, lights and a blob island replace it.
- Bounds are measured at runtime with `Box3`, the diorama is centred, its
  minimum Y is dropped onto the island's top face, and everything is scaled so
  the longest horizontal edge is 12 world units. The island radius is derived
  from the measured footprint, so a different GLB would still fit.
- The host (Doraemon) node is measured in world space after the transform, so
  his close-up pose aims at wherever he actually stands.

## Texture memory (why the model could vanish)

The GLB contains one **8192×8192** JPEG (a backdrop card) plus ~20 smaller maps —
about **500 MB** of VRAM once decoded and mip-mapped. Handing that to the GPU on
the first drawn frame stalls the driver and can drop the WebGL context, which
looks like "the model appears, then the background covers it".

`Experience._budgetTextures()` measures every material map at load time and
halves the largest ones until the total fits **160 MB** (501 MB → ~130 MB here).
Only the *GPU upload size* is capped — `doraemon-resturant.glb` on disk is never
modified and no mesh or UV is touched. The 8K card ends up at 2048², which is
larger than it can ever appear on screen.

| URL flag | Effect |
| --- | --- |
| *(default)* | fit a 160 MB texture budget |
| `?textures=full` | upload every map at native resolution |
| `?textures=low` | 80 MB budget, for weak GPUs |

Other GPU-safety measures: the WebGL canvas is never animated with
`filter` / `transform` / `opacity` (an intro veil above it handles the reveal),
no `backdrop-filter` is used over the canvas, the frame loop is wrapped in a
guard, and `webglcontextlost` / `webglcontextrestored` are handled so a dropped
context recovers instead of leaving a blank canvas.

## Diagnostics

Add `?debug=1` for a live panel: canvas pixel check (blank vs drawn), context
state and loss count, topmost element at the viewport centre, FPS, draw calls,
the applied texture budget and which maps were resized.

## Camera tour

Six keyframes (orbit angle, pitch, distance, look height, fov) live in
`POSES` in `src/js/experience.js`. Scroll position is mapped onto a fractional
pose index by `initSceneSync()` in `src/js/ui.js`; the horizontal menu section
is marked `data-hold`, so the camera holds its pose while the menu track slides.
Pointer parallax, idle drift, a sine bob and damped lerping keep the shot alive
between keys. Narrow screens widen the lens and step back automatically.
