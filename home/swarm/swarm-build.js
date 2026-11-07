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
// tang.ninja changes:
// - several agents can share a role: a crew name that starts with a role and a dash ('planner-2')
//   works as that role, and each step goes to whichever of them is free first;
// - frame: data-swarm-box names a part of the element to box (a selector inside it); the box is
//   measured when the planner sets off and follows its target while drawn, so moving things get
//   boxed where they are; a target outside the view is revealed without a box;
// - data-swarm-gap on a region (or the gap option) sets the time between steps (default 0.2 s),
//   data-swarm-fade on a reveal step its fade time (default 0.35 s);
// - the pace option stretches the built-in steps (frame, stream, fetch, count) without slowing the rest;
// - act steps: data-swarm-step="act" data-swarm-act="name" data-swarm-by="agent agent…" runs
//   options.acts[name](ctx), which schedules its own work on the region's timeline with the named
//   agents (crew names or roles; 'historian-2' works as a historian) and returns when it is done.
//   Act elements stay hidden until the act shows them, unless they carry data-swarm-keep;
//   data-swarm-by on a region adds those agents' roles to its crew;
// - data-swarm-attack-why names what the guardrail blocked (default 'prompt injection');
// - the trace pill can show the whole crew as dots, the one speaking lit (traceDots option);
// - the entrance option replaces the opening orbit: entrance(ctx) brings the crew on and returns
//   when the first region's steps may start; ffEvents chooses what fast-forwards a build;
//   ctx.box(rect) turns a viewport rect into the crew layer's coordinates;
// - the arrival option replaces how the crew comes on in the other regions: arrival(ctx, first, late);
// - stop() ends the build for good: the regions being built are finished, every other one shown;
// - regions build in order, and several at once: the next one starts whenever the canStart option says
//   so, canStart(next, building, left), where left(region) is how many seconds that region still has to
//   run (asked again on poke(), when a region ends and when one scrolls into view); an agent still busy in
//   a region being built joins later (late[id], seconds), and ctx.takeOver(id) carries its cursor over;
//   a region is no longer finished when it scrolls out of view; skip() finishes every region building;
// - the planned option is told about each region once it is planned, planned(ctx, { end }), and may
//   return a later end; ctx.wait(el, t) holds the steps in and of el until t;
// - ctx.spawn(id, color) adds an agent to the region's crew while it is planned (a helper the page calls
//   in when the crew is busy), and the waitForCrew option (default true) set to false lets the page decide
//   when an act may start instead of waiting for every agent it names;
// - the crew swims like a school of fish: moves bow to the left of their way (swim(), exported for the
//   page's own flights) and every cursor drags a short fading tail of itself when it moves fast (.sb-ghost).
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
const ROLES = ['planner', 'retriever', 'writer', 'stylist', 'eval', 'guardrail', 'red-team'];
const roleOf = (id) => ROLES.find((r) => id === r || id.startsWith(r + '-')) || id.replace(/-\d+$/, '');
const byOf = (el) => (el.dataset.swarmBy || '').split(/\s+/).filter(Boolean);
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

const GHOST = '<svg width="18" height="22" viewBox="0 0 18 22"><path d="M2 1.5v16.1l4.3-4 2.9 6.6 2.8-1.2-2.8-6.5H15z" fill="var(--c)" stroke="#0b0b0a" stroke-width="1.3" stroke-linejoin="round"/></svg>';
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

// ------------------------------------------------------------------ swimming (tang.ninja)
// The crew moves like a school of fish (the user's wish, after a swarm-build demo): a cursor flying
// further than a short hop bows to the left of where it is going (each agent a little more or less, so a
// school turning together stays loose), with a slight sway on long flights; and every cursor drags a
// short tail of fading copies of itself while it moves fast.
const bowOf = (id) => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 1009; return 0.75 + (h % 51) / 100; };
/** Where agent a is at eased progress e of a flight from (fx, fy) to (tx, ty). */
export function swim(a, fx, fy, tx, ty, e) {
  const dx = tx - fx, dy = ty - fy, L = Math.hypot(dx, dy), x = fx + dx * e, y = fy + dy * e;
  if (L < 110) return { x, y };
  const amp = Math.min(60, (L - 110) * 0.16) * ((a && a.bowK) || 1), w = L > 340 ? Math.min(8, (L - 340) * 0.025) : 0;
  const s = Math.sin(Math.PI * e), lat = amp * s + w * Math.sin(3 * Math.PI * e) * s;
  return { x: x + (dy / L) * lat, y: y - (dx / L) * lat };
}
const Tails = {
  all: new Set(), raf: 0, N: 5, LAG: 24,
  add(a) { this.all.add(a); if (!this.raf) this.raf = requestAnimationFrame((t) => this.tick(t)); },
  at(h, t) {   // where the cursor was at time t (the oldest point we have if t is before it)
    for (let i = h.length - 1; i > 0; i--) {
      const p = h[i - 1], q = h[i];
      if (p.t <= t) { const k = q.t > p.t ? Math.min(1, (t - p.t) / (q.t - p.t)) : 1; return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k }; }
    }
    return h[0];
  },
  tick(now) {
    this.raf = 0;
    for (const a of this.all) {
      if (!a.el.isConnected) { this.all.delete(a); continue; }
      const h = a.hist, last = h[h.length - 1];
      if (!last || last.x !== a.x || last.y !== a.y) {
        // a jump (parked, carried over from another region) is not a swim
        if (last && Math.abs(a.x - last.x) + Math.abs(a.y - last.y) > 320) h.length = 0;
        h.push({ x: a.x, y: a.y, t: now });
      }
      while (h.length > 2 && now - h[1].t > this.N * this.LAG + 60) h.shift();
      const show = !a.gone && a.el.dataset.g === 'arrow' && a.el.style.opacity !== '0' && h.length > 1;
      for (let k = 0; k < this.N; k++) {
        const g = a.ghosts[k];
        let o = 0, x = g._x, y = g._y;
        if (show) {
          const p = this.at(h, now - (k + 1) * this.LAG), d = Math.hypot(p.x - a.x, p.y - a.y);
          if (d > 4) { x = p.x; y = p.y; o = (0.55 - k * 0.09) * Math.min(1, (d - 4) / (16 * (k + 1))); }
        }
        if (o !== g._o || (o && (x !== g._x || y !== g._y))) {
          g._o = o; g._x = x; g._y = y;
          g.style.opacity = o ? o.toFixed(3) : '0';
          if (o) g.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(0.92 - k * 0.08).toFixed(2)})`;
        }
      }
    }
    if (this.all.size) this.raf = requestAnimationFrame((t) => this.tick(t));
  },
};

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
    gap: 0.2,
    pace: 1,
    acts: {},
    traceDots: false,
    entrance: null,
    arrival: null,
    planned: null,
    canStart: null,
    useOf: null,
    waitForCrew: true,
    ffEvents: ['keydown', 'pointerdown', 'wheel', 'touchstart'],
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
  const agentsUsed = new Set();
  let io = null;
  let trace = null, traceTimer = 0, you = null, started = false, stopped = false, attacks = 0;
  const live = new Set();   // the regions being built: { region, agents, tl, seq }
  const extra = {};         // colours of the helpers the page spawns
  let launched = 0;
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
    trace.style.setProperty('--c', o.crew[who] || extra[who] || 'currentColor');
    const dots = o.traceDots ? '<span class="sb-dots">' + Object.keys(o.crew).map((id) => '<i style="--c:' + o.crew[id] + '"' + (id === who ? ' class="on"' : '') + '></i>').join('') + '</span>' : '';
    trace.innerHTML = dots + '<b>' + esc(who) + '</b><span class="sb-trace__sep">▸</span>' + esc(msg);
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
  function plan(region, isFirst, late = {}) {
    const tl = new Timeline(), P = o.pace || 1;
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
      if (stepsOf(el).includes('act')) byOf(el).forEach((n) => need.add(roleOf(n)));
    });
    byOf(region).forEach((n) => need.add(roleOf(n)));
    if (isFirst) Object.keys(o.crew).forEach((id) => need.add(roleOf(id)));
    const A = {}, pool = {};
    const make = (id, color, i) => {
      const el = put('sb-ag');
      el.dataset.g = 'arrow';
      el.style.setProperty('--c', color);
      el.innerHTML = '<div class="sb-ag__in" style="animation-delay:' + (-i * 0.37).toFixed(2) + 's">' + GLYPHS + '<span class="sb-ag__tag">' + esc(id) + '</span></div>';
      const caret = put('sb-caret');
      caret.style.background = color;
      const a = { id, el, caret, x: -999, y: -999, bowK: bowOf(id), hist: [], ghosts: [] };
      for (let k = 0; k < Tails.N; k++) {   // its tail, under it
        const g = div('sb-ghost');
        g.innerHTML = GHOST;
        g.style.setProperty('--c', color);
        el.parentNode.insertBefore(g, el);
        a.ghosts.push(g);
      }
      a.set = (x, y) => { a.x = x; a.y = y; el.style.transform = `translate3d(${x}px,${y}px,0)`; };
      a.set(-9999, -9999);
      Tails.add(a);
      A[id] = a;
      (pool[roleOf(id)] = pool[roleOf(id)] || []).push(a);
      return a;
    };
    Object.keys(o.crew).filter((id) => need.has(roleOf(id))).forEach((id, i) => { make(id, o.crew[id], i); agentsUsed.add(id); });
    const crew = Object.values(A);
    const spawn = (id, color) => {
      if (A[id]) return A[id];
      extra[id] = color;
      const a = make(id, color, crew.length);
      a.helper = true;
      crew.push(a);
      return a;
    };
    const used = {};

    // primitives
    const go = (a, x, y, t, d = 0.45, ease = 'out') => {
      let fx, fy;
      tl.tween(Math.max(0, t), d, ease, (p) => { const s = swim(a, fx, fy, x, y, p); a.set(s.x, s.y); }, () => { fx = a.x; fy = a.y; });
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
      const target = (el.dataset.swarmBox && el.querySelector(el.dataset.swarmBox)) || el, pad = 4, tr = 0.32 * P;
      const s = put('sb-sel');
      s.innerHTML = '<i></i><i></i><i></i><i></i><span class="sb-sel__wh"></span>';
      Object.assign(s.style, { width: 0, height: 0, opacity: 0 });
      const wh = s.lastChild;
      let box = null, fx = 0, fy = 0;
      const measure = () => {
        const r = rel(target), v = view();
        box = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
        box.off = !r.w || !r.h || r.x + r.w < v.x0 || r.x > v.x1 || r.y + r.h < v.y0 || r.y > v.y1;
        s.style.left = box.x + 'px'; s.style.top = box.y + 'px';
        return box;
      };
      glyph(a, 'cross', t - tr);
      tl.tween(Math.max(0, t - tr), tr, 'out', (p) => { if (!box.off) a.set(fx + (box.x - fx) * p, fy + (box.y - fy) * p); },
        () => { measure(); fx = a.x; fy = a.y; });
      tl.tween(t, d, 'inOut2', (p) => {
        const b = measure();
        if (b.off) { s.style.opacity = 0; return; }
        const cw = b.w * p, ch = b.h * p;
        s.style.opacity = 1; s.style.width = cw + 'px'; s.style.height = ch + 'px';
        wh.textContent = Math.round(cw) + ' × ' + Math.round(ch);
        a.set(b.x + cw, b.y + ch);
      });
      const hold = 0.28 * P;
      tl.tween(t + d, hold + 0.27, 'linear', () => { if (box && !box.off) measure(); });   // the box stays on its target until it fades
      tl.tween(t + d + hold, 0.25, 'out', (p) => { s.style.opacity = box && box.off ? 0 : 1 - p; });
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
      log(a.id, 'accent → “' + accent.textContent.trim() + '”', t + 0.05);
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
      const why = el.dataset.swarmAttackWhy || 'prompt injection';
      chip('BLOCKED · ' + why, o.crew.guardrail, first.x - 4, first.y + first.h * 0.92 + 26, tG + 0.05, 1.6);
      log('guardrail', 'blocked ' + why + ' · rolled back', tG + 0.04);
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

    // who is free when, and who does what (tang.ninja: shared roles, acts)
    const free = {}, shown = new Map(), gap = parseFloat(region.dataset.swarmGap) || o.gap;
    const agentOf = (n) => A[n] || pick(roleOf(n));
    const pick = (role) => (pool[role] ? pool[role].reduce((b, x) => ((free[x.id] || 0) < (free[b.id] || 0) ? x : b)) : null);
    // 1. arrival: the first region opens with the crew orbiting the origin
    let start = 0.35;
    const v0 = view();
    if (isFirst && o.entrance) {
      start = +o.entrance(actCtx(region, 0, crew)) || 1.45;
    } else if (isFirst) {
      const anchor = document.querySelector('[data-swarm-origin]') || list[0] || region;
      const b = rel(anchor), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const orbiters = crew.filter((a) => a.id !== 'red-team');
      const R = (innerWidth <= 720 ? 36 : 50) * Math.min(2.6, Math.max(1, orbiters.length / 6)), W = v0.x1 - v0.x0, H = v0.y1 - v0.y0;
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
    } else if (o.arrival) {
      Object.keys(late).forEach((id) => { if (A[id] && late[id] > 0) free[id] = Math.max(free[id] || 0, late[id] + 0.7); });
      o.arrival(actCtx(region, 0, crew), list[0] || region, late);
    } else {
      const first = list[0] ? rel(list[0]) : { x: 0, y: 0, w: 0, h: 0 };
      crew.forEach((a, i) => {
        a.set(i % 2 ? v0.x1 + 50 : v0.x0 - 50, first.y + i * 18);
        go(a, first.x + 20 + i * 40, first.y + first.h + 12 + (i % 2) * 14, 0.02 + i * 0.06, 0.45);
      });
    }

    // tang.ninja: what an act gets to work with
    function actCtx(el, t, who) {
      const ctx = {
        el, t, who, a: who[0], region, layer, shownAt: null, P,
        agent: (n) => agentOf(n) || who[0],
        call: (at, fn) => tl.call(Math.max(0, at), fn),
        tween: (at, d, ease, update, init) => tl.tween(Math.max(0, at), d, ease, update, init),
        // travel to a point given now or by a function read when the move starts (swimming there)
        go: (ag, to, at, d = 0.45, ease = 'out') => {
          let fx, fy, q;
          tl.tween(Math.max(0, at), d, ease, (p) => { if (q) { const s = swim(ag, fx, fy, q.x, q.y, p); ag.set(s.x, s.y); } },
            () => { fx = ag.x; fy = ag.y; q = typeof to === 'function' ? to() : to; });
        },
        follow: (ag, to, at, d) => tl.tween(Math.max(0, at), d, 'linear', () => { const q = to(); if (q) ag.set(q.x, q.y); }),
        glyph: (ag, g, at) => glyph(ag, g, at),
        log: (who2, msg, at) => log(who2, msg, at),
        say, put, rel, view, chip, fade, frame: (ag, node, at, d = 0.42) => frame(ag, node, at, d * P),
        box: (r) => { const g = origin(); return { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height }; },
        crew,
        color: (n) => o.crew[n] || extra[n] || '#fff',
        spawn,
        show: (node, at) => tl.call(Math.max(0, at), () => { node.classList.add('sb-built'); node.style.opacity = ''; }),
        attacked: () => { attacks++; },
        scale: () => tl.scale,
        now: () => tl.t,
        takeOver: (id) => takeOver(id, region),
        wait: (node, at) => shown.set(node, Math.max(shown.get(node) || 0, at)),
      };
      return ctx;
    }

    // 2. the steps, in DOM order; each agent works through its own queue
    const waitFor = (el) => { let t = 0; shown.forEach((at, host) => { if (host !== el && host.contains(el)) t = Math.max(t, at); }); return t; };
    let cursor = start, end = start;
    list.forEach((el) => {
      stepsOf(el).forEach((s) => {
        const role = ROLE[s], a = role ? pick(role) : null;
        let t = Math.max(cursor, waitFor(el), a ? free[a.id] || 0 : 0);
        if (shown.has(el)) t = Math.max(t, shown.get(el));
        let done = t;
        if (s === 'frame' && a) {
          log(a.id, 'frame ' + label(el), t);
          done = frame(a, el, t, 0.42 * P);
          fade(el, done + 0.02, 0.3);
          shown.set(el, done + 0.05);
        } else if (s === 'act') {
          const fn = o.acts && o.acts[el.dataset.swarmAct];
          const who = byOf(el).map(agentOf).filter(Boolean);
          if (!fn) { fade(el, t, 0.35); shown.set(el, t + 0.1); }
          else {
            if (o.waitForCrew !== false) t = Math.max(t, ...who.map((g) => free[g.id] || 0));
            const ctx = actCtx(el, t, who);
            try { done = Math.max(t, +fn(ctx) || t); } catch (err) { console.error('[swarm-build] act', err); done = t; }
            who.forEach((g) => { free[g.id] = Math.max(free[g.id] || 0, done + 0.05); });
            shown.set(el, ctx.shownAt == null ? done : ctx.shownAt);
          }
        } else if (s === 'reveal') {
          fade(el, t, parseFloat(el.dataset.swarmFade) || 0.35);
          shown.set(el, t + 0.1);
        } else if (s === 'fetch' && a) {
          const b = rel(el);
          go(a, b.x + Math.min(b.w, 80) + 8, b.y + b.h * 0.5, t - 0.22, 0.22);
          log(a.id, 'fetched ' + label(el), t);
          scramble(el, t, 0.45 * P);
          done = t + 0.25 * P;
          shown.set(el, t);
        } else if (s === 'count' && a) {
          const b = rel(el);
          go(a, b.x + b.w * 0.6, b.y - 16, t - 0.4, 0.4);
          count(el, t, 0.8 * P);
          chip('✓ verified', o.crew[a.id], b.x + b.w * 0.6 + 16, b.y + 20, t + 0.15, 1.0 * P);
          log(a.id, 'verified ' + label(el), t + 0.1);
          done = t + 0.5 * P;
          shown.set(el, t);
        } else if (s === 'type' && a) {
          const chars = $$('.sb-ch', el);
          if (!chars.length) return;
          log(a.id, 'typing ' + label(el), t);
          tl.call(t, () => el.classList.add('sb-built'));
          done = type(a, chars, t, parseFloat(el.dataset.swarmCps) || (el.matches('h1') ? 36 : 50));
          shown.set(el, t);
          const st = pick('stylist');
          if (st) {
            let ts = Math.max(done + 0.35, free[st.id] || 0);
            $$(ACCENTS, el).forEach((acc) => { ts = restyle(st, acc, ts) + 0.05; });
            free[st.id] = ts;
            done = Math.max(done, ts - 0.4);
          }
          if (el.dataset.swarmAttack) done = attack(el, chars, done + 0.35);
        } else if (s === 'stream' && a) {
          const words = $$('.sb-wd', el);
          if (!words.length) return;
          const b = rel(words[0]), d = Math.min(1.4, 0.018 * words.length + 0.2) * P;
          glyph(a, 'ibeam', t - 0.3);
          go(a, b.x, b.y + b.h * 0.5, t - 0.3, 0.3);
          log(a.id, 'streaming ' + label(el) + ' · ' + words.length + ' tokens', t);
          tl.call(t, () => el.classList.add('sb-built'));
          words.forEach((w, i) => tl.call(t + (i / words.length) * d, () => {
            w.classList.add('on');
            if (i % 4 === 0 || i === words.length - 1) { const r = rel(w); a.set(r.x + r.w + 4, r.y + r.h * 0.5); }
          }));
          glyph(a, 'arrow', t + d + 0.1);
          done = t + d;
          shown.set(el, t);
        }
        if (a) { free[a.id] = done + 0.05; used[a.id] = Math.max(used[a.id] || 0, done); }
        cursor += gap;
        end = Math.max(end, done);
      });
    });

    // tang.ninja: when each agent is last needed here (a region starting meanwhile gets it late), and the
    // page's own last word on the plan (it may add work at the end)
    if (o.planned) end = Math.max(end, +o.planned(actCtx(region, 0, crew), { end }) || 0);
    const last = {};
    crew.forEach((a) => { last[a.id] = Math.max(used[a.id] || 0, o.useOf ? +o.useOf(a) || 0 : 0); });

    // 3. leave, sign, restore
    const tX = end + 0.45;
    tl.call(tX, () => {
      const v = view();
      crew.forEach((a, i) => {
        a.caret.style.display = 'none';
        if (a.gone) return;
        const tx = a.x - v.x0 < (v.x1 - v.x0) / 2 ? v.x0 - 90 : v.x1 + 90, ty = a.y + (Math.random() * 60 - 30);
        const fx = a.x, fy = a.y, t0 = performance.now() + i * 40;
        const fly = (now) => {
          if (a.gone) return;   // taken over on the way out
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
    return { tl, region, finishUp, agents: A, last };
  }

  // ---------------------------------------------------------------- running
  function release(region, withOrphans) {
    const list = $$('[data-swarm-step]', region).concat(withOrphans ? $$('[data-swarm-step]').filter((el) => !el.closest('[data-swarm]')) : []);
    list.forEach((el) => { restore(el); el.classList.remove('sb-split'); el.classList.add('sb-built'); el.style.opacity = ''; });
    $$('[data-swarm-credit]').forEach((c) => { if (withOrphans) c.hidden = true; });
    region.classList.add('swarm-done');
  }
  // tang.ninja: an agent's cursor coming down from a region still being built: where it is now (viewport),
  // or null if no other region has it on screen. Only a region started earlier can give an agent away (so
  // regions started together hand it down in order). The old cursor is put away in the same frame the new
  // one takes its place, and its old region's script no longer moves it.
  function takeOver(id, except) {
    const mine = [...live].find((j) => j.region === except), lim = mine ? mine.seq : Infinity;
    let at = null;
    for (const job of [...live].reverse()) {   // every earlier copy goes; the cursor comes from the latest one on screen
      if (job.region === except || job.seq > lim) continue;
      const a = job.agents[id];
      if (!a || a.gone) continue;
      const g = job.region.getBoundingClientRect(), p = { x: g.left + a.x, y: g.top + a.y };
      if (!at && p.x > -40 && p.x < innerWidth + 40 && p.y > -40 && p.y < innerHeight + 40) at = p;
      a.gone = true;
      a.caret.style.display = 'none';
      a.el.style.opacity = '0';
      a.set = (x, y) => { a.x = x; a.y = y; };
    }
    return at;
  }
  const regionsAll = () => $$('[data-swarm]');
  const begun = (r) => r.dataset.sbBegun === '1' || r.classList.contains('swarm-done');
  // seconds a region being built still has to run, at its current speed
  const leftOf = (r) => {
    const job = [...live].find((j) => j.region === r);
    return job ? Math.max(0, job.tl.dur - job.tl.t) / Math.max(1e-3, job.tl.scale) : 0;
  };
  // the next region in order starts if it is the first, or when the page says it may
  function tryNext() {
    if (stopped || !started) return;
    const rs = regionsAll(), next = rs.find((r) => !begun(r));
    if (!next) return;
    const first = next === rs[0];
    if (first ? !next.dataset.sbSeen : o.canStart && !o.canStart(next, [...live].map((j) => j.region), leftOf)) return;
    launch(next, first);
  }
  function launch(region, isFirst) {
    if (stopped || begun(region)) return;
    region.dataset.sbBegun = '1';
    // whoever is still busy in a region being built comes when free (seconds, in this region's time)
    const late = {};
    live.forEach((job) => Object.keys(job.last).forEach((id) => {
      const a = job.agents[id], r = job.last[id] - job.tl.t;
      if (a && !a.gone && r > 0) late[id] = Math.max(late[id] || 0, (r / job.tl.scale) * (o.speed || 1));
    }));
    let job;
    try { job = plan(region, isFirst, late); } catch (err) { console.error('[swarm-build]', err); release(region, isFirst); tryNext(); return; }
    job.seq = ++launched;
    live.add(job);
    youOn(true);
    if (o.onRegionStart) o.onRegionStart(region);
    const ff = () => { job.tl.scale = Math.max(job.tl.scale, 5); };
    const evs = o.ffEvents;
    evs.forEach((e) => addEventListener(e, ff, { passive: true }));
    job.tl.onDone = () => {
      evs.forEach((e) => removeEventListener(e, ff));
      try { job.finishUp(); } catch (err) { console.error('[swarm-build]', err); release(region, isFirst); }
      live.delete(job);
      if (!live.size) youOn(false);
      if (o.onRegionEnd) o.onRegionEnd(region);
      tryNext();
    };
    job.tl.play();
    tryNext();
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
        entries.forEach((e) => { if (e.isIntersecting) e.target.dataset.sbSeen = '1'; });
        tryNext();
      }, { rootMargin: o.rootMargin, threshold: 0.05 });
      const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
      fonts.then(() => requestAnimationFrame(() => regions.forEach((r) => io.observe(r))));
      return this;
    },
    /** Finish whatever is building right now. */
    skip() { [...live].forEach((job) => job.tl.finish()); },
    /** Ask again whether the next region may start (tang.ninja: on scroll). */
    poke() { tryNext(); },
    /** Finish one region if it is being built. */
    finish(region) { [...live].forEach((job) => { if (job.region === region) job.tl.finish(); }); },
    /** Stop building (tang.ninja): finish the region being built and show all the others as they are. */
    stop() {
      if (stopped) return;
      stopped = true;
      if (!started && active && o.once === 'session') session.set(o.key, '1');
      started = true;
      if (io) io.disconnect();
      [...live].forEach((job) => job.tl.finish());
      $$('[data-swarm]').forEach((r, i) => { if (!r.classList.contains('swarm-done')) release(r, i === 0); });
    },
    get stopped() { return stopped; },
    /** Build again from the top: clears the once-per-session flag and reloads. */
    replay() { session.set(o.key, '0'); local.set(o.key + '-off', '0'); scrollTo(0, 0); location.reload(); },
    /** Persistently turn the effect on or off for this visitor. */
    setEnabled(on) { local.set(o.key + '-off', on ? '0' : '1'); },
  };
}

export default swarmBuild;
