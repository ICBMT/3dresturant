/* ════════════════════════════════════════════
   Smooth scroll engine — Lenis ✕ GSAP ScrollTrigger
   ════════════════════════════════════════════ */
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;

export function initScroll() {
  if (!REDUCED) {
    lenis = new Lenis({
      lerp: 0.095,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      anchors: false,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // keep pin measurements fresh once everything has settled
    lenis.on('resize', () => ScrollTrigger.refresh());
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());

  return {
    lenis,
    scrollTo(target, opts = {}) {
      if (lenis) {
        lenis.scrollTo(target, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
      } else if (typeof target === 'string') {
        document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
      } else if (typeof target === 'number') {
        window.scrollTo({ top: target, behavior: 'smooth' });
      }
    },
    stop() {
      lenis?.stop();
      if (!lenis) document.body.style.overflow = 'hidden';
    },
    start() {
      lenis?.start();
      if (!lenis) document.body.style.overflow = '';
    },
    progress() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? (window.scrollY || document.documentElement.scrollTop) / max : 0;
    },
  };
}

export { gsap, ScrollTrigger, REDUCED };
