// tang.ninja: the build crew. On the first visit of a browser session a crew of labelled agent cursors
// builds the page in front of the visitor. A boot screen, then the hero city is rebuilt the way a
// photogrammetry job rebuilds a real one: control points on the ground, aligned cameras, a point cloud,
// a mesh, textures, the lights. The characters are brought to life through menus (drones scan the
// robot, a painter picks the monster's red, a mechanic sets the punch going), a red-team agent tries
// to break things and the guardrail stops it, and every section below gets its own small job:
// shapes inserted, citations fetched and plotted, ratios checked, papers sorted, journals ranked.
//
// The engine is swarm-build (MIT, ./swarm-build.js, with our changes noted at its top). Everything
// specific to this page is here; the markup is data-swarm-step / data-swarm-act / data-swarm-by in
// home/index.html, the styles are in ./crew.css. Every change the crew makes runs on the engine's
// timeline, so a skipped or fast-forwarded build always lands on the finished page.
import { swarmBuild } from '/swarm/swarm-build.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const fmt = (n) => n.toLocaleString('en-US');
const num = (s) => parseFloat(String(s).replace(/,/g, ''));
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the crew
// In the page's Bauhaus families: yellows plan and survey, reds make things, blues research and
// check, whites run the city, plus the guardrail and the red-team. A name with a number ("planner-2")
// shares the work of its role.
const CREW = {
  planner: '#f6be00', 'planner-2': '#ffd54a', surveyor: '#fff0a8',
  photogrammetrist: '#4d7fe6',
  writer: '#e2321f', 'writer-2': '#ff6f52', painter: '#ffa48f', mechanic: '#ffc9b8',
  stylist: '#ffe58a', 'stylist-2': '#ffcf3d',
  researcher: '#8fb0ff', eval: '#6f95e8', 'eval-2': '#a9c1f5', librarian: '#c4d4fa', historian: '#dbe5fc', 'historian-2': '#b3c7f7',
  retriever: '#f5f5f7', electrician: '#fff6cf', pilot: '#dfe3ea', skipper: '#b8c0cc',
  guardrail: '#8dffb9', 'red-team': '#ff3b3b',
};

// ---------------------------------------------------------------- the crew's tools
// Everything below draws into the region's agent layer (ctx.put) at positions in its coordinates.
const node = (c, cls, html = '') => { const n = c.put(cls); if (html) n.innerHTML = html; return n; };
function place(c, n, x, y) {   // keep a panel inside the view
  const v = c.view(), w = n.offsetWidth, h = n.offsetHeight;
  n.style.left = Math.max(v.x0 + 8, Math.min(x, v.x1 - w - 8)) + 'px';
  n.style.top = Math.max(v.y0 + 8, Math.min(y, v.y1 - h - 8)) + 'px';
}
const center = (c, el, fx = 0.5, fy = 0.5) => () => { const r = c.rel(el); return { x: r.x + r.w * fx, y: r.y + r.h * fy }; };
const here = (ag) => () => ({ x: ag.x, y: ag.y });

function ripple(c, at, p, color) {
  const r = node(c, 'cl-ripple');
  r.style.setProperty('--c', color);
  r.style.opacity = 0;
  c.call(at, () => { const q = p(); r.style.left = q.x + 'px'; r.style.top = q.y + 'px'; });
  c.tween(at, 0.45, 'out', (k) => { r.style.opacity = 1 - k; r.style.transform = `translate(-50%, -50%) scale(${0.3 + k * 1.3})`; });
}

// open a panel where the agent clicks, fading in; returns the time it is open
function open(c, ag, t, n, at, move, say) {
  const color = c.color(ag.id);
  let p0 = null;
  n.style.setProperty('--c', color);
  n.style.opacity = 0;
  n.style.visibility = 'hidden';
  c.glyph(ag, 'arrow', t);
  c.go(ag, () => (p0 = at()), t, move);
  t += move + 0.05;
  ripple(c, t, () => p0, color);
  c.call(t, () => { place(c, n, p0.x + 4, p0.y + 4); n.style.visibility = 'visible'; });
  c.tween(t, 0.16, 'out', (k) => { n.style.opacity = k; n.style.transform = `scale(${0.96 + 0.04 * k})`; });
  if (say) c.log(ag.id, say, t);
  return t + 0.22;
}
const close = (c, t, ...ns) => c.tween(t, 0.16, 'in', (k) => ns.forEach((n) => { if (n) n.style.opacity = 1 - k; }));

// A menu: the agent clicks, runs down the items to the one it wants (into a submenu if asked),
// clicks it, and the menu closes. Items: { label, key, sub, danger } or '-' for a separator.
// Returns { hit, end }: when the item is clicked, and when the menu has gone.
function menu(c, ag, t, { at, title, items, pick, sub, say, move = 0.55 }) {
  const row = (it) => (it === '-' ? '<div class="cl-menu__sep"></div>'
    : `<div class="cl-menu__i${it.danger ? ' danger' : ''}"><span>${esc(it.label)}</span>${it.key ? `<kbd>${esc(it.key)}</kbd>` : it.sub ? '<kbd>▸</kbd>' : ''}</div>`);
  const m = node(c, 'cl-menu', (title ? `<p class="cl-menu__t">${esc(title)}</p>` : '') + items.map(row).join(''));
  t = open(c, ag, t, m, at, move, say);
  const hover = (box, k) => {
    const rows = () => $$('.cl-menu__i', box);
    c.go(ag, () => { const r = c.rel(rows()[k]); return { x: r.x + 26, y: r.y + r.h * 0.62 }; }, t, 0.13);
    c.call(t + 0.09, () => rows().forEach((r, j) => r.classList.toggle('on', j === k)));
  };
  for (let k = 0; k <= pick; k++) { hover(m, k); t += k === pick ? 0.3 : 0.15; }
  let sm = null, last = m, lastPick = pick;
  if (sub) {
    sm = node(c, 'cl-menu', sub.items.map(row).join(''));
    sm.style.setProperty('--c', c.color(ag.id));
    sm.style.opacity = 0;
    sm.style.visibility = 'hidden';
    c.call(t, () => { const pr = c.rel($$('.cl-menu__i', m)[pick]); place(c, sm, pr.x + pr.w + 2, pr.y - 5); sm.style.visibility = 'visible'; });
    c.tween(t, 0.14, 'out', (k) => { sm.style.opacity = k; });
    t += 0.2;
    for (let k = 0; k <= sub.pick; k++) { hover(sm, k); t += k === sub.pick ? 0.32 : 0.16; }
    last = sm;
    lastPick = sub.pick;
  }
  const hit = t;
  c.call(hit, () => $$('.cl-menu__i', last)[lastPick].classList.add('hit'));
  ripple(c, hit, here(ag), c.color(ag.id));
  close(c, hit + 0.34, m, sm);
  return { hit, end: hit + 0.5 };
}

// A swatch palette in Bauhaus shapes: the agent hovers over a few, the last one is picked.
function palette(c, ag, t, { at, title, list, path, say, move = 0.5 }) {
  const n = node(c, 'cl-menu cl-pal', `<p class="cl-menu__t">${esc(title)}</p><div class="cl-pal__row">` +
    list.map((s) => `<i class="cl-pal__${s.shape}" style="--f:${s.color}"></i>`).join('') + '</div><p class="cl-pal__name">&nbsp;</p>');
  t = open(c, ag, t, n, at, move, say);
  const sw = () => $$('.cl-pal__row i', n);
  path.forEach((i, k) => {
    const tt = t + k * 0.5;
    c.go(ag, () => { const r = c.rel(sw()[i]); return { x: r.x + r.w * 0.6, y: r.y + r.h * 0.65 }; }, tt, 0.24);
    c.call(tt + 0.2, () => { sw().forEach((x, j) => x.classList.toggle('on', j === i)); $('.cl-pal__name', n).textContent = list[i].name; });
  });
  const hit = t + path.length * 0.5;
  c.call(hit, () => sw()[path[path.length - 1]].classList.add('hit'));
  ripple(c, hit, here(ag), c.color(ag.id));
  close(c, hit + 0.4, n);
  return hit;
}

// A panel with one switch; returns the moment it is switched on.
function toggle(c, ag, t, { at, title, label, say, move = 0.5 }) {
  const n = node(c, 'cl-menu cl-toggle', `<p class="cl-menu__t">${esc(title)}</p><div class="cl-toggle__row"><span>${esc(label)}</span><b class="cl-switch"></b></div>`);
  t = open(c, ag, t, n, at, move, say);
  const sw = () => $('.cl-switch', n);
  c.go(ag, () => { const r = c.rel(sw()); return { x: r.x + r.w * 0.3, y: r.y + r.h * 0.65 }; }, t, 0.3);
  const hit = t + 0.45;
  c.call(hit, () => sw().classList.add('on'));
  ripple(c, hit, here(ag), c.color(ag.id));
  close(c, hit + 0.7, n);
  return hit;
}

// A small mono note (a request and its answer, a sum); lines appear one after another.
function note(c, t, { at, lines, color, life = 2, step = 0.45 }) {
  const n = node(c, 'cl-note', lines.map((l) => `<p>${l}</p>`).join(''));
  n.style.setProperty('--c', color);
  n.style.opacity = 0;
  const ps = $$('p', n);
  ps.forEach((p) => { p.style.visibility = 'hidden'; });
  c.call(t, () => { const q = at(); place(c, n, q.x, q.y); });
  c.tween(t, 0.2, 'out', (k) => { n.style.opacity = k; });
  ps.forEach((p, i) => c.call(t + i * step, () => { p.style.visibility = 'visible'; }));
  c.tween(t + life, 0.3, 'in', (k) => { n.style.opacity = 1 - k; });
  return n;
}

// A comment from one agent, like a review note; text may be a function read when it appears.
function bubble(c, t, { at, who, text, life = 1.6 }) {
  const n = node(c, 'cl-bubble', `<b style="--c:${c.color(who)}">${esc(who)}</b><p></p>`);
  n.style.opacity = 0;
  c.call(t, () => { $('p', n).textContent = typeof text === 'function' ? text() : text; const q = at(); place(c, n, q.x, q.y); });
  c.tween(t, 0.2, 'out', (k) => { n.style.opacity = k; n.style.transform = `translateY(${(1 - k) * 6}px)`; });
  c.tween(t + life, 0.3, 'in', (k) => { n.style.opacity = 1 - k; });
}

// ---------------------------------------------------------------- the hero scene
const scene = () => $('.scene');
const lay = (n) => $('.scene .layer.l-' + n);
// canvas point (the scene is drawn on a 1600 × 720 canvas) → agent-layer coordinates
function cp(c, x, y) { const r = c.rel(lay('mid')); return { x: r.x + (x / 1600) * r.w, y: r.y + (y / 720) * r.h }; }
// the detection anchors, by label ("monster", "tank", …)
const ANCH = {};
function readAnchors() {
  if (Object.keys(ANCH).length) return;
  const names = new Map($$('.hero .det-more').map((b) => [b.style.getPropertyValue('--i').trim(), b.textContent.replace(/\s+[\d.]+\s*$/, '').trim()]));
  $$('.hero .anchor').forEach((a) => { const k = names.get(a.style.getPropertyValue('--i').trim()); if (k) (ANCH[k] = ANCH[k] || []).push(a); });
}
const anc = (k, i = 0) => (ANCH[k] || [])[i];
const moverOf = (k, i = 0) => { const a = anc(k, i); return a ? a.closest('.mover') : null; };

// The point clouds: each layer's drawing sampled into coloured points (its own colours, a little
// brighter), drawn on one canvas laid over the scene while the crew "reconstructs" it.
const RAMP = [[0, [77, 127, 230]], [0.45, [169, 193, 245]], [0.62, [245, 245, 247]], [0.8, [246, 190, 0]], [1, [226, 50, 31]]];
function ramp(v) {   // elevation 0..1 → blue, white, yellow, red
  for (let k = 1; k < RAMP.length; k++) {
    const [a, ca] = RAMP[k - 1], [b, cb] = RAMP[k];
    if (v <= b) { const f = (v - a) / (b - a); return ca.map((x, i) => Math.round(x + (cb[i] - x) * f)); }
  }
  return RAMP[RAMP.length - 1][1];
}
const Cloud = {
  sets: {}, cv: null, g: null, raf: 0,
  // own = true keeps the drawing's own colours (brightened), otherwise colour by height
  async sample(name, n, sweep, own, seed) {
    const img = $(`.scene .layer.l-${name} > img.art`);
    if (!img) return;
    try { await img.decode(); } catch (e) { if (!img.complete) return; }
    const W = 400, H = 180, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data, idx = [];
    let top = H, bottom = 0;
    for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 150) { idx.push(i); const y = (i / W) | 0; if (y < top) top = y; if (y > bottom) bottom = y; }
    if (!idx.length) return;
    const r = rng(seed), groups = new Map(), q = (v) => Math.min(255, Math.round(v / 24) * 24);
    for (let k = 0; k < n; k++) {
      const i = idx[(r() * idx.length) | 0], px = i % W, py = (i / W) | 0;
      let rgb;
      if (own) { const lift = (v) => v + (255 - v) * 0.35; rgb = [lift(d[i * 4]), lift(d[i * 4 + 1]), lift(d[i * 4 + 2])].map(q); }
      else rgb = ramp(1 - (py - top) / Math.max(1, bottom - top));
      const key = `rgb(${rgb.join(',')})`;
      if (!groups.has(key)) groups.set(key, []);
      const x = (px + r()) / W;
      groups.get(key).push({ x, y: (py + r()) / H, t: sweep ? 0.8 * x + 0.2 * r() : r() });
    }
    this.sets[name] = { groups, pts: [...groups.values()].flat(), show: 0, alpha: 0 };
  },
  load() {
    return Promise.all([['far', 2600, 1, 0, 11], ['mid', 3400, 1, 0, 12], ['monster', 1900, 0, 1, 13], ['robot', 2100, 0, 1, 14],
      ['near', 2600, 1, 0, 15], ['front', 900, 1, 0, 16], ['close', 1100, 1, 0, 17]].map(([nm, k, sw, own, seed]) => this.sample(nm, k, sw, own, seed).catch(() => {})));
  },
  mount() {
    const sc = scene();
    if (this.cv || !sc) return;
    const cv = document.createElement('canvas');
    cv.className = 'cl-cloud';
    cv.setAttribute('aria-hidden', 'true');
    sc.insertBefore(cv, $('.scene .layer.hud'));
    const r = cv.getBoundingClientRect(), dpr = Math.min(1.5, devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    this.cv = cv;
    this.g = cv.getContext('2d');
  },
  set(name, key, v) { const s2 = this.sets[name]; if (!s2) return; s2[key] = v; this.ask(); },
  ask() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); }); },
  draw() {
    const { cv, g } = this;
    if (!cv || !g) return;
    g.clearRect(0, 0, cv.width, cv.height);
    const W = cv.width, H = cv.height, sz = Math.max(2, W / 640);
    for (const set of Object.values(this.sets)) {
      if (!set.alpha || !set.show) continue;
      g.globalAlpha = set.alpha;
      for (const [color, pts] of set.groups) {
        g.fillStyle = color;
        for (const p of pts) if (p.t <= set.show) g.fillRect(p.x * W - sz / 2, p.y * H - sz / 2, sz, sz);
      }
    }
    g.globalAlpha = 1;
  },
  unmount() { cancelAnimationFrame(this.raf); this.raf = 0; if (this.cv) this.cv.remove(); this.cv = null; this.g = null; },
};

const CAM = '<svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true"><path d="M22 9.5 31 5.5v13l-9-4z" fill="#f6be00" stroke="#0b0b0a" stroke-width="1.5" stroke-linejoin="round"/>' +
  '<rect x="1.5" y="5" width="21" height="15" rx="3" fill="#f5f5f7" stroke="#0b0b0a" stroke-width="1.5"/><rect x="5" y="1.5" width="8" height="5" rx="1.5" fill="#f5f5f7" stroke="#0b0b0a" stroke-width="1.5"/>' +
  '<circle cx="12" cy="12.5" r="4.4" fill="#1c4fb8" stroke="#0b0b0a" stroke-width="1.5"/></svg>';
const NS = 'http://www.w3.org/2000/svg';

function gcp(c, t, p, label, out) {
  const n = node(c, 'cl-gcp', `<i></i><span>${esc(label)}</span>`);
  n.style.opacity = 0;
  c.call(t, () => { const q = p(); n.style.left = q.x + 'px'; n.style.top = q.y + 'px'; });
  c.tween(t, 0.3, 'out', (k) => { n.style.opacity = k; n.style.transform = `translate(-50%, -50%) scale(${1.7 - 0.7 * k})`; });
  c.tween(out, 0.4, 'in', (k) => { n.style.opacity = 1 - k; });
}
function flash(c, t, p) {
  const n = node(c, 'cl-flash');
  n.style.opacity = 0;
  c.call(t, () => { const q = p(); n.style.left = q.x + 'px'; n.style.top = q.y + 'px'; });
  c.tween(t, 0.32, 'out', (k) => { n.style.opacity = 1 - k; n.style.transform = `translate(-50%, -50%) scale(${0.4 + k * 1.4})`; });
}
// a light switch that catches: on, off, on, off, on
function flicker(c, t, names) {
  [0, 0.07, 0.15, 0.22, 0.34].forEach((d, i) => c.call(t + d, () => names.forEach((n) => { const L = lay(n); if (L) L.classList.toggle('cl-dark', i % 2 === 1); })));
}

const ACTS = {};

// The city, rebuilt like a photogrammetry job. Times are seconds from the start of the act; the
// name, tagline and index are being typed and framed by other agents at the same time.
ACTS.city = (c) => {
  const sc = scene();
  if (!sc || !lay('mid')) return c.t;
  readAnchors();
  const t0 = c.t, at = (s) => t0 + s;
  const A = (n) => c.agent(n);
  const S = A('surveyor'), G = A('photogrammetrist'), PL = A('planner'), PL2 = A('planner-2'), PI = A('pilot'), SK = A('skipper');
  const PA = A('painter'), ME = A('mechanic'), EL = A('electrician'), EV = A('eval'), RT = A('red-team'), GR = A('guardrail');
  // movers boxed on their own; everything else in a layer is its body, built by the pipeline
  const solo = {
    mid: [moverOf('ferry'), moverOf('boat'), moverOf('helicopter'), moverOf('tank', 0), moverOf('tank', 1), moverOf('tank', 2), moverOf('tank', 3)],
    robot: [moverOf('drone', 0), moverOf('drone', 1)],
    close: [$('.scene .l-close .mover.fx-pan')],
  };
  const body = (n) => { const L = lay(n), skip = (solo[n] || []).filter(Boolean); return L ? [...L.children].filter((x) => !skip.includes(x) && !x.classList.contains('anchor')) : []; };
  const cls = (nodes, add, rm) => nodes.forEach((x) => { if (add) x.classList.add(add); if (rm) x.classList.remove(rm); });
  const BUILT = ['far', 'mid', 'monster', 'robot', 'near', 'front', 'close'];
  const go = (...names) => names.forEach((n) => { const L = lay(n); if (L) L.classList.add('cl-go'); });
  const launch = (ag, m, t, say) => {
    if (!m) return t;
    const d = c.frame(ag, m, t);
    c.call(d, () => { m.classList.remove('cl-hide'); m.classList.add('cl-go'); });
    c.log(ag.id, say, t);
    return d;
  };

  // 0 · the stage: only the night sky and its clouds, everything else waits for the crew
  c.call(at(0), () => {
    sc.classList.add('cl-build');
    BUILT.forEach((n) => { cls(body(n), 'cl-wait'); cls(body(n), 'cl-mesh'); const L = lay(n); if (L) L.classList.add('cl-dark'); });
    Object.values(solo).flat().filter(Boolean).forEach((m) => m.classList.add('cl-hide'));
    c.el.classList.add('sb-built');
    Cloud.mount();
    root.classList.add('cl-clock');
    $$('.hero .clock-h, .hero .clock-m, .hero .clock-s').forEach((h) => { h.style.rotate = '0deg'; });
  });
  // the agents with nothing to build up here wait off stage for the sections
  ['researcher', 'librarian', 'historian', 'historian-2', 'stylist', 'stylist-2', 'eval-2'].forEach((n, i) => {
    const g = A(n);
    if (g && g.id === n) c.go(g, () => { const v = c.view(); return { x: i % 2 ? v.x1 + 80 : v.x0 - 80, y: g.y + 40 }; }, at(0.2 + i * 0.06), 0.8, 'in');
  });
  c.log('photogrammetrist', 'goal: rebuild the city from the air', at(0.05));

  // 1 · surveyor: ground control points on the quay and the pier
  const GCPS = [[262, 690], [652, 606], [1022, 606], [1440, 694]];
  c.log('surveyor', `placing ${GCPS.length} ground control points`, at(0.5));
  GCPS.forEach(([x, y], i) => {
    const tt = at(0.5 + i * 0.62);
    c.glyph(S, 'cross', tt);
    c.go(S, () => cp(c, x, y), tt, 0.46);
    gcp(c, tt + 0.46, () => cp(c, x, y), 'GCP ' + (i + 1), at(6.4));
  });
  c.glyph(S, 'arrow', at(3.1));
  c.log('surveyor', 'control surveyed · RMSE 1.8 cm', at(3.1));
  c.go(S, () => cp(c, 140, 520), at(3.3), 0.9);

  // 2 · photogrammetrist: Workflow ▸ Align Photos…, three cameras, the rays to their tie points
  const WF = [{ label: 'Add Photos…' }, { label: 'Align Photos…' }, { label: 'Build Point Cloud…' }, { label: 'Build Mesh…' },
    { label: 'Build Texture…' }, '-', { label: 'Batch Process…' }];
  const wfAt = () => cp(c, 560, 150);
  let m = menu(c, G, at(0.3), { at: wfAt, title: 'Workflow', items: WF, pick: 1, say: 'Workflow ▸ Align Photos… · 2,481 images' });
  const rays = node(c, 'cl-rays', '<svg width="1" height="1" overflow="visible"></svg>'), svg = rays.firstChild;
  const CAMS = [[330, 70], [800, 40], [1270, 76]];
  const r = rng(5), pool = [...(Cloud.sets.far?.pts || []), ...(Cloud.sets.mid?.pts || [])].filter((p) => p.y < 0.84 && p.x > 0.04 && p.x < 0.96);
  const ties = pool.length ? Array.from({ length: 24 }, () => pool[(r() * pool.length) | 0]) : [];
  const cams = CAMS.map(([x, y]) => { const n = node(c, 'cl-cam', CAM); n.style.opacity = 0; return { x, y, n }; });
  const ta = m.end - 0.1;
  c.log('photogrammetrist', 'matching features across 3 cameras', ta);
  cams.forEach((cam, i) => {
    const tc = ta + i * 0.4;
    c.go(G, () => { const q = cp(c, cam.x, cam.y); return { x: q.x + 18, y: q.y + 14 }; }, tc - 0.3, 0.3);
    c.call(tc, () => { const q = cp(c, cam.x, cam.y); cam.n.style.left = q.x + 'px'; cam.n.style.top = q.y + 'px'; });
    c.tween(tc, 0.25, 'out', (k) => { cam.n.style.opacity = k; cam.n.style.transform = `translate(-50%, -50%) scale(${0.5 + 0.5 * k})`; });
    ties.forEach((p, j) => {
      if ((j + i) % 3 === 2) return;   // each camera sees two thirds of the points, so the views overlap
      const tr = tc + 0.12 + j * 0.03;
      let ln = null, a, b;
      c.call(tr, () => {
        a = cp(c, cam.x, cam.y); b = cp(c, p.x * 1600, p.y * 720);
        ln = document.createElementNS(NS, 'line');
        ['x1', 'x2'].forEach((k) => ln.setAttribute(k, a.x)); ['y1', 'y2'].forEach((k) => ln.setAttribute(k, a.y));
        svg.appendChild(ln);
      });
      c.tween(tr, 0.3, 'out', (k) => { if (ln) { ln.setAttribute('x2', a.x + (b.x - a.x) * k); ln.setAttribute('y2', a.y + (b.y - a.y) * k); } });
      c.call(tr + 0.3, () => { const x = document.createElementNS(NS, 'path'); x.setAttribute('d', `M${b.x - 3} ${b.y - 3}l6 6m0 -6l-6 6`); x.setAttribute('class', 'cl-tie'); svg.appendChild(x); });
    });
  });
  const tn = note(c, ta + 0.2, { at: () => cp(c, 140, 230), color: c.color('photogrammetrist'), life: 2.2, step: 0.5,
    lines: ['<b>align</b> · 3 cameras', '<b>tie points</b> · <span class="cl-n">0</span>', '<b>reprojection error</b> · 0.41 px'] });
  c.tween(ta + 0.5, 1.4, 'out', (k) => { const s = $('.cl-n', tn); if (s) s.textContent = fmt(Math.round(12408 * k)); });

  // 3 · Build Point Cloud…: the far city and the river appear as points, swept left to right
  m = menu(c, G, at(3.6), { at: wfAt, title: 'Workflow', items: WF, pick: 2, say: 'Workflow ▸ Build Point Cloud…', move: 0.3 });
  const td = m.hit + 0.05;
  c.tween(td, 1.8, 'linear', (k) => { Cloud.set('far', 'show', k); Cloud.set('mid', 'show', k); }, () => { Cloud.set('far', 'alpha', 1); Cloud.set('mid', 'alpha', 1); });
  c.tween(td + 0.3, 1.5, 'linear', (k) => { const q = cp(c, 120 + k * 1360, 540); G.set(q.x, q.y); });
  c.log('photogrammetrist', 'dense cloud · far city + river · 4.2 M points', td + 0.1);
  c.tween(td, 0.6, 'in', (k) => { rays.style.opacity = 1 - k; cams.forEach((cam) => { cam.n.style.opacity = 1 - k; }); });

  // 4 · Build Mesh…: grey, untextured; 5 · Build Texture…: colour, and the scenery starts moving
  m = menu(c, G, at(6.65), { at: wfAt, title: 'Workflow', items: WF, pick: 3, say: 'Workflow ▸ Build Mesh…', move: 0.45 });
  c.call(m.hit, () => cls([...body('far'), ...body('mid')], null, 'cl-wait'));
  c.tween(m.hit, 0.8, 'in', (k) => { Cloud.set('far', 'alpha', 1 - k); Cloud.set('mid', 'alpha', 1 - k); });
  c.log('photogrammetrist', 'mesh · 380,512 faces', m.hit + 0.05);
  m = menu(c, G, at(8.65), { at: wfAt, title: 'Workflow', items: WF, pick: 4, say: 'Workflow ▸ Build Texture…', move: 0.3 });
  c.call(m.hit, () => { cls([...body('far'), ...body('mid')], null, 'cl-mesh'); go('far', 'mid', 'clouds'); });
  c.log('photogrammetrist', 'texture · 8,192 px atlas · far city + river', m.hit + 0.05);

  // 6 · electrician: the city's windows
  const on = toggle(c, EL, at(9.8), { at: () => cp(c, 1090, 440), title: 'Lights', label: 'City windows', say: 'switching on the city · 1,284 windows' });
  flicker(c, on, ['far', 'mid']);

  // the monster: boxed, scanned, meshed, then painted
  const mA = anc('monster'), dA = moverOf('drone', 0), dB = moverOf('drone', 1);
  if (mA) {
    const d = c.frame(PL2, mA, at(5.4));
    c.log('planner-2', 'framing the monster · 428 × 548', at(5.0));
    c.tween(d + 0.05, 1.0, 'linear', (k) => Cloud.set('monster', 'show', k), () => Cloud.set('monster', 'alpha', 1));
    c.call(at(7.3), () => cls(body('monster'), null, 'cl-wait'));
    c.tween(at(7.3), 0.7, 'in', (k) => Cloud.set('monster', 'alpha', 1 - k));
    const red = palette(c, PA, at(7.8), { at: center(c, mA, 0.9, 0.28), title: 'Fill · monster', say: 'picking a colour for the monster',
      list: [{ shape: 'circle', color: '#1c4fb8', name: 'Bauhaus blue' }, { shape: 'square', color: '#e2321f', name: 'Bauhaus red' },
        { shape: 'triangle', color: '#f6be00', name: 'Bauhaus yellow' }, { shape: 'square', color: '#1d1d1f', name: 'Ink black' }],
      path: [2, 0, 1] });
    c.call(red, () => { cls(body('monster'), null, 'cl-mesh'); go('monster'); });
    c.log('painter', 'fill → Bauhaus red #E2321F', red);
  }

  // the robot: drones fly round it taking photos, it is rebuilt from them and set going
  launch(PI, dA, at(6.4), 'launching survey drone A');
  launch(PI, dB, at(7.6), 'launching survey drone B');
  c.log('pilot', 'drones photographing the robot · 64 images', at(8.35));
  [0, 1, 2, 3, 4, 5].forEach((k) => { const dm = k % 2 ? dB : dA; if (dm) flash(c, at(8.35 + k * 0.2), center(c, dm, 0.5, 0.55)); });
  c.tween(at(8.4), 1.2, 'linear', (k) => Cloud.set('robot', 'show', k), () => Cloud.set('robot', 'alpha', 1));
  c.call(at(9.65), () => cls(body('robot'), null, 'cl-wait'));
  c.tween(at(9.65), 0.7, 'in', (k) => Cloud.set('robot', 'alpha', 1 - k));
  const rA = anc('robot');
  if (rA) {
    const ctxItems = [{ label: 'Texture' }, { label: 'Rig', sub: true }, { label: 'Animate', sub: true }, '-', { label: 'Delete', key: '⌫', danger: true }];
    let mm = menu(c, ME, at(9.8), { at: center(c, rA, 0.42, 0.5), items: ctxItems, pick: 0, say: 'right-click on the robot ▸ Texture' });
    c.call(mm.hit, () => { cls(body('robot'), null, 'cl-mesh'); go('robot'); });
    mm = menu(c, ME, mm.end + 0.15, { at: center(c, rA, 0.42, 0.5), items: ctxItems, pick: 2, move: 0.3,
      sub: { items: [{ label: 'Idle' }, { label: 'Wave' }, { label: 'Punch', key: 'every 2.4 s' }], pick: 2 }, say: 'Animate ▸ Punch · every 2.4 s' });
    c.call(mm.hit, () => sc.classList.add('cl-punch'));
    c.log('mechanic', 'punch armed · first hit in 1 s', mm.hit + 0.1);
  }

  // the traffic: each vehicle boxed and sent on its way
  launch(SK, moverOf('ferry'), at(10.9), 'ferry casting off');
  launch(PI, moverOf('helicopter'), at(11.8), 'news helicopter airborne');
  launch(SK, moverOf('boat'), at(12.2), 'tug under way');
  [[PL, 12.3], [PL2, 12.6], [PL, 13.5], [PL2, 13.8]].forEach(([g, s], i) => launch(g, moverOf('tank', i), at(s), `tank ${i + 1} onto the quay`));

  // the foreground in one batch, then its lights
  m = menu(c, G, at(10.65), { at: wfAt, title: 'Workflow', items: WF, pick: 5, say: 'Workflow ▸ Batch Process… · near buildings, pier, foreground', move: 0.3 });
  const fg = ['near', 'front', 'close'];
  c.tween(m.hit + 0.05, 1.0, 'linear', (k) => fg.forEach((n) => Cloud.set(n, 'show', k)), () => fg.forEach((n) => Cloud.set(n, 'alpha', 1)));
  c.call(m.hit + 1.1, () => { cls(fg.flatMap(body), null, 'cl-wait'); cls(fg.flatMap(body), null, 'cl-mesh'); go(...fg); });
  c.tween(m.hit + 1.1, 0.6, 'in', (k) => fg.forEach((n) => Cloud.set(n, 'alpha', 1 - k)));
  c.log('photogrammetrist', 'texture · near buildings, pier, foreground', m.hit + 1.15);
  c.go(EL, () => cp(c, 1380, 470), m.hit + 1.0, 0.6);
  flicker(c, m.hit + 1.75, ['near']);
  c.log('electrician', 'near buildings: lights on', m.hit + 1.75);
  launch(PL, $('.scene .l-close .mover.fx-pan'), at(14.8), 'TV camera rolling · REC');

  // the red-team tries to delete the monster; the guardrail stops it and puts it back
  if (mA) {
    const MON = lay('monster');
    c.call(at(12.95), () => { const v = c.view(); RT.set(v.x1 + 60, cp(c, 1300, 260).y); });
    const x = menu(c, RT, at(13.0), { at: center(c, mA, 0.6, 0.42), items: [{ label: 'Copy', key: '⌘C' }, { label: 'Paste', key: '⌘V' }, '-', { label: 'Delete monster', key: '⌫', danger: true }],
      pick: 2, say: 'right-click on the monster ▸ Delete' });
    c.call(x.hit, () => MON.classList.add('cl-glitch'));
    c.log('red-team', 'deleting the monster ⌫', x.hit);
    c.go(GR, center(c, mA, 0.08, 0.06), x.hit - 0.55, 0.5);
    const gb = node(c, 'sb-guard');
    gb.style.opacity = 0;
    const tb = x.hit + 0.3;
    c.call(tb, () => { const b = c.rel(mA); Object.assign(gb.style, { left: b.x - 6 + 'px', top: b.y - 6 + 'px', width: b.w + 12 + 'px', height: b.h + 12 + 'px' }); });
    c.tween(tb, 0.22, 'out', (k) => { gb.style.opacity = k; gb.style.transform = `scale(${1.04 - 0.04 * k})`; });
    const mb = c.rel(mA);
    c.chip('BLOCKED · deleting the monster', c.color('guardrail'), mb.x, mb.y + mb.h + 10, tb + 0.05, 1.6);
    c.log('guardrail', 'blocked · monster restored from snapshot', tb + 0.05);
    c.call(tb, () => c.attacked());
    c.call(tb + 0.3, () => MON.classList.remove('cl-glitch'));
    let shook = 0;
    c.tween(tb + 0.05, 0.3, 'linear', (k) => { const off = k >= 1 ? 0 : Math.sin(k * Math.PI * 6) * 7; RT.set(RT.x - shook + off, RT.y); shook = off; });
    c.go(RT, () => ({ x: c.view().x1 + 90, y: RT.y - 60 }), tb + 0.45, 0.5, 'in');
    c.tween(tb + 1.4, 0.3, 'out', (k) => { gb.style.opacity = 1 - k; });
  }

  // the tower clock reads 12:00; the eval flags it, the mechanic sets it to the visitor's time
  const kA = anc('clock');
  if (kA) {
    c.go(EV, center(c, kA, 0.95, 0.15), at(13.6), 0.5);
    const hhmm = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    bubble(c, at(14.1), { at: () => { const b = c.rel(kA); return { x: b.x + b.w + 10, y: b.y - 34 }; }, who: 'eval', text: () => `The clock reads 12:00. Your time is ${hhmm()}.`, life: 1.8 });
    c.log('eval', 'tower clock reads 12:00 · flagged', at(14.1));
    c.go(ME, center(c, kA, 0.5, 0.5), at(14.3), 0.45);
    c.log('mechanic', 'setting the tower clock to your time', at(14.8));
    const hands = () => $$('.hero .clock-h, .hero .clock-m, .hero .clock-s');
    c.tween(at(14.8), 0.9, 'inOut2', (k) => {
      const d = new Date(), s = d.getSeconds(), mi = d.getMinutes() + s / 60, h = (d.getHours() % 12) + mi / 60;
      const [H, M, S2] = hands();
      if (H) H.style.rotate = (h * 30 * k).toFixed(1) + 'deg';
      if (M) M.style.rotate = (mi * 6 * k).toFixed(1) + 'deg';
      if (S2) S2.style.rotate = (s * 6 * k).toFixed(1) + 'deg';
    });
    c.call(at(15.75), () => root.classList.remove('cl-clock'));
  }
  return at(16);
};

// ---------------------------------------------------------------- the sections

// 01 · each research card gets its Bauhaus shape from the stylist's Insert menu
ACTS.shape = (c) => {
  const s = c.el, card = s.closest('.area'), ag = c.a;
  const k = card.classList.contains('area-p') ? 0 : card.classList.contains('area-r') ? 1 : 2;
  const NAMES = ['Triangle', 'Square', 'Circle'], COLORS = ['yellow', 'red', 'blue'];
  const m = menu(c, ag, c.t, { at: center(c, card, 0.55, 0.16), title: 'Insert shape', move: 0.45,
    items: [{ label: '▲  Triangle', key: '⇧T' }, { label: '■  Square', key: '⇧S' }, { label: '●  Circle', key: '⇧C' }], pick: k,
    say: `Insert ▸ ${NAMES[k]} · Bauhaus ${COLORS[k]}` });
  const t = m.hit + 0.1;
  c.call(t, () => { s.classList.add('sb-built'); s.style.opacity = '0'; });
  c.tween(t, 0.5, 'out', (p) => { s.style.opacity = p; s.style.scale = String(0.55 + 0.45 * p); });
  c.call(t + 0.5, () => { s.style.opacity = ''; s.style.scale = ''; });
  return t + 0.5;
};

// the citation panel: the researcher fetches the profile before the numbers are counted
ACTS.scholar = (c) => {
  const box = c.el, ag = c.a;
  const total = ($('.big-number', box) || {}).textContent || '', h = ($('.stats dd') || {}).textContent || '';
  c.go(ag, center(c, box, 0.35, 0.1), c.t, 0.45);
  c.log(ag.id, 'fetching the Google Scholar profile', c.t + 0.1);
  note(c, c.t + 0.45, { at: () => { const b = c.rel(box); return { x: b.x, y: b.y - 70 }; }, color: c.color(ag.id), life: 2.1, step: 0.75,
    lines: ['<b>GET</b> scholar.google.com/citations?user=Eo3rkZcAAAAJ', `<span class="cl-ok">200 OK</span> · ${esc(total.trim())} citations · h-index ${esc(h.trim())}`] });
  return c.t + 1.5;
};

// the bars: dragged up one year at a time, the number counting with them
ACTS.plot = (c) => {
  const fig = c.el, ag = c.a, bars = $$('.bar', fig);
  const k = innerWidth <= 640 ? 0.4 : 0.48;
  const H = bars.map((b) => num(b.style.getPropertyValue('--v')) * k);
  const V = bars.map((b) => num(($('.bar-value', b) || {}).textContent || '0'));
  let t = c.t;
  c.call(t, () => {
    fig.classList.remove('is-waiting');
    bars.forEach((b) => { const f = $('.bar-fill', b), v = $('.bar-value', b); f.style.transition = 'none'; f.style.height = '4px'; v.dataset.v = v.textContent; v.textContent = '0'; });
  });
  c.log(ag.id, 'plotting citations per year', t + 0.05);
  bars.forEach((b, i) => {
    const f = $('.bar-fill', b), v = $('.bar-value', b), tt = t + 0.45 + i * 0.7;
    c.glyph(ag, 'cross', tt - 0.32);
    c.go(ag, () => { const r = c.rel(f); return { x: r.x + r.w / 2, y: r.y }; }, tt - 0.32, 0.3);
    c.tween(tt, 0.55, 'inOut2', (p) => {
      f.style.height = 4 + (H[i] - 4) * p + 'px';
      v.textContent = fmt(Math.round(V[i] * p));
      const r = c.rel(f); ag.set(r.x + r.w / 2, r.y);
    });
  });
  t += 0.45 + bars.length * 0.7 + 0.1;
  c.call(t, () => bars.forEach((b) => { const f = $('.bar-fill', b), v = $('.bar-value', b); f.style.transition = ''; f.style.height = ''; v.textContent = v.dataset.v; }));
  c.glyph(ag, 'arrow', t);
  return t;
};

// "2 of 4,812": the eval does the sum
const RATIO = /([\d,]+) of (?:about )?([\d,]+)/;
const share = (a, b) => { const p = (a / b) * 100; return (p < 0.1 ? p.toFixed(3) : p.toFixed(2)) + '%'; };
ACTS.ratio = (c) => {
  const sp = c.el, ag = c.a, m = (sp.textContent || '').match(RATIO);
  if (!m) return c.t;
  c.go(ag, center(c, sp, 1, 0.5), c.t, 0.4);
  c.log(ag.id, `checking ${m[1]} of ${m[2]}`, c.t + 0.1);
  const b = c.rel(sp);
  c.chip(`${m[1]} ÷ ${m[2]} = ${share(num(m[1]), num(m[2]))} ✓`, c.color(ag.id), b.x, b.y + b.h + 8, c.t + 0.45, 1.7);
  return c.t + 1.2;
};
ACTS.ratios = (c) => {
  const box = c.el, ag = c.a, ems = $$('.ratio', box);
  let t = c.t;
  c.call(t, () => { box.classList.add('sb-built'); box.style.opacity = '0'; });
  c.tween(t, 0.4, 'out', (p) => { box.style.opacity = p; });
  c.call(t + 0.4, () => { box.style.opacity = ''; });
  c.log(ag.id, `checking ${ems.length} selection ratios`, t + 0.2);
  ems.forEach((em, i) => {
    const m = (em.textContent || '').match(RATIO), tt = t + 0.6 + i * 0.75;
    if (!m) return;
    c.go(ag, center(c, em, 1, 0.5), tt - 0.3, 0.3);
    const b = c.rel(em);
    c.chip(`${m[1]} ÷ ${m[2]} = ${share(num(m[1]), num(m[2]))} ✓`, c.color(ag.id), b.x + b.w + 10, b.y - 3, tt, 1.2);
  });
  return t + 0.6 + ems.length * 0.75;
};

// Shown in a shuffled order first, then put in order one by one, the agent carrying each.
function shuffleSort(c, box, items, ag, t, { say, handle, grid }) {
  const order = items.map((_, i) => i), r = rng(items.length * 31 + 7);
  for (let i = order.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  const off = [];
  c.call(t, () => {
    const rs = items.map((n) => n.getBoundingClientRect());
    if (grid) items.forEach((n, i) => { const to = rs[order[i]]; off[i] = [to.left - rs[i].left, to.top - rs[i].top]; });
    else {
      let y = rs[0].top;
      const slot = [];
      order.forEach((idx) => { slot[idx] = y; y += rs[idx].height; });
      items.forEach((n, i) => { off[i] = [0, slot[i] - rs[i].top]; });
    }
    items.forEach((n, i) => { n.style.transform = `translate(${off[i][0]}px, ${off[i][1]}px)`; });
    box.classList.add('sb-built');
    box.style.opacity = '0';
  });
  c.tween(t, 0.35, 'out', (p) => { box.style.opacity = p; });
  c.call(t + 0.35, () => { box.style.opacity = ''; });
  c.log(ag.id, say, t + 0.1);
  const hop = grid ? 0.26 : 0.36;
  items.forEach((n, i) => {
    const tt = t + 0.6 + i * hop;
    const grab = () => { const b = c.rel(handle(n)); return { x: b.x + 6, y: b.y + b.h * 0.55 }; };
    c.go(ag, grab, tt - 0.22, 0.22);
    c.tween(tt, 0.42, 'inOut2', (p) => {
      if (!off[i]) return;
      n.style.transform = `translate(${off[i][0] * (1 - p)}px, ${off[i][1] * (1 - p)}px)`;
      const q = grab(); ag.set(q.x, q.y);
    });
  });
  const te = t + 0.6 + items.length * hop + 0.45;
  c.call(te, () => items.forEach((n) => { n.style.transform = ''; }));
  return te;
}
ACTS.sortYears = (c) => shuffleSort(c, c.el, $$('.year-group', c.el), c.a, c.t,
  { say: `sorting ${$$('.pub', c.el).length} papers by year, newest first`, handle: (n) => $('.year', n) || n });
ACTS.rank = (c) => {
  const box = c.el, ag = c.a, items = $$('.venue', box), fills = $$('.venue-bar i', box);
  c.call(c.t, () => fills.forEach((f) => { f.dataset.w = f.style.width; f.style.width = '0%'; }));
  let t = shuffleSort(c, box, items, ag, c.t, { say: `ranking ${items.length} venues by impact factor · JCR 2025`, handle: (n) => $('.venue-if', n) || n, grid: true });
  const ev = c.agent('eval');
  if (ev && ev !== ag) c.log(ev.id, 'impact factors checked against JCR 2025', t);
  fills.forEach((f, i) => c.tween(t + i * 0.07, 0.4, 'out', (p) => { f.style.width = num(f.dataset.w) * p + '%'; }));
  t += fills.length * 0.07 + 0.4;
  c.call(t, () => fills.forEach((f) => { f.style.width = f.dataset.w; }));
  return t;
};

// the topic filter, tried once and put back
const press = (b) => $$('.filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
ACTS.filter = (c) => {
  const note2 = c.el, ag = c.a, years = $('#papers .years');
  const btn = $('.filter button[data-filter="p"]'), all = $('.filter button[data-filter="all"]');
  if (!btn || !all || !years) return c.t;
  const color = c.color(ag.id), n = $$('#papers .pub[data-area="p"]').length;
  let t = c.t;
  c.go(ag, center(c, btn, 0.5, 0.62), t, 0.45);
  c.log(ag.id, 'testing the topic filter · Photogrammetry', t + 0.1);
  t += 0.5;
  ripple(c, t, center(c, btn, 0.5, 0.62), color);
  c.call(t, () => { press(btn); years.classList.add('cl-dim'); });
  const b = c.rel(btn);
  c.chip(`${n} photogrammetry papers ✓`, color, b.x, b.y + b.h + 8, t + 0.15, 1.3);
  t += 1.5;
  c.go(ag, center(c, all, 0.5, 0.62), t - 0.35, 0.35);
  ripple(c, t, center(c, all, 0.5, 0.62), color);
  c.call(t, () => { press(all); years.classList.remove('cl-dim'); });
  c.log(ag.id, 'filter back to All', t);
  c.call(t + 0.2, () => { note2.classList.add('sb-built'); note2.style.opacity = ''; });
  return t + 0.3;
};

// the CV: the historian adds each entry, newest first
ACTS.timeline = (c) => {
  const ol = c.el, ag = c.a, lis = [...ol.children];
  let t = c.t;
  c.call(t, () => { lis.forEach((li) => { li.style.opacity = '0'; }); ol.classList.add('sb-built'); ol.style.opacity = ''; });
  lis.forEach((li, i) => {
    const tt = t + 0.3 + i * 0.6, what = ($('.t-what', li) || li).textContent.trim(), when = ($('.t-when', li) || {}).textContent || '';
    c.go(ag, () => { const b = c.rel(li); return { x: b.x + 8, y: b.y + 10 }; }, tt - 0.3, 0.3);
    c.log(ag.id, `adding ${when.trim()} · ${what}`, tt);
    c.tween(tt, 0.4, 'out', (p) => { li.style.opacity = String(p); li.style.transform = `translateY(${(1 - p) * 8}px)`; });
  });
  t += 0.3 + lis.length * 0.6 + 0.2;
  c.call(t, () => lis.forEach((li) => { li.style.opacity = ''; li.style.transform = ''; }));
  return t;
};

// ---------------------------------------------------------------- the boot screen, Skip and replay
const swarm = swarmBuild({
  crew: CREW, acts: ACTS, speed: 1, pace: 1.6, gap: 0.3, traceDots: true,
  onRegionStart: (region) => { if (region.matches('.hero')) { heroBuilding = true; if (skipHero) setTimeout(() => swarm.skip(), 0); } },
  onRegionEnd: (region) => { if (region.matches('.hero')) { heroBuilding = false; finishScene(); skipButton(false); } },
});
let heroBuilding = false, skipHero = false, skipBoot = false;

// the scene back to its own state, whatever happened to the build
function finishScene() {
  const sc = scene();
  if (sc) {
    sc.classList.remove('cl-build', 'cl-punch');
    $$('.cl-wait, .cl-mesh, .cl-hide, .cl-go, .cl-dark, .cl-glitch', sc).forEach((n) => n.classList.remove('cl-wait', 'cl-mesh', 'cl-hide', 'cl-go', 'cl-dark', 'cl-glitch'));
  }
  Cloud.unmount();
  root.classList.remove('cl-clock');
}

let skipEl = null;
function skipButton(on) {
  if (on && !skipEl) {
    skipEl = document.createElement('button');
    skipEl.type = 'button';
    skipEl.className = 'crew-skip';
    skipEl.innerHTML = 'Skip intro <span aria-hidden="true">▸▸</span>';
    skipEl.addEventListener('click', () => { skipBoot = true; skipHero = true; if (heroBuilding) swarm.skip(); skipButton(false); });
    document.body.appendChild(skipEl);
    requestAnimationFrame(() => skipEl && skipEl.classList.add('is-on'));
  } else if (!on && skipEl) {
    const el = skipEl;
    skipEl = null;
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 300);
  }
}

async function boot() {
  const box = $('.crew-boot');
  if (!box) return;
  const log = $('.crew-boot__log', box), title = $('.crew-boot__title', box);
  const LINES = [['mounting survey drive', 'ok'], ['loading 2,481 aerial images', 'ok'], ['target  : tang.ninja'], ['mission : rebuild the city from the air'],
    ['calibrating 3 cameras', 'ok'], ['deploying build agents', String(Object.keys(CREW).length)]];
  const stop = () => { skipBoot = true; };
  const evs = ['keydown', 'pointerdown', 'wheel', 'touchstart'];
  evs.forEach((e) => addEventListener(e, stop, { passive: true }));
  const wait = (ms) => new Promise((res) => setTimeout(res, skipBoot ? 0 : ms));
  let done = '';
  for (const [text, end] of LINES) {
    const line = end ? `> ${text} ${'.'.repeat(Math.max(3, 36 - text.length))} ` : `> ${text}`;
    for (let i = 0; i <= line.length && !skipBoot; i += 4) { log.innerHTML = done + esc(line.slice(0, i)) + '<i></i>'; await wait(14); }
    if (end) await wait(110);
    done += esc(line) + (end ? `<b>${esc(end)}</b>` : '') + '\n';
    log.innerHTML = done + '<i></i>';
    await wait(70);
  }
  title.classList.add('is-on');
  await wait(700);
  box.classList.add('is-out');
  evs.forEach((e) => removeEventListener(e, stop));
  await wait(380);
  box.remove();
}

(async () => {
  // what this screen does not show (the section index on phones) is left out, so no one works on it
  for (const el of $$('[data-swarm-step]')) if (!el.getClientRects().length) el.removeAttribute('data-swarm-step');
  const again = $('.crew-replay');
  if (again) { again.hidden = false; again.addEventListener('click', () => swarm.replay()); }
  if (!swarm.active) { $('.crew-boot')?.remove(); swarm.start(); return; }
  skipButton(true);
  // past the hero while it is still being built: finish it
  addEventListener('scroll', () => { if (heroBuilding && scrollY > innerHeight * 0.5) swarm.skip(); }, { passive: true });
  const clouds = Promise.race([Cloud.load(), new Promise((res) => setTimeout(res, 2500))]);
  await boot();
  await clouds;
  swarm.start();
})();
