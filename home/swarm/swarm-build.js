// swarm-build.js · v1.0.1 · MIT
// A crew of labelled agent cursors builds your page in front of the visitor:
// boxes drawn with live W × H badges, text typed with an I-beam, accents
// restyled, copy streamed like model output, numbers counted and verified,
// and (optionally) a red-team agent that tries to rewrite a word until the
// guardrail agent blocks it.
//
// Zero dependencies. Content stays in the DOM the whole time; agents only hide
// and reveal it. Layers are aria-hidden, split text is restored when a region
// finishes, reduced motion turns everything off, and any key, click, tap or
// scroll fast-forwards a build.
//
// Inspired by Joel Califa's Swarm (https://github.com/califa/swarm-site).
// Written from scratch; no code from that project.
//
// Markup (see references/api.md):
//   <section data-swarm>                      a region; built when it scrolls into view
//     <h1 data-swarm-step="type"              typed by the writer
//         data-swarm-attack="without>with">   red-team rewrite, blocked by the guardrail
//       Ship it <em>without</em> the breach   <em> / [data-swarm-accent] restyled by the stylist
//     </h1>
//     <div data-swarm-step="frame">           boxed by the planner, then revealed
//     <p data-swarm-step="frame stream">      boxed, then streamed word by word
//     <span data-swarm-step="fetch">          scrambled in by the retriever
//     <b data-swarm-step="count">2.2K</b>     counted up and checked by eval
//   <i data-swarm-origin>                     the crew orbits this before the first build
//   <p data-swarm-credit hidden>Built by {agents} agents while you watched.</p>

const VERSION = '1.0.1';
const DEFAULT_CREW = {
  planner: '#4ee9f5', retriever: '#e7ff52', writer: '#ffb547', stylist: '#ff8fd8',
  eval: '#6aa8ff', guardrail: '#8dffb9', 'red-team': '#ff3b3b',
};
const ROLE = { frame: 'planner', fetch: 'retriever', type: 'writer', stream: 'writer', count: 'eval', reveal: null };
const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%&*+=<>';
const EASE = {
  linear: (p) => p,
  out: (p) => 1 - (1 - p) ** 3,
  in: (p) => p * p * p,
  inOut2: (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
  sine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
};
const OUTLINED = (d) => `<path d="${d}" fill="none" stroke="#0b0b0a" stroke-width="3.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="var(--c)" stroke-width="1.6" stroke-linecap="round"/>`;
const GLYPHS =
  '<svg class="sb-g sb-g--arrow" width="18" height="22" viewBox="0 0 18 22"><path d="M2 1.5v16.1l4.3-4 2.9 6.6 2.8-1.2-2.8-6.5H15z" fill="var(--c)" stroke="#0b0b0a" stroke-width="1.3" stroke-linejoin="round"/></svg>' +
  '<svg class="sb-g sb-g--ibeam" width="12" height="24" viewBox="0 0 12 24">' + OUTLINED('M2.5 2.5h7M6 2.5v19M2.5 21.5h7') + '</svg>' +
  '<svg class="sb-g sb-g--cross" width="22" height="22" viewBox="0 0 22 22">' + OUTLINED('M11 1.5v7M11 13.5v7M1.5 11h7M13.5 11h7') + '</svg>';

const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const store = (s) => ({
  get: (k) => { try { return s().getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { s().setItem(k, v); } catch (e) { /* storage blocked */ } },
});
const local = store(() => localStorage), session = store(() => sessionStorage);
const div = (cls) => { const e = document.createElement('div'); e.className = cls; return e; };
const stepsOf = (el) => (el.dataset.swarmStep || '').split(/\s+/).filter(Boolean);
const textNodes = (el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), out = []; while (w.nextNode()) out.push(w.currentNode); return out; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ACCENTS = 'em, [data-swarm-accent]';

// ------------------------------------------------------------------ timeline
// A tiny scheduler: calls and tweens at absolute times, played on rAF,
// fast-forwardable (scale) and finishable (jump to the end, firing everything in order).
class Timeline {
  constructor() { this.items = []; this.t = 0; this.dur = 0; this.scale = 1; this.raf = 0; this.active = false; this.onDone = null; }
  call(at, fn) { this.items.push({ at, fn }); this.dur = Math.max(this.dur, at); return this; }
  tween(at, d, ease, update, init) {
    this.items.push({ at, d: Math.max(d, 1e-4), ease: EASE[ease] || EASE.out, update, init });
    this.dur = Math.max(this.dur, at + d);
    return this;
  }
  play() {
    this.items.sort((a, b) => a.at - b.at);
    this.active = true;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.seek(this.t + dt * this.scale);
      if (this.t >= this.dur) this.finish(); else this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    return this;
  }
  seek(t) {
    this.t = t;
    for (const it of this.items) {
      if (it.at > t) break;
      if (it.fn) { if (!it.fired) { it.fired = true; it.fn(); } continue; }
      if (it.done) continue;
      if (!it.started) { it.started = true; if (it.init) it.init(); }
      const p = Math.min(1, (t - it.at) / it.d);
      it.update(it.ease(p));
      if (p >= 1) it.done = true;
    }
  }
  finish() {
    if (!this.active) return;
    cancelAnimationFrame(this.raf);
    this.seek(this.dur + 1);
    this.active = false;
    if (this.onDone) this.onDone();
  }
}

// ------------------------------------------------------------------ engine
export function swarmBuild(options = {}) {
  const o = {
    crew: DEFAULT_CREW,
    key: 'swarm-build',
    once: 'session',          // 'session': build once per browser session · 'always': every load
    speed: 1,
    trace: true,
    you: true,
    rootMargin: '0px 0px -20% 0px',
    onRegionStart: null,
    onRegionEnd: null,
    ...options,
  };
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enabled = () => local.get(o.key + '-off') !== '1';
  const seen = () => o.once === 'session' && session.get(o.key) === '1';
  const active = !reduce && enabled() && !seen() && (root.classList.contains('swarm-js') || o.force === true);
  const originals = new Map();
  const queue = [];
  const agentsUsed = new Set();
  let io = null;
  let current = null, trace = null, traceTimer = 0, you = null, firstClaimed = false, started = false, attacks = 0;
  window.__swarmBuild = VERSION;

  // ---------------------------------------------------------------- text helpers
  const remember = (el) => { if (!originals.has(el)) originals.set(el, el.innerHTML); };
  const restore = (el) => { if (originals.has(el)) { el.innerHTML = originals.get(el); originals.delete(el); } };
  function splitChars(el) {
    remember(el);
    textNodes(el).forEach((n) => {
      if (!n.textContent.length) return;
      const f = document.createDocumentFragment();
      for (const c of n.textContent) { const s = document.createElement('span'); s.className = 'sb-ch'; s.textContent = c; f.appendChild(s); }
      n.replaceWith(f);
    });
    $$(ACCENTS, el).forEach((a) => a.classList.add('sb-plain'));
    el.classList.add('sb-split');
  }
  function splitWords(el) {
    remember(el);
    textNodes(el).forEach((n) => {
      const f = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { f.appendChild(document.createTextNode(part)); return; }
        const s = document.createElement('span'); s.className = 'sb-wd'; s.textContent = part; f.appendChild(s);
      });
      n.replaceWith(f);
    });
    el.classList.add('sb-split');
  }
  const label = (el) => el.dataset.swarmLabel || (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList[0] && !el.classList[0].startsWith('sb-') ? '.' + el.classList[0] : ''));

  // ---------------------------------------------------------------- trace + you
  function say(who, msg) {
    if (!o.trace) return;
    if (!trace) {
      trace = div('sb-trace');
      trace.setAttribute('aria-hidden', 'true');
      document.body.appendChild(trace);
    }
    trace.style.setProperty('--c', o.crew[who] || 'currentColor');
    trace.innerHTML = '<b>' + esc(who) + '</b><span class="sb-trace__sep">▸</span>' + esc(msg);
    trace.classList.remove('is-out', 'is-in');
    void trace.offsetWidth;
    trace.classList.add('is-in');
    clearTimeout(traceTimer);
    traceTimer = setTimeout(() => trace && trace.classList.add('is-out'), 2600);
  }
  function youOn(on) {
    if (!o.you || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (!you) {
      you = div('sb-you');
      you.setAttribute('aria-hidden', 'true');
      you.innerHTML = '<span>you</span>';
      document.body.appendChild(you);
      addEventListener('pointermove', (e) => { you.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`; you.classList.add('has-pos'); }, { passive: true });
    }
    you.classList.toggle('is-on', on);
  }

  // ---------------------------------------------------------------- one region
  function plan(region, isFirst) {
    const tl = new Timeline();
    tl.scale = o.speed;
    region.classList.add('sb-host');
    root.classList.add('sb-building');   // off-screen agents must not widen the page (mobile zooms out)
    if (getComputedStyle(region).position === 'static') region.classList.add('sb-rel');
    const layer = div('sb-layer');
    layer.setAttribute('aria-hidden', 'true');
    region.appendChild(layer);
    const origin = () => region.getBoundingClientRect();
    const rel = (el) => { const r = el.getBoundingClientRect(), g = origin(); return { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height }; };
    const view = () => { const g = origin(); return { x0: -g.left, y0: -g.top, x1: innerWidth - g.left, y1: innerHeight - g.top }; };
    const put = (cls) => { const e = div(cls); layer.appendChild(e); return e; };

    // what this region builds, and the crew it needs
    const own = $$('[data-swarm-step]', region).filter((el) => el.closest('[data-swarm]') === region);
    const orphans = isFirst ? $$('[data-swarm-step]').filter((el) => !el.closest('[data-swarm]')) : [];
    const list = [...orphans, ...own];
    const need = new Set();
    list.forEach((el) => {
      stepsOf(el).forEach((s) => ROLE[s] && need.add(ROLE[s]));
      if (stepsOf(el).includes('type') && $$(ACCENTS, el).length) need.add('stylist');
      if (el.dataset.swarmAttack) { need.add('red-team'); need.add('guardrail'); }
    });
    if (isFirst) Object.keys(o.crew).forEach((id) => need.add(id));
    const A = {};
    Object.keys(o.crew).filter((id) => need.has(id)).forEach((id, i) => {
      const el = put('sb-ag');
      el.dataset.g = 'arrow';
      el.style.setProperty('--c', o.crew[id]);
      el.innerHTML = '<div class="sb-ag__in" style="animation-delay:' + (-i * 0.37).toFixed(2) + 's">' + GLYPHS + '<span class="sb-ag__tag">' + esc(id) + '</span></div>';
      const caret = put('sb-caret');
      caret.style.background = o.crew[id];
      const a = { id, el, caret, x: -999, y: -999 };
      a.set = (x, y) => { a.x = x; a.y = y; el.style.transform = `translate3d(${x}px,${y}px,0)`; };
      a.set(-9999, -9999);
      A[id] = a;
      agentsUsed.add(id);
    });
    const crew = Object.values(A);

    // primitives
    const go = (a, x, y, t, d = 0.45, ease = 'out') => {
      let fx, fy;
      tl.tween(Math.max(0, t), d, ease, (p) => a.set(fx + (x - fx) * p, fy + (y - fy) * p), () => { fx = a.x; fy = a.y; });
    };
    const glyph = (a, g, t) => tl.call(Math.max(0, t), () => { a.el.dataset.g = g; });
    const log = (who, msg, t) => tl.call(t, () => say(who, msg));
    const fade = (el, t, d = 0.3) => {
      tl.tween(t, d, 'out', (p) => { el.style.opacity = p; }, () => { el.classList.add('sb-built'); el.style.opacity = 0; });
      tl.call(t + d, () => { el.style.opacity = ''; });
    };
    const caretAt = (a, ch, before) => {
      const r = rel(ch), x = before ? r.x : r.x + r.w;
      Object.assign(a.caret.style, { display: 'block', left: x + 'px', top: (r.y + r.h * 0.14) + 'px', height: (r.h * 0.72) + 'px' });
      a.set(x + 5, r.y + r.h * 0.5);
    };

    function frame(a, el, t, d = 0.42) {
      const b = rel(el), pad = 4, x0 = b.x - pad, y0 = b.y - pad, w = b.w + pad * 2, h = b.h + pad * 2;
      const s = put('sb-sel');
      s.innerHTML = '<i></i><i></i><i></i><i></i><span class="sb-sel__wh"></span>';
      Object.assign(s.style, { left: x0 + 'px', top: y0 + 'px', width: 0, height: 0, opacity: 0 });
      const wh = s.lastChild;
      glyph(a, 'cross', t - 0.32);
      go(a, x0, y0, t - 0.32, 0.32);
      tl.tween(t, d, 'inOut2', (p) => {
        const cw = w * p, ch = h * p;
        s.style.opacity = 1; s.style.width = cw + 'px'; s.style.height = ch + 'px';
        wh.textContent = Math.round(cw) + ' × ' + Math.round(ch);
      });
      go(a, x0 + w, y0 + h, t, d, 'inOut2');
      tl.tween(t + d + 0.28, 0.25, 'out', (p) => { s.style.opacity = 1 - p; });
      glyph(a, 'arrow', t + d + 0.05);
      return t + d;
    }
    function type(a, chars, t, cps) {
      let tt = t;
      const b = rel(chars[0]);
      glyph(a, 'ibeam', t - 0.3);
      go(a, b.x + 4, b.y + b.h * 0.5, t - 0.3, 0.3);
      tl.call(t - 0.02, () => caretAt(a, chars[0], true));
      chars.forEach((ch) => {
        tt += (1 / cps) * (0.55 + Math.random() * 0.9);
        tl.call(tt, () => { ch.classList.add('on'); if (ch.textContent.trim()) caretAt(a, ch); });
      });
      tl.call(tt + 0.12, () => { a.caret.style.display = 'none'; });
      glyph(a, 'arrow', tt + 0.15);
      return tt;
    }
    function restyle(a, accent, t) {
      const chs = $$('.sb-ch', accent);
      if (!chs.length) return t;
      const r0 = rel(chs[0]), r1 = rel(chs[chs.length - 1]);
      const hl = put('sb-hl');
      Object.assign(hl.style, { left: r0.x + 'px', top: (r0.y + r0.h * 0.1) + 'px', height: (r0.h * 0.8) + 'px', width: 0, opacity: 0 });
      glyph(a, 'ibeam', t - 0.3);
      go(a, r0.x, r0.y + r0.h * 0.5, t - 0.3, 0.3);
      tl.tween(t, 0.3, 'inOut2', (p) => { hl.style.opacity = 1; hl.style.width = (r1.x + r1.w - r0.x) * p + 'px'; });
      go(a, r1.x + r1.w, r0.y + r0.h * 0.5, t, 0.3, 'inOut2');
      tl.call(t + 0.4, () => accent.classList.remove('sb-plain'));
      tl.tween(t + 0.42, 0.2, 'out', (p) => { hl.style.opacity = 1 - p; });
      glyph(a, 'arrow', t + 0.45);
      log('stylist', 'accent → “' + accent.textContent.trim() + '”', t + 0.05);
      return t + 0.45;
    }
    function scramble(el, t, d = 0.45) {
      let nodes = [], finals = [];
      tl.tween(t, d, 'linear', (p) => {
        nodes.forEach((n, i) => {
          const f = finals[i], k = Math.floor(p * f.length);
          let s = f.slice(0, k);
          for (let j = k; j < f.length; j++) s += /\s/.test(f[j]) ? f[j] : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
          n.textContent = p >= 1 ? f : s;
        });
      }, () => { el.classList.add('sb-built'); nodes = textNodes(el).filter((n) => n.textContent.trim()); finals = nodes.map((n) => n.textContent); });
    }
    function count(el, t, d = 0.8) {
      let parts = [];
      tl.tween(t, d, 'out', (p) => {
        parts.forEach((q) => { q.n.textContent = p >= 1 ? q.text : q.pre + (q.num * p).toFixed(q.dec) + q.post; });
      }, () => {
        el.classList.add('sb-built');
        parts = textNodes(el).map((n) => {
          const m = n.textContent.match(/^([\s\S]*?)(\d[\d,]*\.?\d*)([\s\S]*)$/);
          return m ? { n, pre: m[1], num: parseFloat(m[2].replace(/,/g, '')), dec: (m[2].split('.')[1] || '').length, post: m[3], text: n.textContent } : null;
        }).filter(Boolean);
      });
    }
    function chip(text, color, x, y, t, life) {
      const c = put('sb-chip');
      c.textContent = text;
      Object.assign(c.style, { background: color, left: x + 'px', top: y + 'px', opacity: 0 });
      tl.tween(t, 0.25, 'out', (p) => { c.style.opacity = p; c.style.transform = `translateY(${6 * (1 - p)}px)`; });
      tl.tween(t + life, 0.3, 'in', (p) => { c.style.opacity = 1 - p; });
    }
    function attack(el, chars, t) {
      const [from = '', to = ''] = el.dataset.swarmAttack.split('>').map((s) => s.trim());
      const text = chars.map((c) => c.textContent).join('');
      const at = from ? text.indexOf(from) : -1;
      const Rd = A['red-team'], Gd = A.guardrail;
      if (at < 0 || !Rd || !Gd) return t;
      attacks++;
      const word = chars.slice(at, at + from.length);
      let k = 0;
      while (k < from.length && k < to.length && from[k] === to[k]) k++;
      const doomed = word.slice(k), first = rel(word[0]), last = rel(word[word.length - 1]), v = view();
      tl.call(Math.max(0, t - 0.01), () => Rd.set(v.x1 + 60, first.y + first.h * 0.5 - 40));
      go(Gd, Math.min(v.x1 - 110, last.x + last.w + 50), first.y - 4, t - 1.2, 0.55);
      go(Rd, last.x + last.w + 5, last.y + last.h * 0.5, t, 0.5);
      glyph(Rd, 'ibeam', t + 0.38);
      log('red-team', 'rewrite “' + from + '” → “' + to + '”', t + 0.3);
      tl.call(t + 0.5, () => caretAt(Rd, word[word.length - 1]));
      let tt = t + 0.62;
      const inserted = [];
      doomed.slice().reverse().forEach((c) => {
        tl.call(tt, () => { c.classList.add('del'); const prev = word[word.indexOf(c) - 1]; if (prev) caretAt(Rd, prev); });
        tt += 0.12;
      });
      to.slice(k).split('').forEach((ch) => {
        tl.call(tt, () => {
          const s = document.createElement('span');
          s.className = 'sb-ch on sb-ins'; s.textContent = ch;
          const anchor = inserted.length ? inserted[inserted.length - 1] : (doomed[doomed.length - 1] || word[word.length - 1]);
          anchor.after(s); inserted.push(s); caretAt(Rd, s);
        });
        tt += 0.1;
      });
      const tG = tt + 0.25;
      const guard = put('sb-guard');
      guard.style.opacity = 0;
      const fit = () => {
        const live = word.filter((c) => !c.classList.contains('del'));
        const a0 = rel(live[0] || inserted[0] || word[0]);
        const z = rel(inserted.length ? inserted[inserted.length - 1] : live[live.length - 1] || word[0]);
        Object.assign(guard.style, { left: (a0.x - 8) + 'px', top: (a0.y + a0.h * 0.04) + 'px', width: Math.max(24, z.x + z.w - a0.x + 16) + 'px', height: (a0.h * 0.92) + 'px' });
      };
      go(Gd, first.x - 4, first.y + first.h * 0.92, tG - 0.3, 0.3);
      tl.call(tG, fit);
      tl.tween(tG, 0.22, 'out', (p) => { guard.style.opacity = p; guard.style.transform = `scale(${1.08 - 0.08 * p})`; });
      chip('BLOCKED · prompt injection', o.crew.guardrail, first.x - 4, first.y + first.h * 0.92 + 26, tG + 0.05, 1.25);
      log('guardrail', 'blocked prompt injection · rolled back', tG + 0.04);
      let shook = 0;
      tl.tween(tG + 0.02, 0.27, 'linear', (p) => { const off = p >= 1 ? 0 : Math.sin(p * Math.PI * 6) * 7; Rd.set(Rd.x - shook + off, Rd.y); shook = off; });
      tl.call(tG + 0.32, () => {
        Rd.caret.style.display = 'none';
        inserted.forEach((s) => s.remove());
        doomed.forEach((c) => { c.classList.remove('del'); c.classList.add('flash'); });
        fit();
      });
      glyph(Rd, 'arrow', tG + 0.32);
      go(Rd, v.x1 + 90, first.y - 60, tG + 0.4, 0.45, 'in');
      tl.call(tG + 1.05, () => doomed.forEach((c) => c.classList.remove('flash')));
      tl.tween(tG + 1.05, 0.3, 'out', (p) => { guard.style.opacity = 1 - p; });
      return tG + 0.55;
    }

    // 1. arrival: the first region opens with the crew orbiting the origin
    let start = 0.35;
    const v0 = view();
    if (isFirst) {
      const anchor = document.querySelector('[data-swarm-origin]') || list[0] || region;
      const b = rel(anchor), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const R = innerWidth <= 720 ? 36 : 50, W = v0.x1 - v0.x0, H = v0.y1 - v0.y0;
      const orbiters = crew.filter((a) => a.id !== 'red-team');
      const seed = put('sb-seed');
      Object.assign(seed.style, { left: cx + 'px', top: cy + 'px', opacity: 0 });
      tl.tween(0, 0.35, 'out', (p) => { seed.style.opacity = p; seed.style.transform = `scale(${p})`; });
      orbiters.forEach((a, i) => {
        const ang = (i / orbiters.length) * Math.PI * 2;
        const from = [[v0.x0 - 50, v0.y0 + H * (0.2 + Math.random() * 0.6)], [v0.x1 + 50, v0.y0 + H * (0.2 + Math.random() * 0.6)], [v0.x0 + W * (0.2 + Math.random() * 0.6), v0.y0 - 50], [v0.x0 + W * (0.2 + Math.random() * 0.6), v0.y1 + 50]][i % 4];
        a.set(from[0], from[1]);
        go(a, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R * 0.62, 0.05 + i * 0.04, 0.6);
      });
      log('orchestrator', 'spawned ' + crew.length + ' agents · goal: build the page', 0.1);
      tl.tween(0.75, 0.6, 'sine', (p) => {
        orbiters.forEach((a, i) => { const ang = (i / orbiters.length) * Math.PI * 2 + p * Math.PI * 0.8; a.set(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R * 0.62); });
      });
      tl.tween(1.4, 0.2, 'out', (p) => { seed.style.opacity = 1 - p; });
      start = 1.45;
    } else {
      const first = list[0] ? rel(list[0]) : { x: 0, y: 0, w: 0, h: 0 };
      crew.forEach((a, i) => {
        a.set(i % 2 ? v0.x1 + 50 : v0.x0 - 50, first.y + i * 18);
        go(a, first.x + 20 + i * 40, first.y + first.h + 12 + (i % 2) * 14, 0.02 + i * 0.06, 0.45);
      });
    }

    // 2. the steps, in DOM order; each agent works through its own queue
    const free = {}, shown = new Map();
    const waitFor = (el) => { let t = 0; shown.forEach((at, host) => { if (host !== el && host.contains(el)) t = Math.max(t, at); }); return t; };
    let cursor = start, end = start;
    list.forEach((el) => {
      stepsOf(el).forEach((s) => {
        const role = ROLE[s], a = role ? A[role] : null;
        let t = Math.max(cursor, waitFor(el), role ? free[role] || 0 : 0);
        if (shown.has(el)) t = Math.max(t, shown.get(el));
        let done = t;
        if (s === 'frame' && a) {
          log('planner', 'frame ' + label(el), t);
          done = frame(a, el, t, 0.42);
          fade(el, done + 0.02, 0.3);
          shown.set(el, done + 0.05);
        } else if (s === 'reveal') {
          fade(el, t, 0.35);
          shown.set(el, t + 0.1);
        } else if (s === 'fetch' && a) {
          const b = rel(el);
          go(a, b.x + Math.min(b.w, 80) + 8, b.y + b.h * 0.5, t - 0.22, 0.22);
          log('retriever', 'fetched ' + label(el), t);
          scramble(el, t, 0.45);
          done = t + 0.25;
          shown.set(el, t);
        } else if (s === 'count' && a) {
          const b = rel(el);
          go(a, b.x + b.w * 0.6, b.y - 16, t - 0.4, 0.4);
          count(el, t, 0.8);
          chip('✓ verified', o.crew.eval, b.x + b.w * 0.6 + 16, b.y + 20, t + 0.15, 1.0);
          log('eval', 'verified ' + label(el), t + 0.1);
          done = t + 0.5;
          shown.set(el, t);
        } else if (s === 'type' && a) {
          const chars = $$('.sb-ch', el);
          if (!chars.length) return;
          log('writer', 'typing ' + label(el), t);
          tl.call(t, () => el.classList.add('sb-built'));
          done = type(a, chars, t, parseFloat(el.dataset.swarmCps) || (el.matches('h1') ? 36 : 50));
          shown.set(el, t);
          const st = A.stylist;
          if (st) {
            let ts = Math.max(done + 0.35, free.stylist || 0);
            $$(ACCENTS, el).forEach((acc) => { ts = restyle(st, acc, ts) + 0.05; });
            free.stylist = ts;
            done = Math.max(done, ts - 0.4);
          }
          if (el.dataset.swarmAttack) done = attack(el, chars, done + 0.35);
        } else if (s === 'stream' && a) {
          const words = $$('.sb-wd', el);
          if (!words.length) return;
          const b = rel(words[0]), d = Math.min(1.4, 0.018 * words.length + 0.2);
          glyph(a, 'ibeam', t - 0.3);
          go(a, b.x, b.y + b.h * 0.5, t - 0.3, 0.3);
          log('writer', 'streaming ' + label(el) + ' · ' + words.length + ' tokens', t);
          tl.call(t, () => el.classList.add('sb-built'));
          words.forEach((w, i) => tl.call(t + (i / words.length) * d, () => {
            w.classList.add('on');
            if (i % 4 === 0 || i === words.length - 1) { const r = rel(w); a.set(r.x + r.w + 4, r.y + r.h * 0.5); }
          }));
          glyph(a, 'arrow', t + d + 0.1);
          done = t + d;
          shown.set(el, t);
        }
        if (role) free[role] = done + 0.05;
        cursor += 0.2;
        end = Math.max(end, done);
      });
    });

    // 3. leave, sign, restore
    const tX = end + 0.45;
    tl.call(tX, () => {
      const v = view();
      crew.forEach((a, i) => {
        a.caret.style.display = 'none';
        const tx = a.x - v.x0 < (v.x1 - v.x0) / 2 ? v.x0 - 90 : v.x1 + 90, ty = a.y + (Math.random() * 60 - 30);
        const fx = a.x, fy = a.y, t0 = performance.now() + i * 40;
        const fly = (now) => {
          const p = Math.max(0, Math.min(1, (now - t0) / 550)), e = EASE.in(p);
          a.set(fx + (tx - fx) * e, fy + (ty - fy) * e);
          a.el.style.opacity = String(1 - e);
          if (p < 1) requestAnimationFrame(fly);
        };
        requestAnimationFrame(fly);
      });
    });
    if (isFirst) {
      $$('[data-swarm-credit]').forEach((c) => {
        tl.call(tX + 0.3, () => {
          c.textContent = c.textContent.replace('{agents}', String(agentsUsed.size)).replace('{attacks}', String(attacks));
          c.hidden = false;
        });
        scramble(c, tX + 0.35, 0.6);
      });
      tl.call(tX + 0.35, () => say('orchestrator', 'done · ' + agentsUsed.size + ' agents' + (attacks ? ' · ' + attacks + (attacks > 1 ? ' attacks' : ' attack') + ' blocked' : '')));
    }
    tl.call(tX + 0.95, () => {});
    const finishUp = () => {
      list.forEach((el) => { restore(el); el.classList.remove('sb-split'); el.classList.add('sb-built'); el.style.opacity = ''; });
      region.classList.add('swarm-done');
      region.classList.remove('sb-host', 'sb-rel');
      setTimeout(() => { layer.remove(); if (!document.querySelector('.sb-layer')) root.classList.remove('sb-building'); }, 900);
    };
    return { tl, region, finishUp };
  }

  // ---------------------------------------------------------------- running
  function release(region, withOrphans) {
    const list = $$('[data-swarm-step]', region).concat(withOrphans ? $$('[data-swarm-step]').filter((el) => !el.closest('[data-swarm]')) : []);
    list.forEach((el) => { restore(el); el.classList.remove('sb-split'); el.classList.add('sb-built'); el.style.opacity = ''; });
    $$('[data-swarm-credit]').forEach((c) => { if (withOrphans) c.hidden = true; });
    region.classList.add('swarm-done');
  }
  function runNext() {
    if (current || !queue.length) return;
    const { region, isFirst } = queue.shift();
    const box = region.getBoundingClientRect();
    if (!isFirst && io && (box.top > innerHeight * 0.85 || box.bottom < 0)) { delete region.dataset.sbQueued; io.observe(region); runNext(); return; }
    let job;
    try { job = plan(region, isFirst); } catch (err) { console.error('[swarm-build]', err); release(region, isFirst); runNext(); return; }
    current = job;
    youOn(true);
    if (o.onRegionStart) o.onRegionStart(region);
    const ff = () => { job.tl.scale = Math.max(job.tl.scale, 5); };
    const evs = ['keydown', 'pointerdown', 'wheel', 'touchstart'];
    evs.forEach((e) => addEventListener(e, ff, { passive: true }));
    const away = new IntersectionObserver(([e]) => { if (!e.isIntersecting && job.tl.active) job.tl.finish(); });
    away.observe(region);
    job.tl.onDone = () => {
      evs.forEach((e) => removeEventListener(e, ff));
      away.disconnect();
      try { job.finishUp(); } catch (err) { console.error('[swarm-build]', err); release(region, isFirst); }
      current = null;
      youOn(false);
      if (o.onRegionEnd) o.onRegionEnd(region);
      runNext();
    };
    job.tl.play();
  }
  function enqueue(region, isFirst) {
    if (region.classList.contains('swarm-done') || region.dataset.sbQueued) return;
    region.dataset.sbQueued = '1';
    queue.push({ region, isFirst });
    runNext();
  }

  return {
    version: VERSION,
    active,
    enabled,
    /** Build every [data-swarm] region: the first one when it is in view, the rest as they scroll in. */
    start() {
      if (started) return this;
      started = true;
      const regions = $$('[data-swarm]');
      if (!active) { regions.forEach((r, i) => release(r, i === 0)); root.classList.remove('swarm-js'); return this; }
      if (o.once === 'session') session.set(o.key, '1');
      regions.forEach((r, i) => {
        $$('[data-swarm-step]', r).concat(i === 0 ? $$('[data-swarm-step]').filter((el) => !el.closest('[data-swarm]')) : []).forEach((el) => {
          if (stepsOf(el).includes('type')) splitChars(el);
          if (stepsOf(el).includes('stream')) splitWords(el);
        });
      });
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const isFirst = e.target === regions[0] && !firstClaimed;
          if (isFirst) firstClaimed = true;
          enqueue(e.target, isFirst);
        });
      }, { rootMargin: o.rootMargin, threshold: 0.05 });
      const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
      fonts.then(() => requestAnimationFrame(() => regions.forEach((r) => io.observe(r))));
      return this;
    },
    /** Finish whatever is building right now. */
    skip() { if (current) current.tl.finish(); },
    /** Build again from the top: clears the once-per-session flag and reloads. */
    replay() { session.set(o.key, '0'); local.set(o.key + '-off', '0'); scrollTo(0, 0); location.reload(); },
    /** Persistently turn the effect on or off for this visitor. */
    setEnabled(on) { local.set(o.key + '-off', on ? '0' : '1'); },
  };
}

export default swarmBuild;
