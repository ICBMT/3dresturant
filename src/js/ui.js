/* ════════════════════════════════════════════
   UI + motion layer — splits, reveals, cursor,
   nav, horizontal menu, counters, magnetic cta
   ════════════════════════════════════════════ */
import { gsap, ScrollTrigger } from './scroll.js';

const isTouch = window.matchMedia('(hover: none)').matches;

/* ── tiny helpers ─────────────────────────── */
function splitChars(el) {
  if (!el || el.dataset.split === 'done') return [];
  const text = el.textContent;
  el.textContent = '';
  const chars = [...text].map((ch) => {
    if (ch === ' ') {
      const sp = document.createElement('span');
      sp.className = 'char char--space';
      sp.innerHTML = '&nbsp;';
      el.appendChild(sp);
      return sp;
    }
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch;
    el.appendChild(span);
    return span;
  });
  el.dataset.split = 'done';
  return chars;
}

function splitNavLinks() {
  document.querySelectorAll('[data-split]').forEach((el) => splitChars(el));
}

/* ══════════════ CURSOR ══════════════ */
export function initCursor() {
  if (isTouch) return;
  const ring = document.querySelector('.cursor__ring');
  const dot = document.querySelector('.cursor__dot');
  const label = document.querySelector('.cursor__label');
  const cursor = document.getElementById('cursor');
  if (!cursor) return;

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const target = { ...pos };

  window.addEventListener('pointermove', (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
    if (!cursor.classList.contains('is-visible')) cursor.classList.add('is-visible');
  });

  gsap.ticker.add(() => {
    pos.x += (target.x - pos.x) * 0.16;
    pos.y += (target.y - pos.y) * 0.16;
    gsap.set(dot, { x: target.x, y: target.y });
    gsap.set(ring, { x: pos.x, y: pos.y });
  });

  const hoverables = document.querySelectorAll(
    'a, button, [data-cursor], .card, .stat, .fig'
  );
  hoverables.forEach((el) => {
    el.addEventListener('pointerenter', () => {
      const custom = el.dataset.cursor;
      label.textContent = custom && custom !== 'top' && custom !== '↗' ? custom : '';
      cursor.classList.add('is-hover');
      cursor.classList.toggle('has-label', !!label.textContent);
    });
    el.addEventListener('pointerleave', () => {
      cursor.classList.remove('is-hover');
      cursor.classList.remove('has-label');
    });
  });
}

/* ══════════════ NAV ══════════════ */
export function initNav(scroller) {
  const nav = document.getElementById('nav');
  const openBtn = document.getElementById('menu-btn');
  const closeBtn = document.getElementById('nav-close');
  const bg = nav?.querySelector('.nav__bg');
  const items = nav ? [...nav.querySelectorAll('.nav__list a')] : [];
  let open = false;

  splitNavLinks();

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.inOut' } });
  tl.set(nav, { visibility: 'visible' })
    .to(bg, { scaleY: 1, duration: 0.85 }, 0)
    .fromTo(
      items,
      { yPercent: 120, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.06, ease: 'expo.out' },
      0.28
    )
    .fromTo(
      nav.querySelectorAll('.nav__foot > *'),
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: 'power2.out' },
      0.42
    )
    .fromTo(nav.querySelector('.nav__close'), { opacity: 0, rotate: -90 }, { opacity: 1, rotate: 0, duration: 0.6 }, 0.3);

  const openNav = () => {
    if (open) return;
    open = true;
    nav.setAttribute('aria-hidden', 'false');
    scroller.stop();
    tl.play();
  };
  const closeNav = () => {
    if (!open) return;
    open = false;
    nav.setAttribute('aria-hidden', 'true');
    scroller.start();
    tl.reverse();
  };

  openBtn?.addEventListener('click', openNav);
  closeBtn?.addEventListener('click', closeNav);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeNav());

  nav?.querySelectorAll('[data-scroll-to]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const sel = a.dataset.scrollTo;
      closeNav();
      setTimeout(() => scroller.scrollTo(sel, { duration: 1.8 }), 260);
    });
  });

  return { openNav, closeNav, isOpen: () => open };
}

/* ══════════════ ANCHOR SCROLLING ══════════════ */
export function initAnchors(scroller) {
  document.querySelectorAll('[data-scroll-to]').forEach((el) => {
    if (el.closest('.nav')) return;
    el.addEventListener('click', (e) => {
      const sel = el.dataset.scrollTo;
      if (!sel) return;
      e.preventDefault();
      scroller.scrollTo(sel, { offset: 0, duration: 1.8 });
    });
  });
}

/* ══════════════ REVEALS ══════════════ */
export function initReveals() {
  // generic fade-ups
  document.querySelectorAll('.reveal-up').forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 38 },
      {
        opacity: 1,
        y: 0,
        duration: 1.05,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      }
    );
  });

  // section headings — masked lines
  document.querySelectorAll('.sec-head__title .line-mask > span').forEach((el) => {
    gsap.to(el, {
      yPercent: 0,
      duration: 1.3,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    });
  });

  // hero title characters
  const heroChars = document.querySelectorAll('.hero__title [data-split-chars]');
  const allChars = [];
  heroChars.forEach((el) => allChars.push(...splitChars(el)));

  // images: clip reveal + slow zoom-out
  document.querySelectorAll('.fig__img').forEach((box) => {
    const img = box.querySelector('img');
    gsap
      .timeline({
        scrollTrigger: { trigger: box, start: 'top 88%', once: true },
      })
      .to(box, { clipPath: 'inset(0 0 0% 0)', duration: 1.5, ease: 'expo.inOut' })
      .to(img, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0);
  });

  // parallax figures
  if (!isTouch) {
    document.querySelectorAll('[data-parallax]').forEach((el) => {
      const amt = parseFloat(el.dataset.parallax) || 0;
      gsap.fromTo(
        el,
        { yPercent: -amt * 0.5 },
        {
          yPercent: amt * 0.5,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        }
      );
    });
    // webgl canvas drifts slower than the page
    gsap.fromTo(
      '.webgl',
      { yPercent: 0 },
      { yPercent: -3, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true } }
    );
  }

  return allChars;
}

/* ══════════════ STATEMENT WORDS ══════════════ */
export function initStatement() {
  const words = document.querySelectorAll('.statement__text .w');
  if (!words.length) return;
  gsap.set(words, { opacity: 0.12, y: 12 });
  gsap.to(words, {
    opacity: 1,
    y: 0,
    stagger: 0.09,
    ease: 'none',
    scrollTrigger: {
      trigger: '.statement__text',
      start: 'top 78%',
      end: 'bottom 46%',
      scrub: 0.8,
    },
  });
}

/* ══════════════ COUNTERS ══════════════ */
export function initCounters() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const isFloat = !Number.isInteger(end);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: end,
      duration: 2.2,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = isFloat
          ? obj.v.toFixed(1)
          : Math.round(obj.v).toLocaleString('en-US');
      },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

/* ══════════════ HORIZONTAL MENU ══════════════ */
export function initMenu() {
  const pin = document.querySelector('.menu__pin');
  const track = document.getElementById('menu-track');
  if (!pin || !track) return;

  const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth + 40);

  const tween = gsap.to(track, {
    x: () => -getDistance(),
    ease: 'none',
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => '+=' + (getDistance() + window.innerHeight * 0.55),
      pin: true,
      scrub: 0.65,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // each card drifts / tilts slightly against the track for depth
  const cards = gsap.utils.toArray('.card');
  cards.forEach((card, i) => {
    gsap.fromTo(
      card,
      { rotate: (i % 2 ? 1.4 : -1.4), y: i % 3 === 0 ? 26 : 0 },
      {
        rotate: 0,
        y: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: () => '+=' + (getDistance() + window.innerHeight * 0.55),
          scrub: 1,
        },
      }
    );
  });

  return tween;
}

/* ══════════════ MARQUEES (speed/skew on scroll) ══════════════ */
export function initMarquees() {
  document.querySelectorAll('.marquee').forEach((m) => {
    const speed = parseFloat(m.dataset.speed) || 26;
    m.style.setProperty('--marquee-speed', speed + 's');
  });
  // hero title skews with scroll velocity
  const hero = document.querySelector('.hero__title');
  if (hero && !isTouch) {
    ScrollTrigger.create({
      trigger: document.body,
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const v = self.getVelocity() / 3000;
        if (Math.abs(v) > 0.02) {
          gsap.to(hero, {
            skewY: gsap.utils.clamp(-6, 6, v),
            scaleX: 1 + Math.min(Math.abs(v) * 0.02, 0.05),
            duration: 0.45,
            overwrite: 'auto',
            ease: 'power2.out',
            onComplete: () => gsap.to(hero, { skewY: 0, scaleX: 1, duration: 0.8, ease: 'elastic.out(1,0.6)' }),
          });
        }
      },
    });
  }
}

/* ══════════════ MAGNETIC ══════════════ */
export function initMagnetic() {
  if (isTouch) return;
  document.querySelectorAll('.magnetic').forEach((el) => {
    const strength = 26;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.6, ease: 'power3.out' });
      gsap.to(el.querySelector('.visit__cta-in'), { x: x * 8, y: y * 8, duration: 0.6, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,0.4)' });
      gsap.to(el.querySelector('.visit__cta-in') || el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,0.4)' });
    });
  });
}

/* ══════════════ RAILS / PROGRESS ══════════════ */
export function initProgress() {
  const out = document.getElementById('rail-progress');
  if (!out) return;
  const set = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.round((window.scrollY / max) * 100) : 0;
    out.textContent = `scroll to explore — ${String(p).padStart(2, '0')}%`;
  };
  window.addEventListener('scroll', set, { passive: true });
  set();
}

/* ══════════════ SECTION SCENE SYNC ══════════════ */
export function initSceneSync(experience) {
  const sections = [...document.querySelectorAll('[data-scene]')];
  if (!sections.length) return;

  // scroll-position → pose-index keys. Sections that pin horizontal content
  // emit two keys so the camera holds while the track slides.
  let keys = [];

  const measure = () => {
    const vh = window.innerHeight;
    keys = [];
    sections.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      if (el.hasAttribute('data-hold')) {
        keys.push({ y: top + vh * 0.4, pose: i });
        keys.push({ y: top + r.height - vh * 0.6, pose: i });
      } else {
        keys.push({ y: top + r.height * 0.5, pose: i });
      }
    });
    // first key always at the very top
    if (keys.length) keys[0].y = 0;
    // keep keys strictly increasing
    for (let i = 1; i < keys.length; i++) {
      if (keys[i].y <= keys[i - 1].y) keys[i].y = keys[i - 1].y + 1;
    }
  };

  const update = () => {
    if (!keys.length) return;
    const y = (window.scrollY || document.documentElement.scrollTop) + window.innerHeight * 0.5;
    let f = keys[keys.length - 1].pose;
    if (y <= keys[0].y) {
      f = keys[0].pose;
    } else {
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        if (y >= a.y && y <= b.y) {
          const t = (y - a.y) / Math.max(1, b.y - a.y);
          const e = t * t * (3 - 2 * t);
          f = a.pose + (b.pose - a.pose) * e;
          break;
        }
      }
    }
    experience.setScroll(f);
  };

  measure();
  update();
  ScrollTrigger.addEventListener('refresh', () => {
    measure();
    update();
  });
  window.addEventListener('resize', measure);
  window.addEventListener('load', () => {
    measure();
    update();
  });
  gsap.ticker.add(update);
}
