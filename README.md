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

## Camera tour

Six keyframes (orbit angle, pitch, distance, look height, fov) live in
`POSES` in `src/js/experience.js`. Scroll position is mapped onto a fractional
pose index by `initSceneSync()` in `src/js/ui.js`; the horizontal menu section
is marked `data-hold`, so the camera holds its pose while the menu track slides.
Pointer parallax, idle drift, a sine bob and damped lerping keep the shot alive
between keys. Narrow screens widen the lens and step back automatically.
