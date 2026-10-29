/* ════════════════════════════════════════════
   DORAEMON DINER — boot
   ════════════════════════════════════════════ */
import '@fontsource/archivo-black/400.css';
import '@fontsource-variable/space-grotesk';
import './styles/base.css';
import './styles/sections.css';

import { initScroll, gsap, ScrollTrigger } from './js/scroll.js';
import { Experience } from './js/experience.js';
import {
  initCursor,
  initNav,
  initAnchors,
  initReveals,
  initStatement,
  initCounters,
  initMenu,
  initMarquees,
  initMagnetic,
  initProgress,
  initSceneSync,
} from './js/ui.js';

const $ = (s) => document.querySelector(s);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════ PRELOADER ══════════════ */
function makeLoader() {
  const root = $('#preloader');
  const countEl = $('#load-count');
  const barEl = $('#load-bar');
  const statusEl = $('#load-status');
  const stages = [
    'warming up the kitchen',
    'unpacking the diorama',
    'steaming the ramen',
    'waking the host',
    'setting the tables',
  ];

  let value = 0;
  let shown = 0;
  let finishing = false;

  const paint = () => {
    countEl.textContent = String(Math.round(shown)).padStart(2, '0');
    barEl.style.transform = `scaleX(${shown / 100})`;
    const idx = Math.min(stages.length - 1, Math.floor((shown / 100) * stages.length));
    if (statusEl.textContent !== stages[idx]) statusEl.textContent = stages[idx];
  };
  paint();

  const tick = () => {
    const goal = finishing ? 100 : Math.min(value, 96);
    shown += (goal - shown) * 0.12;
    if (goal - shown < 0.15) shown = goal;
    paint();
    if (shown < 100 || !finishing) raf = requestAnimationFrame(tick);
  };
  let raf = requestAnimationFrame(tick);

  return {
    set(p) {
      value = Math.max(value, Math.min(100, p * 100));
    },
    async done() {
      finishing = true;
      // let the number reach 100 before the curtain
      await new Promise((r) => setTimeout(r, 520));
      await new Promise((r) => {
        const check = () => (shown >= 99.5 ? r() : setTimeout(check, 60));
        check();
      });
      cancelAnimationFrame(raf);
      countEl.textContent = '100';
      barEl.style.transform = 'scaleX(1)';
      return new Promise((resolve) => {
        const tl = gsap.timeline({ onComplete: resolve });
        tl.to('.preloader__center, .preloader__brand, .preloader__tag, .preloader__bottom', {
          y: -30,
          opacity: 0,
          duration: 0.7,
          stagger: 0.05,
          ease: 'power2.inOut',
        }, 0)
          .to(root, {
            yPercent: -100,
            duration: 1.15,
            ease: 'expo.inOut',
            onStart: () => (root.style.pointerEvents = 'none'),
          }, 0.35)
          .set(root, { display: 'none' });
      });
    },
    hideInstant() {
      cancelAnimationFrame(raf);
      root.style.display = 'none';
    },
  };
}

/* ══════════════ INTRO ══════════════ */
function playIntro(heroChars) {
  document.body.classList.remove('is-loading');

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

  tl.fromTo(
    '.header, .rail, .hero__marquee',
    { opacity: 0 },
    { opacity: 1, duration: 1.1, stagger: 0.08 },
    0
  )
    .fromTo(
      heroChars,
      { yPercent: 118, opacity: 0, rotate: 4 },
      { yPercent: 0, opacity: 1, rotate: 0, duration: 1.35, stagger: 0.045 },
      0.05
    )
    .fromTo(
      '.hero__eyebrow',
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 1 },
      0.35
    )
    .fromTo(
      '.hero__sub',
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 1.1 },
      0.5
    )
    .fromTo(
      '.hero__cue',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 1 },
      0.75
    );

  // the webgl canvas eases in from a slight blur/scale
  gsap.fromTo(
    '.webgl',
    { opacity: 0, scale: 1.08, filter: 'blur(14px)' },
    { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.9, ease: 'power2.out' },
    0
  );
  gsap.fromTo(
    '.bg__blob',
    { opacity: 0, scale: 0.7 },
    { opacity: 0.85, scale: 1, duration: 2.2, stagger: 0.2, ease: 'expo.out' },
    0.2
  );

  return tl;
}

/* ══════════════ BOOT ══════════════ */
async function boot() {
  const loader = makeLoader();
  const scroller = initScroll();
  const canvas = $('#webgl');

  // UI first so nothing pops in late
  const heroChars = initReveals();
  initCursor();
  initNav(scroller);
  initAnchors(scroller);
  initStatement();
  initCounters();
  initMarquees();
  initMagnetic();
  initProgress();
  gsap.set('.fig__img', { clipPath: 'inset(0 0 100% 0)' });

  const experience = new Experience(canvas, {
    onProgress: (p) => loader.set(p * 0.92),
  });

  try {
    await experience.init();
  } catch (err) {
    console.error('[diorama] failed to load', err);
    document.body.classList.add('no-webgl');
    loader.set(1);
    loader.hideInstant();
    document.body.classList.remove('is-loading');
    playIntro(heroChars);
    initMenu();
    ScrollTrigger.refresh();
    return;
  }

  loader.set(1);
  initSceneSync(experience);
  initMenu();
  ScrollTrigger.refresh();

  // let the first frame land before the curtain lifts
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  experience.start();
  await new Promise((r) => setTimeout(r, 240));

  await loader.done();
  playIntro(heroChars);
  document.body.classList.remove('is-loading');
  setTimeout(() => ScrollTrigger.refresh(), 600);

  // keep the scroll signal in sync with the 3D scene from the very first frame
  experience.setScroll(0);
}

window.addEventListener('DOMContentLoaded', boot);
