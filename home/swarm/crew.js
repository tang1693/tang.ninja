// tang.ninja: the build crew. On the first visit of a browser session a cast of labelled agent cursors
// builds the page in front of the visitor, each with a job and a mind of its own. A boot terminal calls
// the roll and sends each one out to work. The hero city is rebuilt like a photogrammetry job (control
// points, aligned cameras, a point cloud, a mesh, textures, lights) and its characters are brought to
// life through menus. The rest of the page is built where the visitor is, a part at a time, never more
// than 1.3 screens at once; every part is first drawn as a wireframe (pencil boxes with their sizes, grey
// bars for the text), inked and painted, then filled in: text typed, reviewed, revised and typed again,
// numbers counted and checked; a red-team agent keeps trying to break things and someone always puts
// them right; at the end the blocks are snapped to the grid and the wireframe erased. The crew spreads
// over the floor, moves on as it frees up, and nobody stands about with nothing to do.
//
// The engine is swarm-build (MIT, ./swarm-build.js, with our changes listed at its top). Everything
// specific to this page is here; the markup is data-swarm-step / data-swarm-act / data-swarm-by /
// data-swarm-story in home/index.html, the styles are in ./crew.css. Every change the crew makes runs on
// the engine's timeline, so a skipped or fast-forwarded build always lands on the finished page.
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
const textsOf = (el) => {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), out = [];
  while (w.nextNode()) if (w.currentNode.data.trim()) out.push(w.currentNode);
  return out;
};
const show = (el) => { el.classList.add('sb-built'); el.style.opacity = ''; };

// ---------------------------------------------------------------- the crew
// In the page's Bauhaus families: reds write, yellows plan, blues research and check, whites run the
// city, plus the guardrail and the red-team. A name with a number shares the work of its role.
const CREW = {
  writer: '#e2321f', 'writer-2': '#ff6f52', 'writer-3': '#ff9a85', editor: '#ffd1c4',
  retriever: '#f5f5f7', planner: '#f6be00', 'planner-2': '#ffd54a', surveyor: '#fff0a8',
  photogrammetrist: '#4d7fe6', eval: '#6f95e8', 'eval-2': '#a9c1f5', researcher: '#8fb0ff',
  librarian: '#c4d4fa', historian: '#dbe5fc', 'historian-2': '#b3c7f7',
  painter: '#ffa48f', mechanic: '#ffc9b8', stylist: '#ffe58a', 'stylist-2': '#ffcf3d',
  electrician: '#fff6cf', pilot: '#dfe3ea', skipper: '#b8c0cc',
  guardrail: '#8dffb9', 'red-team': '#ff3b3b',
};
// what each one does, as the boot screen lists them
const JOBS = {
  writer: 'copy', 'writer-2': 'copy', 'writer-3': 'copy', editor: 'edits', retriever: 'lookups', planner: 'layout',
  'planner-2': 'layout', surveyor: 'ground control', photogrammetrist: '3D', eval: 'checks', 'eval-2': 'charts',
  researcher: 'sources', librarian: 'order', historian: 'CV', 'historian-2': 'CV', painter: 'colour', mechanic: 'rigging',
  stylist: 'shapes', 'stylist-2': 'shapes', electrician: 'lights', pilot: 'drones', skipper: 'boats', guardrail: 'safety',
  'red-team': '???',
};
// the region's own agent of that name, or the act's first one; if that agent is busy when the act starts,
// a helper of its trade stands in for it for the whole act (helperFor, below)
const agentIn = (c) => (n) => {
  if (c.sub && c.sub.has(n)) return c.sub.get(n);
  const ag = c.crew.find((a) => a.id === n) || c.a;
  if (ag && ag.id === n && c.t != null && busyAt(ag, c.t)) {
    const h = helperFor(c, ag, c.t);
    if (h) { (c.sub = c.sub || new Map()).set(n, h); return h; }
  }
  return ag;
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
  const by = (c.sub && c.sub.get(who)) || c.crew.find((a) => a.id === who);
  if (by) who = by.id;
  span(by, t, t + life);
  const n = node(c, 'cl-bubble', `<b style="--c:${c.color(who)}">${esc(who)}</b><p></p>`);
  n.style.opacity = 0;
  c.call(t, () => { $('p', n).textContent = typeof text === 'function' ? text() : text; const q = at(); place(c, n, q.x, q.y); });
  c.tween(t, 0.2, 'out', (k) => { n.style.opacity = k; n.style.transform = `translateY(${(1 - k) * 6}px)`; });
  c.tween(t + life, 0.3, 'in', (k) => { n.style.opacity = 1 - k; });
}


// What an agent is thinking, in a small bubble that rides along with it.
function think(c, ag, t, text, life = 1.8) {
  if (!ag) return;
  use(ag, t + life);
  span(ag, t, t + life);
  const n = node(c, 'cl-think', esc(text));
  n.style.setProperty('--c', c.color(ag.id));
  n.style.opacity = 0;
  let w = 0;
  c.tween(t, life, 'linear', (k) => {
    if (!w) w = n.offsetWidth || 120;
    const v = c.view(), flip = ag.x + 16 + w > v.x1 - 8;   // near the right edge: think on the left
    n.classList.toggle('is-left', flip);
    n.style.left = Math.max(v.x0 + 6, flip ? ag.x - 10 - w : ag.x + 16) + 'px';
    n.style.top = Math.max(v.y0 + 6, ag.y - 36) + 'px';
    const away = ag.x < v.x0 || ag.x > v.x1 || ag.y < v.y0 || ag.y > v.y1;   // no thought without its thinker
    n.style.opacity = ag.gone || away ? '0' : String(Math.max(0, Math.min(1, (k * life) / 0.15, ((1 - k) * life) / 0.25)));
  });
}

// Layout guides in magenta along the edges the items share, with the gaps between neighbours measured.
function gapTag(a, b, m, gap, dir) {
  const v = Math.round(gap), mid = (a + b) / 2;
  return dir === 'h'
    ? `<line class="g" x1="${a}" y1="${m}" x2="${b}" y2="${m}"/><rect x="${mid - 13}" y="${m - 9}" width="26" height="18" rx="3"/><text x="${mid}" y="${m + 4}">${v}</text>`
    : `<line class="g" x1="${m}" y1="${a}" x2="${m}" y2="${b}"/><rect x="${m - 13}" y="${mid - 9}" width="26" height="18" rx="3"/><text x="${m}" y="${mid + 4}">${v}</text>`;
}
function guides(c, t, items, life = 1.5) {
  const g = node(c, 'cl-guides', '<svg width="1" height="1" overflow="visible"></svg>'), svg = g.firstChild;
  g.style.opacity = 0;
  c.call(t, () => {
    const bs = items.map((n) => c.box(n.getBoundingClientRect()));
    if (!bs.length) return;
    const x0 = Math.min(...bs.map((b) => b.x)) - 24, x1 = Math.max(...bs.map((b) => b.x + b.w)) + 24;
    const y0 = Math.min(...bs.map((b) => b.y)) - 24, y1 = Math.max(...bs.map((b) => b.y + b.h)) + 24;
    const xs = new Set(), ys = new Set();
    bs.forEach((b) => { xs.add(Math.round(b.x)); xs.add(Math.round(b.x + b.w)); ys.add(Math.round(b.y)); ys.add(Math.round(b.y + b.h)); });
    let html = '';
    xs.forEach((x) => { html += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>`; });
    ys.forEach((y) => { html += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`; });
    bs.forEach((a, i) => bs.forEach((b, j) => {
      if (j <= i) return;
      if (Math.abs(a.y - b.y) < 4) {
        const [l, r] = a.x < b.x ? [a, b] : [b, a], gap = r.x - (l.x + l.w);
        if (gap > 2 && gap < 140) html += gapTag(l.x + l.w, r.x, l.y + Math.min(l.h, r.h) / 2, gap, 'h');
      }
      if (Math.abs(a.x - b.x) < 4) {
        const [u, d] = a.y < b.y ? [a, b] : [b, a], gap = d.y - (u.y + u.h);
        if (gap > 2 && gap < 140) html += gapTag(u.y + u.h, d.y, u.x + Math.min(u.w, d.w) / 2, gap, 'v');
      }
    }));
    svg.innerHTML = html;
  });
  c.tween(t, 0.2, 'out', (k) => { g.style.opacity = k; });
  c.tween(t + life, 0.35, 'in', (k) => { g.style.opacity = 1 - k; });
}

// A properties panel: the agent selects each value and types the new one. Returns when each is set.
function panel(c, ag, t, { at, title, rows, say }) {
  const n = node(c, 'cl-menu cl-panel', `<p class="cl-menu__t">${esc(title)}</p>` +
    rows.map((r) => `<div class="cl-panel__row"><span>${esc(r.label)}</span><b>${esc(r.from)}</b></div>`).join(''));
  t = open(c, ag, t, n, at, 0.5, say);
  const field = (i) => $$('.cl-panel__row b', n)[i];
  const times = [];
  rows.forEach((r, i) => {
    c.go(ag, () => { const b = c.rel(field(i)); return { x: b.x + b.w - 4, y: b.y + b.h * 0.62 }; }, t, 0.28);
    t += 0.34;
    ripple(c, t, here(ag), c.color(ag.id));
    c.call(t, () => field(i).classList.add('sel'));
    t += 0.32;
    c.call(t, () => { field(i).classList.remove('sel'); field(i).textContent = ''; });
    [...r.to].forEach((ch, k) => { t += 0.08; const s = r.to.slice(0, k + 1); c.call(t, () => { field(i).textContent = s; }); });
    t += 0.18;
    c.call(t, () => field(i).classList.add('ok'));
    times.push(t);
  });
  close(c, t + 0.7, n);
  return times;
}

// A heap: at t each item is moved and turned off its place (offsets from `from`)…
function scatter(c, items, t, from) {
  const off = [];
  c.call(t, () => {
    const rs = items.map((n) => n.getBoundingClientRect());
    items.forEach((n, i) => {
      off[i] = from(i, rs);
      const o = off[i];
      n.style.transition = 'none';   // the cards' own hover transition would drag behind the crew's hands
      n.style.transform = `translate(${o.x}px, ${o.y}px) rotate(${o.r || 0}deg) scale(${o.s || 1})`;
    });
  });
  return off;
}
// …then the agent picks each one up and puts it in its place.
function settle(c, ag, items, off, t, { hop = 0.26, dur = 0.55, order } = {}) {
  const seq = order || items.map((_, i) => i);
  seq.forEach((i, k) => {
    const n = items[i], tt = t + 0.3 + k * hop;
    const grab = () => { const b = c.box(n.getBoundingClientRect()); return { x: b.x + 18, y: b.y + 16 }; };
    c.glyph(ag, 'arrow', tt - 0.28);
    c.go(ag, grab, tt - 0.28, 0.26);
    c.tween(tt, dur, 'inOut2', (p) => {
      const o = off[i];
      if (!o) return;
      const q = 1 - p;
      n.style.transform = `translate(${o.x * q}px, ${o.y * q}px) rotate(${(o.r || 0) * q}deg) scale(${1 + ((o.s || 1) - 1) * q})`;
      const g = grab();
      ag.set(g.x, g.y);
    });
  });
  const end = t + 0.3 + seq.length * hop + dur;
  span(ag, t, end);
  c.call(end, () => items.forEach((n) => { n.style.transform = ''; }));
  c.call(end + 0.05, () => items.forEach((n) => { n.style.transition = ''; }));
  return end;
}

// Empty every text in `root` at t, keeping the heights of the `lock` boxes so nothing jumps, to be
// written back in by the crew. Returns a function that schedules putting everything back.
const RESTORE = [];
function blank(c, t, root, lock, wide = false) {
  const ns = textsOf(root), orig = ns.map((n) => n.data), boxes = lock ? $$(lock, root) : [];
  const put = () => { ns.forEach((n, i) => { n.data = orig[i]; }); boxes.forEach((b) => { b.style.minHeight = ''; b.style.minWidth = ''; }); };
  c.call(t, () => {
    const rs = boxes.map((b) => b.getBoundingClientRect());
    boxes.forEach((b, i) => { b.style.minHeight = rs[i].height + 'px'; if (wide) b.style.minWidth = rs[i].width + 'px'; });
    ns.forEach((n) => { n.data = ''; });
  });
  RESTORE.push({ region: c.region, put });
  return (te) => c.call(te, put);
}

// Write an element's text back in, keeping its markup (italics, the bold name): typed letter by letter
// or streamed word by word, the agent riding along at the end of the line. Returns when it is all in.
function writeIn(c, ag, el, t, { mode = 'stream', cps = 34, wps = 11 } = {}) {
  if (!el) return t;
  const ns = textsOf(el), orig = ns.map((n) => n.data);
  if (!ns.length) return t;
  const tail = (n) => {
    const r = document.createRange();
    r.selectNodeContents(n);
    const rs = r.getClientRects(), q = rs[rs.length - 1];
    return q ? c.box(q) : null;
  };
  if (ag) {
    c.glyph(ag, 'ibeam', t - 0.2);
    c.go(ag, () => { const b = c.rel(el); return { x: b.x + 4, y: b.y + Math.min(b.h, 26) * 0.55 }; }, t - 0.3, 0.3);
  }
  const r = rng(orig.join('').length + 3);
  let tt = t;
  ns.forEach((n, i) => {
    const s = orig[i], parts = mode === 'type' ? [...s] : s.split(/(\s+)/).filter(Boolean);
    let acc = '';
    parts.forEach((part) => {
      acc += part;
      if (mode !== 'type' && /^\s+$/.test(part)) return;
      tt += mode === 'type' ? (0.55 + r() * 0.9) / cps : (0.6 + r() * 0.8) / wps;
      const txt = acc;
      c.call(tt, () => { n.data = txt; if (ag) { const q = tail(n); if (q) ag.set(q.x + q.w + 4, q.y + q.h * 0.55); } });
    });
  });
  c.call(tt + 0.02, () => ns.forEach((n, i) => { n.data = orig[i]; }));
  if (ag) { c.glyph(ag, 'arrow', tt + 0.1); span(ag, t - 0.3, tt + 0.1, () => { const b = c.rel(el); return { x: b.x + 4, y: b.y + Math.min(b.h, 26) * 0.55 }; }); }
  return tt;
}

// The retriever's lookup: the text scrambles into place (markup kept).
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%&*+=<>';
function scrambleIn(c, ag, el, t, d = 0.6) {
  if (!el) return t;
  const ns = textsOf(el), orig = ns.map((n) => n.data);
  if (!ns.length) return t;
  if (ag) c.go(ag, () => { const b = c.rel(el); return { x: b.x + Math.min(b.w, 90), y: b.y + Math.min(b.h, 20) * 0.6 }; }, t - 0.25, 0.25);
  c.tween(t, d, 'linear', (p) => ns.forEach((n, i) => {
    const f = orig[i], k = Math.floor(p * f.length);
    let s = f.slice(0, k);
    for (let j = k; j < f.length; j++) s += /\s/.test(f[j]) ? f[j] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    n.data = p >= 1 ? f : s;
  }));
  use(ag, t + d);
  span(ag, t - 0.25, t + d);
  return t + d;
}

// Numbers counted up from zero, keeping commas and decimals.
function countIn(c, el, t, d = 0.9) {
  if (!el) return t;
  const parts = textsOf(el).map((n) => {
    const m = n.data.match(/^([\s\S]*?)(\d[\d,]*\.?\d*)([\s\S]*)$/);
    if (!m) { const text = n.data; c.call(t, () => { n.data = text; }); return null; }   // no number in it: just put it back
    return { n, pre: m[1], v: num(m[2]), dec: (m[2].split('.')[1] || '').length, comma: m[2].includes(','), post: m[3], text: n.data };
  }).filter(Boolean);
  c.tween(t, d, 'out', (p) => parts.forEach((q) => {
    const v = q.v * p;
    q.n.data = p >= 1 ? q.text : q.pre + (q.comma ? fmt(Math.round(v)) : v.toFixed(q.dec)) + q.post;
  }));
  return t + d;
}

// When each agent is next free, across the acts of its region (agents are the region's own objects);
// when it is last needed at all (USE: the next floor gets everyone who is done here); and the spans in
// which a story keeps its people together, so they do not wander off mid-conversation (HOLD).
const BUSY = new WeakMap(), USE = new WeakMap(), HOLD = new WeakMap(), LATE = new WeakMap();   // LATE: when it gets here from another floor
// SPANS: each stretch of the script in which an agent is at work (region time) and where it is headed,
// so an agent left with nothing to do can tell how soon it is needed again, and where (Idle)
const SPANS = new WeakMap();
const span = (ag, t0, t1, to) => { if (!ag) return; if (!SPANS.has(ag)) SPANS.set(ag, []); SPANS.get(ag).push({ t0, t1: Math.max(t0, t1), to }); SPANS.get(ag).sorted = false; };
const spansOf = (ag) => { const l = SPANS.get(ag) || []; if (!l.sorted) { l.sort((a, b) => a.t0 - b.t0); l.sorted = true; } return l; };
const busy = (ag, t) => { if (ag) BUSY.set(ag, Math.max(BUSY.get(ag) || 0, t)); };
const use = (ag, t) => { if (ag) USE.set(ag, Math.max(USE.get(ag) || 0, t)); };
const hold = (ag, t0, t1) => { if (ag) { if (!HOLD.has(ag)) HOLD.set(ag, []); HOLD.get(ag).push([t0, t1]); use(ag, t1); } };
// ---------------------------------------------------------------- more hands
// The crew grows with the work (the user's rule): a job whose agent is still busy, or not on this floor
// yet, goes to a helper of the same trade spawned on the spot (writer-4, eval-3 …) instead of waiting, so
// nothing that is ready stands still. Helpers belong to their floor (their names are free again once it
// is built), come in from the side for their first job and leave the screen like everyone else. Never
// the red-team or the guardrail, never on the hero, and only so many at once.
const TOL = 0.4;   // a wait this short is not worth a new hand
const NOHELP = /^(red-team|guardrail)$/;
const HELPERS = new Map();   // helper name → its floor
const tradeOf = (id) => id.replace(/-\d+$/, '');
const busyAt = (ag, t) => Math.max(BUSY.get(ag) || 0, LATE.get(ag) || 0) > t + TOL || spansOf(ag).some((x) => x.t0 < t + 0.5 && x.t1 > t - 0.05);
function tint(hex, k) {   // a helper's colour: its trade's, a little lighter or darker
  const n = parseInt(hex.slice(1), 16), f = [0.22, -0.2, 0.4, -0.32][k % 4];
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)).toString(16).padStart(2, '0')).join('');
}
function helperFor(c, ag, t, skip = []) {
  if (!ag || !c.spawn || NOHELP.test(ag.id) || c.region.matches('.hero')) return null;
  const trade = tradeOf(ag.id), mine = c.crew.filter((h) => h.helper && !h.gone);
  const ready = mine.find((h) => tradeOf(h.id) === trade && !skip.includes(h) && !busyAt(h, t));
  if (ready) return ready;
  if (mine.length >= 6 || mine.filter((h) => tradeOf(h.id) === trade).length >= 3 || HELPERS.size >= 14) return null;
  let k = Object.keys(CREW).filter((id) => tradeOf(id) === trade).length + 1;
  while (HELPERS.has(`${trade}-${k}`) || CREW[`${trade}-${k}`]) k++;
  const id = `${trade}-${k}`;
  HELPERS.set(id, c.region);
  const h = c.spawn(id, tint(CREW[trade] || CREW[ag.id] || '#f5f5f7', k)), v = c.view();
  h.set(v.x1 + 50, (v.y0 + v.y1) / 2);   // out of sight until its first job brings it in
  c.log('orchestrator', `${ag.id} is busy · spawned ${id}`, Math.max(0, t - 0.3));
  return h;
}

// Each agent works through its own jobs in order: q(agent, wanted start, job) runs the job when the
// agent is next free and returns when it ends, or hands it to a helper if the agent is busy (helperFor);
// q.pick(agents, t) is whichever of them is free first.
function queue(c) {
  const free = new Map(), when = (ag) => Math.max(free.get(ag) || 0, BUSY.get(ag) || 0, LATE.get(ag) || 0);
  const q = (ag, t, job) => {
    if (!ag) return t;
    if (c && (when(ag) > t + TOL || busyAt(ag, t))) { const h = helperFor(c, ag, t); if (h && when(h) <= t + TOL) ag = h; }
    const s = Math.max(t, when(ag)), e = job(ag, s);
    free.set(ag, e + 0.08);
    busy(ag, e + 0.08);
    use(ag, e);
    return e;
  };
  q.pick = (list, t = 0) => list.filter(Boolean).reduce((a, b) => (Math.max(t, when(b)) < Math.max(t, when(a)) ? b : a));
  return q;
}

// A chip placed where something is when it appears (c.chip takes a place fixed in advance).
function chipAt(c, t, text, color, at, life = 1.4) {
  const n = node(c, 'sb-chip');
  n.textContent = text;
  Object.assign(n.style, { background: color, opacity: 0 });
  c.call(t, () => { const q = at(); n.style.left = q.x + 'px'; n.style.top = q.y + 'px'; });
  c.tween(t, 0.25, 'out', (p) => { n.style.opacity = p; n.style.transform = `translateY(${6 * (1 - p)}px)`; });
  c.tween(t + life, 0.3, 'in', (p) => { n.style.opacity = 1 - p; });
}

// "2 of 4,812": the eval does the sum
const RATIO = /([\d,]+) of (?:about )?([\d,]+)/;
const share = (a, b) => { const p = (a / b) * 100; return (p < 0.1 ? p.toFixed(3) : p.toFixed(2)) + '%'; };

// A small editor working in one text node of an element (its last words: a heading's title after its
// number). Every keystroke is a call on the timeline carrying the exact text it leaves, so a skipped or
// fast-forwarded build still ends on the right words.
function Editor(c, el, which = 'last') {
  const all = textsOf(el), tn = which === 'first' ? all[0] : all[all.length - 1];
  const original = tn ? tn.data : '';
  let planned = original;
  const caret = node(c, 'cl-caret');
  caret.style.opacity = 0;
  const hl = [0, 1, 2].map(() => { const h = node(c, 'cl-sel'); h.style.opacity = 0; return h; });
  const set = (s) => { if (tn) tn.data = s; };
  function at(i) {   // where the caret stands before character i, in layer coordinates
    const len = tn ? tn.data.length : 0;
    if (!len) {
      const b = c.box(el.getBoundingClientRect()), lh = parseFloat(getComputedStyle(el).lineHeight) || b.h || 20;
      return { x: b.x, y: b.y, h: Math.min(b.h || lh, lh) };
    }
    const r = document.createRange();
    if (i < len) {
      r.setStart(tn, i); r.setEnd(tn, i + 1);
      const q = r.getClientRects()[0];
      if (q) { const b = c.box(q); return { x: b.x, y: b.y, h: b.h }; }
    }
    r.setStart(tn, len - 1); r.setEnd(tn, len);
    const rs = r.getClientRects(), q = rs[rs.length - 1] || r.getBoundingClientRect(), b = c.box(q);
    return { x: b.x + b.w, y: b.y, h: b.h };
  }
  function caretTo(ag, i) {
    const p = at(i);
    Object.assign(caret.style, { left: p.x + 'px', top: p.y + p.h * 0.08 + 'px', height: p.h * 0.84 + 'px', background: c.color(ag.id), opacity: 1 });
    ag.set(p.x + 5, p.y + p.h * 0.55);
  }
  function select(i, j, color) {
    if (!tn || j <= i) { hl.forEach((h) => { h.style.opacity = 0; }); return; }
    const r = document.createRange();
    r.setStart(tn, Math.max(0, i)); r.setEnd(tn, Math.min(tn.data.length, j));
    const rs = [...r.getClientRects()];
    hl.forEach((h, k) => {
      const q = rs[k];
      if (!q) { h.style.opacity = 0; return; }
      const b = c.box(q);
      Object.assign(h.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', background: color, opacity: 1 });
    });
  }
  const unselect = () => hl.forEach((h) => { h.style.opacity = 0; });
  const ed = {
    el, original,
    get text() { return planned; },
    clear(t) { planned = ''; c.call(t, () => set('')); return t; },
    // type s at `pos` (the end by default)
    type(ag, t, s, { cps = 18, pos = planned.length } = {}) {
      const base = planned, r = rng(s.length * 7 + base.length + 1);
      c.glyph(ag, 'ibeam', t - 0.2);
      c.go(ag, () => { const p = at(Math.min(pos, tn ? tn.data.length : 0)); return { x: p.x + 5, y: p.y + p.h * 0.55 }; }, t - 0.32, 0.3);
      let tt = t;
      [...s].forEach((ch, k) => {
        tt += (0.55 + r() * 0.9) / cps;
        const txt = base.slice(0, pos) + s.slice(0, k + 1) + base.slice(pos);
        c.call(tt, () => { set(txt); caretTo(ag, pos + k + 1); });
      });
      planned = base.slice(0, pos) + s + base.slice(pos);
      c.call(tt + 0.18, () => { caret.style.opacity = 0; });
      use(ag, tt + 0.18);
      span(ag, t - 0.32, tt + 0.18);
      return tt + 0.18;
    },
    // turn the text into `next`: the caret goes to the end of the part that changes, selects back over
    // it (or backspaces, keys = true), deletes it and types the new part
    to(ag, t, next, { cps = 18, keys = false } = {}) {
      const cur = planned;
      let p = 0;
      while (p < cur.length && p < next.length && cur[p] === next[p]) p++;
      let s = 0;
      while (s < cur.length - p && s < next.length - p && cur[cur.length - 1 - s] === next[next.length - 1 - s]) s++;
      const a = p, b = cur.length - s, ins = next.slice(p, next.length - s), color = c.color(ag.id);
      c.glyph(ag, 'ibeam', t - 0.25);
      c.go(ag, () => { const q = at(b); return { x: q.x + 5, y: q.y + q.h * 0.55 }; }, t - 0.36, 0.34);
      let tt = t;
      if (b > a) {
        if (keys) {
          for (let k = b; k > a; k--) {
            tt += 1 / 22;
            const txt = cur.slice(0, k - 1) + cur.slice(b), at2 = k - 1;
            c.call(tt, () => { set(txt); caretTo(ag, at2); });
          }
        } else {
          const n = b - a, d = Math.min(0.9, 0.14 + n * 0.035);
          c.tween(tt, d, 'linear', (k) => { const i = Math.round(b - n * k); select(i, b, color + '66'); caretTo(ag, i); });
          tt += d + 0.22;
          const txt = cur.slice(0, a) + cur.slice(b);
          c.call(tt, () => { unselect(); set(txt); caretTo(ag, a); });
          tt += 0.12;
        }
      }
      const base = cur.slice(0, a) + cur.slice(b), r = rng(next.length * 13 + a + 5);
      [...ins].forEach((ch, k) => {
        tt += (0.55 + r() * 0.9) / cps;
        const txt = base.slice(0, a) + ins.slice(0, k + 1) + base.slice(a);
        c.call(tt, () => { set(txt); caretTo(ag, a + k + 1); });
      });
      planned = next;
      c.call(tt + 0.18, () => { caret.style.opacity = 0; });
      use(ag, tt + 0.18);
      span(ag, t - 0.36, tt + 0.18);
      return tt + 0.18;
    },
    // red-team rewrites `from` into `to`; the guardrail boxes it, blocks it and puts it back
    attack(rt, gr, t, from, to, why) {
      const cur = planned, i = cur.indexOf(from);
      if (i < 0 || !rt || !gr) return t;
      let k = 0;
      while (k < from.length && k < to.length && from[k] === to[k]) k++;
      const hacked = cur.slice(0, i + k) + to.slice(k) + cur.slice(i + from.length);
      c.call(t - 0.02, () => { const v = c.view(), q = at(i + from.length); rt.set(v.x1 + 60, q.y - 40); });
      think(c, rt, t + 0.5, `what if… ${to}?`, 1.4);
      c.log(rt.id, `rewrite “${from}” → “${to}”`, t + 0.4);
      let tt = ed.to(rt, t + 0.55, hacked, { cps: 12, keys: true });
      const bad = node(c, 'cl-sel');
      bad.style.opacity = 0;
      c.call(tt, () => {
        const r = document.createRange();
        r.setStart(tn, i + k); r.setEnd(tn, i + to.length);
        const q = r.getClientRects()[0];
        if (q) { const b = c.box(q); Object.assign(bad.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', background: '#ff3b3b88', opacity: 1 }); }
      });
      c.go(gr, () => { const q = at(i); return { x: q.x - 6, y: q.y + q.h + 10 }; }, tt - 0.55, 0.5);
      const guard = node(c, 'sb-guard');
      guard.style.opacity = 0;
      const tg = tt + 0.25;
      c.call(tg, () => {
        const r = document.createRange();
        r.setStart(tn, i); r.setEnd(tn, i + to.length);
        const q = r.getBoundingClientRect(), b = c.box(q);
        Object.assign(guard.style, { left: b.x - 8 + 'px', top: b.y + 'px', width: b.w + 16 + 'px', height: b.h + 'px' });
      });
      c.tween(tg, 0.22, 'out', (p) => { guard.style.opacity = p; guard.style.transform = `scale(${1.08 - 0.08 * p})`; });
      c.call(tg, () => c.attacked());
      c.log(gr.id, `blocked ${why} · rolled back`, tg + 0.04);
      chipAt(c, tg + 0.05, 'BLOCKED · ' + why, c.color(gr.id), () => { const q = at(i); return { x: q.x - 4, y: q.y + q.h + 30 }; }, 1.6);
      let shook = 0;
      c.tween(tg + 0.03, 0.28, 'linear', (p) => { const off = p >= 1 ? 0 : Math.sin(p * Math.PI * 6) * 7; rt.set(rt.x - shook + off, rt.y); shook = off; });
      c.call(tg + 0.35, () => { bad.style.opacity = 0; set(cur); caret.style.opacity = 0; });
      planned = cur;
      c.go(rt, () => ({ x: c.view().x1 + 90, y: rt.y - 60 }), tg + 0.45, 0.45, 'in');
      think(c, gr, tg + 0.4, 'not on my watch.', 1.4);
      c.tween(tg + 1.2, 0.3, 'out', (p) => { guard.style.opacity = 1 - p; });
      use(rt, tg + 0.9);
      return tg + 1.0;
    },
    done(t) { c.call(t, () => { set(original); caret.style.opacity = 0; unselect(); }); return t; },
  };
  return ed;
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
  const A = agentIn(c);
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
  c.log('photogrammetrist', 'goal: rebuild the city from the air', at(0.05));

  // 1 · surveyor: ground control points on the quay and the pier
  const GCPS = [[262, 690], [652, 606], [1022, 606], [1440, 694]];
  c.log('surveyor', `placing ${GCPS.length} ground control points`, at(0.5));
  think(c, S, at(0.3), 'four points. corners of the quay.', 1.6);
  GCPS.forEach(([x, y], i) => {
    const tt = at(0.5 + i * 0.62);
    c.glyph(S, 'cross', tt);
    c.go(S, () => cp(c, x, y), tt, 0.46);
    gcp(c, tt + 0.46, () => cp(c, x, y), 'GCP ' + (i + 1), at(6.4));
  });
  c.glyph(S, 'arrow', at(3.1));
  c.log('surveyor', 'control surveyed · RMSE 1.8 cm', at(3.1));
  think(c, S, at(3.1), '1.8 cm. close enough.', 1.5);
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
  think(c, G, ta + 0.2, 'need more overlap…', 1.4);
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
  think(c, G, td + 0.6, 'look at all those points.', 1.6);
  c.tween(td, 0.6, 'in', (k) => { rays.style.opacity = 1 - k; cams.forEach((cam) => { cam.n.style.opacity = 1 - k; }); });

  // 4 · Build Mesh…: grey, untextured; 5 · Build Texture…: colour, and the scenery starts moving
  m = menu(c, G, at(6.65), { at: wfAt, title: 'Workflow', items: WF, pick: 3, say: 'Workflow ▸ Build Mesh…', move: 0.45 });
  c.call(m.hit, () => cls([...body('far'), ...body('mid')], null, 'cl-wait'));
  c.tween(m.hit, 0.8, 'in', (k) => { Cloud.set('far', 'alpha', 1 - k); Cloud.set('mid', 'alpha', 1 - k); });
  c.log('photogrammetrist', 'mesh · 380,512 faces', m.hit + 0.05);
  think(c, G, m.hit + 0.2, 'grey. good. now colour.', 1.4);
  m = menu(c, G, at(8.65), { at: wfAt, title: 'Workflow', items: WF, pick: 4, say: 'Workflow ▸ Build Texture…', move: 0.3 });
  c.call(m.hit, () => { cls([...body('far'), ...body('mid')], null, 'cl-mesh'); go('far', 'mid', 'clouds'); });
  c.log('photogrammetrist', 'texture · 8,192 px atlas · far city + river', m.hit + 0.05);

  // 6 · electrician: the city's windows
  const on = toggle(c, EL, at(9.8), { at: () => cp(c, 1090, 440), title: 'Lights', label: 'City windows', say: 'switching on the city · 1,284 windows' });
  flicker(c, on, ['far', 'mid']);
  think(c, EL, on + 0.1, 'let there be light.', 1.6);

  // the monster: boxed, scanned, meshed, then painted
  const mA = anc('monster'), dA = moverOf('drone', 0), dB = moverOf('drone', 1);
  if (mA) {
    const d = c.frame(PL2, mA, at(5.4));
    c.log('planner-2', 'framing the monster · 428 × 548', at(5.0));
    think(c, PL2, at(5.0), 'big one. 428 by 548.', 1.5);
    c.tween(d + 0.05, 1.0, 'linear', (k) => Cloud.set('monster', 'show', k), () => Cloud.set('monster', 'alpha', 1));
    c.call(at(7.3), () => cls(body('monster'), null, 'cl-wait'));
    c.tween(at(7.3), 0.7, 'in', (k) => Cloud.set('monster', 'alpha', 1 - k));
    const red = palette(c, PA, at(7.8), { at: center(c, mA, 0.9, 0.28), title: 'Fill · monster', say: 'picking a colour for the monster',
      list: [{ shape: 'circle', color: '#1c4fb8', name: 'Bauhaus blue' }, { shape: 'square', color: '#e2321f', name: 'Bauhaus red' },
        { shape: 'triangle', color: '#f6be00', name: 'Bauhaus yellow' }, { shape: 'square', color: '#1d1d1f', name: 'Ink black' }],
      path: [2, 0, 1] });
    c.call(red, () => { cls(body('monster'), null, 'cl-mesh'); go('monster'); });
    c.log('painter', 'fill → Bauhaus red #E2321F', red);
    think(c, PA, at(8.6), 'yellow? blue?…', 1.2);
    think(c, PA, red + 0.05, 'red. obviously.', 1.4);
  }

  // the robot: drones fly round it taking photos, it is rebuilt from them and set going
  launch(PI, dA, at(6.4), 'launching survey drone A');
  launch(PI, dB, at(7.6), 'launching survey drone B');
  c.log('pilot', 'drones photographing the robot · 64 images', at(8.35));
  think(c, PI, at(6.0), 'tower, drone A ready.', 1.4);
  think(c, PI, at(8.4), 'smile, robot.', 1.3);
  [0, 1, 2, 3, 4, 5].forEach((k) => { const dm = k % 2 ? dB : dA; if (dm) flash(c, at(8.35 + k * 0.2), center(c, dm, 0.5, 0.55)); });
  c.tween(at(8.4), 1.2, 'linear', (k) => Cloud.set('robot', 'show', k), () => Cloud.set('robot', 'alpha', 1));
  c.call(at(9.65), () => cls(body('robot'), null, 'cl-wait'));
  c.tween(at(9.65), 0.7, 'in', (k) => Cloud.set('robot', 'alpha', 1 - k));
  const rA = anc('robot');
  if (rA) {
    const ctxItems = [{ label: 'Texture' }, { label: 'Rig', sub: true }, { label: 'Animate', sub: true }, '-', { label: 'Delete', key: '⌫', danger: true }];
    let mm = menu(c, ME, at(9.8), { at: center(c, rA, 0.42, 0.5), items: ctxItems, pick: 0, say: 'right-click on the robot ▸ Texture' });
    c.call(mm.hit, () => { cls(body('robot'), null, 'cl-mesh'); go('robot'); });
    think(c, ME, at(9.9), 'grey robot, sad robot.', 1.4);
    mm = menu(c, ME, mm.end + 0.15, { at: center(c, rA, 0.42, 0.5), items: ctxItems, pick: 2, move: 0.3,
      sub: { items: [{ label: 'Idle' }, { label: 'Wave' }, { label: 'Punch', key: 'every 2.4 s' }], pick: 2 }, say: 'Animate ▸ Punch · every 2.4 s' });
    c.call(mm.hit, () => sc.classList.add('cl-punch'));
    c.log('mechanic', 'punch armed · first hit in 1 s', mm.hit + 0.1);
    think(c, ME, mm.hit + 0.15, 'stand back.', 1.4);
  }

  // the traffic: each vehicle boxed and sent on its way
  launch(SK, moverOf('ferry'), at(10.9), 'ferry casting off');
  think(c, SK, at(10.4), 'ferry’s late again.', 1.4);
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
    think(c, RT, at(13.1), 'nobody will miss a monster.', 1.6);
    c.go(GR, center(c, mA, 0.08, 0.06), x.hit - 0.55, 0.5);
    const gb = node(c, 'sb-guard');
    gb.style.opacity = 0;
    const tb = x.hit + 0.3;
    c.call(tb, () => { const b = c.rel(mA); Object.assign(gb.style, { left: b.x - 6 + 'px', top: b.y - 6 + 'px', width: b.w + 12 + 'px', height: b.h + 12 + 'px' }); });
    c.tween(tb, 0.22, 'out', (k) => { gb.style.opacity = k; gb.style.transform = `scale(${1.04 - 0.04 * k})`; });
    const mb = c.rel(mA);
    c.chip('BLOCKED · deleting the monster', c.color('guardrail'), mb.x, mb.y + mb.h + 10, tb + 0.05, 1.6);
    c.log('guardrail', 'blocked · monster restored from snapshot', tb + 0.05);
    think(c, GR, tb + 0.4, 'snapshot from 3 s ago. you’re welcome.', 1.8);
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
    think(c, ME, at(14.75), 'set to your clock.', 1.3);
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

// ---------------------------------------------------------------- copy that is written, reviewed, rewritten
// Each story types a first draft, lets someone react, then revises until it reads as the page does.
// Drafts differ in wording only: no draft ever puts a wrong fact on the page.
const near = (ag, dx, dy) => () => ({ x: ag.x + dx, y: ag.y + dy });
const above = (c, el, fx = 0.5, dy = 60) => () => { const b = c.rel(el); return { x: b.x + b.w * fx, y: b.y - dy }; };
const right = (c, el, dy = 0) => () => { const b = c.rel(el); return { x: b.x + b.w + 16, y: b.y + dy }; };
const STORY = {
  name(c, ed, t) {
    const A = agentIn(c), W = A('writer'), E = A('eval');
    t = ed.type(W, t, 'Yang Tnag', { cps: 8 });
    c.go(E, near(W, 70, -40), t - 0.5, 0.45);
    think(c, E, t + 0.05, 'Tnag?', 1.4);
    c.log(E.id, 'typo in the name', t + 0.1);
    t = ed.to(W, t + 1.1, ed.original, { cps: 9, keys: true });
    think(c, W, t + 0.05, 'better.', 1.2);
    return t + 0.3;
  },
  tagline(c, ed, t) {
    const A = agentIn(c), W = A('writer-2'), E = A('editor'), R = A('red-team'), G = A('guardrail');
    t = ed.type(W, t, 'Photos into 3D cities.', { cps: 15 });
    think(c, W, t + 0.05, 'first draft. don’t judge.', 1.6);
    c.go(E, () => { const b = c.rel(ed.el); return { x: b.x + b.w * 0.62, y: b.y - 14 }; }, t + 0.2, 0.45);
    bubble(c, t + 0.75, { at: above(c, ed.el, 0.55, 64), who: 'editor', text: 'Too vague. Name the three fields.', life: 2 });
    c.log(E.id, 'tagline too vague · asked for the three fields', t + 0.75);
    t = ed.to(W, t + 2.7, ed.original, { cps: 21 });
    think(c, E, t + 0.05, 'yes. that.', 1.2);
    return ed.attack(R, G, t + 1.0, 'Photogrammetry', 'Photoshop', 'tampering with the tagline');
  },
  aff(c, ed, t) {
    const A = agentIn(c), R = A('retriever'), E = A('eval');
    const short = ed.original.replace(/ with [^]+? at /, ' at ');
    t = ed.type(R, t, short, { cps: 30 });
    c.log(R.id, 'fetched the affiliation', t);
    if (short !== ed.original) {
      c.go(E, () => { const b = c.rel(ed.el); return { x: b.x + b.w * 0.3, y: b.y + b.h + 18 }; }, t - 0.2, 0.5);
      think(c, E, t + 0.4, 'and the advisor?', 1.5);
      t = ed.to(R, t + 1.7, ed.original, { cps: 22 });
      c.log(R.id, 'added the advisor', t);
    }
    return t + 0.2;
  },
  research(c, ed, t) {
    const A = agentIn(c), W = A('writer'), E = A('editor');
    t = ed.type(W, t, 'Reserch', { cps: 11 });
    c.go(E, near(W, 40, -50), t - 0.3, 0.4);
    think(c, E, t + 0.1, 'Reserch?', 1.3);
    t = ed.to(W, t + 1.1, ed.original, { cps: 10, keys: true });
    think(c, W, t, 'nobody saw that.', 1.4);
    return t + 0.2;
  },
  honors(c, ed, t) {
    const A = agentIn(c), W = A('writer'), E = A('editor');
    t = ed.type(W, t, 'Awards', { cps: 10 });
    c.go(E, near(W, 30, 40), t - 0.2, 0.45);
    bubble(c, t + 0.4, { at: right(c, ed.el), who: 'editor', text: 'Scholarships too. Call it Honors.', life: 1.9 });
    t = ed.to(W, t + 2.3, ed.original, { cps: 10 });
    think(c, W, t, 'fine. Honors.', 1.3);
    return t + 0.2;
  },
  papers(c, ed, t) {
    const A = agentIn(c), W = A('writer'), E = A('editor');
    t = ed.type(W, t, 'Publications', { cps: 13 });
    c.go(E, near(W, 40, -46), t - 0.2, 0.4);
    think(c, E, t + 0.25, 'shorter.', 1.2);
    t = ed.to(W, t + 1.3, ed.original, { cps: 10 });
    return t + 0.2;
  },
  cv(c, ed, t) {
    const A = agentIn(c), W = A('writer'), E = A('editor');
    t = ed.type(W, t, 'CV', { cps: 8 });
    c.go(E, near(W, 30, 40), t - 0.2, 0.4);
    bubble(c, t + 0.3, { at: right(c, ed.el), who: 'editor', text: 'Spell it out.', life: 1.6 });
    t = ed.to(W, t + 1.9, ed.original, { cps: 16 });
    think(c, E, t, 'much better.', 1.2);
    return t + 0.2;
  },
  reviewer(c, ed, t) {
    const A = agentIn(c), W = A('writer-3'), E = A('editor');
    t = ed.type(W, t, 'Reviews', { cps: 11 });
    c.go(E, near(W, 30, -40), t - 0.2, 0.4);
    think(c, E, t + 0.2, 'it’s about the reviewer.', 1.5);
    t = ed.to(W, t + 1.5, ed.original, { cps: 10 });
    return t + 0.2;
  },
  service(c, ed, t) {
    const A = agentIn(c), W = A('writer'), E = A('editor');
    t = ed.type(W, t, 'Reviewing', { cps: 11 });
    c.go(E, near(W, 30, 40), t - 0.2, 0.4);
    bubble(c, t + 0.3, { at: right(c, ed.el), who: 'editor', text: 'More than reviews. Call it Service.', life: 1.8 });
    t = ed.to(W, t + 2.1, ed.original, { cps: 10 });
    return t + 0.2;
  },
  serviceLede(c, ed, t) {
    const A = agentIn(c), W = A('writer-2'), E = A('editor');
    t = ed.type(W, t, 'Journals I review for.', { cps: 18 });
    c.go(E, near(W, 20, 36), t - 0.2, 0.4);
    bubble(c, t + 0.3, { at: () => { const b = c.rel(ed.el); return { x: b.x, y: b.y + b.h + 12 }; }, who: 'editor', text: 'Say how they are ordered. And the conferences.', life: 2 });
    t = ed.to(W, t + 2.2, ed.original, { cps: 24 });
    return t + 0.2;
  },
  email(c, ed, t) {
    const A = agentIn(c), W = A('writer'), R = A('red-team'), G = A('guardrail');
    t = ed.type(W, t, ed.original, { cps: 14 });
    think(c, W, t + 0.05, 'checked it twice.', 1.3);
    return ed.attack(R, G, t + 0.9, 'osu', '0su', 'look-alike domain');
  },
  contact(c, ed, t) {
    const A = agentIn(c), W = A('writer'), E = A('editor');
    t = ed.type(W, t, 'Get in touch', { cps: 12 });
    c.go(E, near(W, 30, -44), t - 0.2, 0.4);
    think(c, E, t + 0.1, 'one word.', 1.3);
    t = ed.to(W, t + 1.3, ed.original, { cps: 10 });
    return t + 0.2;
  },
};
ACTS.edit = (c) => {
  const ed = Editor(c, c.el), story = STORY[c.el.dataset.swarmStory];
  c.call(c.t, () => show(c.el));
  ed.clear(c.t);
  const t = ed.done((story ? story(c, ed, c.t + 0.1) : ed.type(c.a, c.t + 0.1, ed.original)) + 0.05);
  const crew = c.who.filter((g) => g.id !== 'red-team');
  crew.forEach((g) => hold(g, c.t, t + 0.6));
  aside(c, crew, ed.el, t + 0.1);
  return t + 0.3;
};
// the crew of a finished line steps clear of its words, to just past their end
function aside(c, ags, el, t) {
  const ns = textsOf(el);
  ags.forEach((ag, k) => c.go(ag, () => {
    const r = document.createRange();
    if (ns.length) { r.setStart(ns[0], 0); r.setEnd(ns[ns.length - 1], ns[ns.length - 1].data.length); }
    else r.selectNodeContents(el);
    const b = c.box(r.getBoundingClientRect()), v = c.view();
    return { x: Math.min(b.x + b.w + 22 + k * 16, v.x1 - 90), y: b.y + b.h * 0.35 + k * 22 };
  }, t + k * 0.06, 0.45));
}
// typed in, no story (a year heading brings the rule above its papers)
ACTS.type = (c) => {
  const restore = blank(c, c.t, c.el);
  c.call(c.t, () => { show(c.el); if (c.el.matches('.year')) c.el.parentElement.classList.add('cl-rule'); });
  const t = writeIn(c, c.a, c.el, c.t + 0.1, { mode: 'type', cps: 18 });
  restore(t + 0.05);
  return t + 0.1;
};
// streamed in, word by word
ACTS.stream = (c) => {
  const restore = blank(c, c.t, c.el);
  c.call(c.t, () => show(c.el));
  const t = writeIn(c, c.a, c.el, c.t + 0.1, { mode: 'stream', wps: 13 });
  restore(t + 0.05);
  return t + 0.1;
};

// the hero's section index, boxed in the wireframe: typed in line by line
ACTS.index = (c) => {
  const nav = c.el, A = agentIn(c), P = A('planner'), W = A('writer-3'), links = $$('a', nav);
  const restore = blank(c, c.t, nav, 'ol', true);
  let t = c.t + 0.1;
  c.call(t, () => show(nav));
  think(c, P, t, `${links.length} sections. one index.`, 1.5);
  c.log(W.id, 'section index · 6 lines', t);
  links.forEach((a) => { t = writeIn(c, W, a, t + 0.08, { mode: 'type', cps: 34 }); });
  restore(t + 0.05);
  return t + 0.1;
};

// ---------------------------------------------------------------- 01 · research
// The three cards are in the wireframe already, painted; the stylists insert their shapes, the writers
// fill them in, and the red-team turns the triangle upside down until a stylist turns it back.
ACTS.cards = (c) => {
  const box = c.el, cards = $$('.area', box), q = queue(c), A = agentIn(c), t0 = c.t;
  const Ws = [A('writer-2'), A('writer-3'), A('writer')], Ss = [A('stylist'), A('stylist-2')], R = A('retriever'), E = A('editor');
  const shapes = cards.map((k) => $('.area-shape', k));
  const restore = blank(c, t0, box, '.area');
  c.call(t0, () => { shapes.forEach((s) => { if (s) s.style.opacity = '0'; }); show(box); });
  const t = t0 + 0.05;
  const NAMES = ['Triangle', 'Square', 'Circle'], COLORS = ['yellow', 'red', 'blue'];
  let end = t;
  cards.forEach((card, i) => {
    const k = card.classList.contains('area-p') ? 0 : card.classList.contains('area-r') ? 1 : 2, s = shapes[i];
    if (s) {
      end = Math.max(end, q(Ss[i % 2], t + 0.1 + i * 0.5, (S, ts) => {
        const m = menu(c, S, ts, { at: center(c, card, 0.55, 0.16), title: 'Insert shape', move: 0.45,
          items: [{ label: '▲  Triangle', key: '⇧T' }, { label: '■  Square', key: '⇧S' }, { label: '●  Circle', key: '⇧C' }], pick: k,
          say: `Insert ▸ ${NAMES[k]} · Bauhaus ${COLORS[k]}` });
        c.tween(m.hit + 0.1, 0.5, 'out', (p) => { s.style.opacity = String(p); s.style.scale = String(0.55 + 0.45 * p); });
        c.call(m.hit + 0.62, () => { s.style.opacity = ''; s.style.scale = ''; });
        return m.hit + 0.62;
      }));
    }
    const h3 = $('h3', card), p = $('p', card), link = $('.area-link', card), tw = t + 0.2 + i * 0.35;
    const tp = q(q.pick(Ws, tw), tw, (W, ts) => {
      const ed = Editor(c, h3);
      ed.clear(ts - 0.02);
      let tt;
      if (k === 1 && ed.original === 'Remote sensing') {
        tt = ed.type(W, ts, 'Remote-sensing', { cps: 14 });
        c.go(E, near(W, 30, -44), tt - 0.3, 0.4);
        think(c, E, tt + 0.05, 'no hyphen.', 1.3);
        tt = ed.to(W, tt + 1.0, ed.original, { cps: 12, keys: true });
      } else tt = ed.type(W, ts, ed.original, { cps: 15 });
      ed.done(tt);
      return writeIn(c, W, p, tt + 0.15, { mode: 'stream', wps: 12 });
    });
    const tl2 = q(R, tp - 0.3, (Rr, ts) => writeIn(c, Rr, link, ts, { mode: 'type', cps: 24 }));
    end = Math.max(end, tp, tl2);
  });
  restore(end + 0.05);
  return end + 0.1;
};
// The red-team turns the yellow triangle upside down; a stylist turns it back.
ACTS.flip = (c) => {
  const tri = c.el, A = agentIn(c), RT = A('red-team'), S = A('stylist');
  let end = c.t;
  if (tri && RT) {
    const ta = c.t + 0.1;
    c.call(ta - 0.01, () => { const v = c.view(); RT.set(v.x1 + 60, c.rel(tri).y + 40); });
    c.go(RT, center(c, tri, 0.5, 0.55), ta, 0.6);
    think(c, RT, ta + 0.6, 'what if it points down?', 1.6);
    c.log(RT.id, 'flipping the triangle', ta + 0.7);
    c.tween(ta + 0.9, 0.6, 'inOut2', (p) => { tri.style.rotate = 180 * p + 'deg'; });
    c.go(RT, () => ({ x: c.view().x1 + 80, y: RT.y }), ta + 1.7, 0.6, 'in');
    c.go(S, center(c, tri, 0.5, 0.55), ta + 1.8, 0.5);
    think(c, S, ta + 2.3, 'Bauhaus triangles point up.', 1.8);
    c.log(S.id, 'triangle turned back up', ta + 2.5);
    c.tween(ta + 2.6, 0.6, 'inOut2', (p) => { tri.style.rotate = 180 * (1 - p) + 'deg'; });
    c.call(ta + 3.25, () => { tri.style.rotate = ''; });
    use(RT, ta + 2.3); use(S, ta + 3.3);
    end = ta + 3.3;
  }
  return end + 0.1;
};

// the citation panel: the researcher fetches the profile before the numbers are counted
ACTS.scholar = (c) => {
  const box = c.el, ag = c.a;
  const total = ($('.big-number', box) || {}).textContent || '', h = ($('.stats dd') || {}).textContent || '';
  c.go(ag, center(c, box, 0.35, 0.1), c.t, 0.45);
  c.log(ag.id, 'fetching the Google Scholar profile', c.t + 0.1);
  think(c, ag, c.t + 0.2, 'pulling Scholar…', 1.3);
  note(c, c.t + 0.45, { at: () => { const b = c.rel(box); return { x: b.x, y: b.y - 70 }; }, color: c.color(ag.id), life: 2.3, step: 0.8,
    lines: ['<b>GET</b> scholar.google.com/citations?user=Eo3rkZcAAAAJ', `<span class="cl-ok">200 OK</span> · ${esc(total.trim())} citations · h-index ${esc(h.trim())}`] });
  think(c, ag, c.t + 1.6, `${total.trim()}. nice.`, 1.3);
  return c.t + 1.6;
};

// the bars: dragged up one year at a time, the number counting with them; then the caption
ACTS.plot = (c) => {
  const fig = c.el, ag = c.a, bars = $$('.bar', fig), cap = $('figcaption', fig);
  const k = innerWidth <= 640 ? 0.4 : 0.48;
  const H = bars.map((b) => num(b.style.getPropertyValue('--v')) * k);
  const V = bars.map((b) => num(($('.bar-value', b) || {}).textContent || '0'));
  let t = c.t;
  const years = bars.map((b) => $('.bar-year', b)), back = [...years, cap].filter(Boolean).map((el) => blank(c, t, el));
  c.call(t, () => {
    show(fig);
    fig.classList.remove('is-waiting');
    bars.forEach((b) => { const f = $('.bar-fill', b), v = $('.bar-value', b); f.style.transition = 'none'; f.style.height = '4px'; v.dataset.v = v.textContent; v.textContent = '0'; });
  });
  c.log(ag.id, 'plotting citations per year', t + 0.05);
  think(c, ag, t + 0.1, 'one bar per year.', 1.3);
  bars.forEach((b, i) => {
    const f = $('.bar-fill', b), v = $('.bar-value', b), tt = t + 0.45 + i * 0.75;
    if (years[i]) writeIn(c, null, years[i], tt - 0.3, { mode: 'type', cps: 40 });
    c.glyph(ag, 'cross', tt - 0.32);
    c.go(ag, () => { const r = c.rel(f); return { x: r.x + r.w / 2, y: r.y }; }, tt - 0.32, 0.3);
    span(ag, tt - 0.32, tt + 0.6);
    c.tween(tt, 0.6, 'inOut2', (p) => {
      f.style.height = 4 + (H[i] - 4) * p + 'px';
      v.textContent = fmt(Math.round(V[i] * p));
      const r = c.rel(f);
      ag.set(r.x + r.w / 2, r.y);
    });
  });
  t += 0.45 + bars.length * 0.75 + 0.1;
  use(ag, t);
  think(c, ag, t - 0.4, 'up and to the right.', 1.4);
  c.call(t, () => bars.forEach((b) => { const f = $('.bar-fill', b), v = $('.bar-value', b); f.style.transition = ''; f.style.height = ''; v.textContent = v.dataset.v; }));
  c.glyph(ag, 'arrow', t);
  if (cap) t = writeIn(c, ag, cap, t + 0.2, { mode: 'type', cps: 44 });
  back.forEach((r) => r(t + 0.05));
  return t + 0.1;
};

// rows of numbers with labels: each number counted and checked, each label written in
ACTS.stats = (c) => {
  const box = c.el, q = queue(c), A = agentIn(c), t0 = c.t, rows = $$(':scope > div', box);
  const E = A('eval'), W = c.who.find((g) => g !== E) || E;
  const restore = blank(c, t0, box, ':scope > div');
  c.call(t0, () => show(box));
  let end = t0;
  rows.forEach((row, i) => {
    const dd = $('dd', row), dt = $('dt', row);
    const tc = q(E, t0 + 0.1 + i * 0.1, (Ev, s) => {
      c.go(Ev, center(c, dd, 0.5, 0.3), s, 0.3);
      const e = countIn(c, dd, s + 0.3, 0.7);
      chipAt(c, s + 0.55, '✓ verified', c.color(Ev.id), () => { const b = c.rel(dd); return { x: b.x + Math.min(b.w, 70) + 8, y: b.y }; }, 0.9);
      return e;
    });
    const tl = q(W, t0 + 0.3 + i * 0.1, (Wg, s) => writeIn(c, Wg, dt, s, { mode: 'stream', wps: 12 }));
    end = Math.max(end, tc, tl);
  });
  c.log(E.id, `verified ${rows.length} numbers`, end);
  restore(end + 0.05);
  return end + 0.1;
};

// ---------------------------------------------------------------- 02 · honors
// Four cards, drawn and painted in the wireframe; every word typed in; the eval checks the Best Paper sum;
// the red-team tilts the yellow square and pushes it off; the stylist puts it back from the Transform panel.
ACTS.awards = (c) => {
  const box = c.el, cards = $$('.award', box), q = queue(c), A = agentIn(c), t0 = c.t;
  const Ws = [A('writer-2'), A('writer-3'), A('writer')], R = A('retriever'), Ev = A('eval'), Ed = A('editor'), Ss = [A('stylist'), A('stylist-2')];
  const shapes = cards.map((k) => $('.award-shape', k));
  const restore = blank(c, t0, box, '.award');
  c.call(t0, () => { shapes.forEach((s) => { if (s) s.style.opacity = '0'; }); show(box); });
  const t = t0 - 0.2;
  let end = t0;
  const SHAPES = { 'award-y': 'black circle', 'award-r': 'yellow square', 'award-b': 'three white dots', 'award-k': 'circle, square and triangle' };
  cards.forEach((card, i) => {
    const ts = t + 0.3 + i * 0.7;
    const year = $('.award-year', card), b = $('.award-stat b', card), sp = $('.award-stat span', card), h3 = $('h3', card);
    const p = [...card.querySelectorAll(':scope > p')].find((x) => !x.classList.contains('award-year') && !x.classList.contains('award-stat'));
    let te = q(R, ts, (Rr, s) => { const a = writeIn(c, Rr, year, s, { mode: 'type', cps: 22 }); return scrambleIn(c, Rr, b, a + 0.05, 0.55); });
    te = q(Ev, te - 0.1, (E, s) => writeIn(c, E, sp, s, { mode: 'type', cps: 40 }));
    const tw = ts + 0.4;
    const tp = q(q.pick(Ws, tw), tw, (W, s) => {
      const ed = Editor(c, h3);
      ed.clear(s - 0.02);
      const short = 'Talbert Abrams Award';
      let tt;
      if (ed.original.startsWith(short + ',')) {
        tt = ed.type(W, s, short, { cps: 16 });
        c.go(Ed, near(W, 40, 40), tt - 0.3, 0.45);
        bubble(c, tt + 0.15, { at: above(c, h3, 0.4, 56), who: 'editor', text: 'Which place? Say it.', life: 1.8 });
        busy(Ed, tt + 2);
        tt = ed.to(W, tt + 1.6, ed.original, { cps: 18 });
        think(c, W, tt, 'first honorable mention. there.', 1.6);
      } else tt = ed.type(W, s, ed.original, { cps: 22 });
      ed.done(tt);
      return writeIn(c, W, p, tt + 0.15, { mode: 'stream', wps: 18 });
    });
    const sh = shapes[i];
    const tsh = sh ? q(Ss[i % 2], ts + 0.2, (S, s) => {
      c.go(S, center(c, sh, 0.5, 0.5), s, 0.4);
      ripple(c, s + 0.4, center(c, sh, 0.5, 0.5), c.color(S.id));
      c.tween(s + 0.4, 0.45, 'out', (k) => { sh.style.opacity = String(k); sh.style.scale = String(0.5 + 0.5 * k); });
      c.call(s + 0.86, () => { sh.style.opacity = ''; sh.style.scale = ''; });
      const kind = [...card.classList].find((x) => SHAPES[x]);
      c.log(S.id, `placing the ${SHAPES[kind] || 'shape'}`, s + 0.4);
      return s + 0.86;
    }) : ts;
    end = Math.max(end, te, tp, tsh);
  });
  const span = $('.award-r .award-stat span', box), m = span && span.textContent.match(RATIO);
  if (m) {
    end = q(Ev, end - 0.4, (E, s) => {
      c.go(E, center(c, span, 1, 0.5), s, 0.4);
      think(c, E, s + 0.3, 'let me check that…', 1.2);
      c.log(E.id, `checking ${m[1]} of ${m[2]}`, s + 0.4);
      chipAt(c, s + 0.6, `${m[1]} ÷ ${m[2]} = ${share(num(m[1]), num(m[2]))} ✓`, c.color(E.id), () => { const bb = c.rel(span); return { x: bb.x, y: bb.y + bb.h + 8 }; }, 1.8);
      return s + 1.5;
    });
  }
  restore(end);
  return end + 0.1;
};
// The red-team tilts the yellow square and pushes it off; the stylist puts it back from the Transform panel.
ACTS.tilt = (c) => {
  const sq = c.el, A = agentIn(c), RT = A('red-team'), S = A('stylist');
  let end = c.t;
  if (sq && RT) {
    const ta = c.t + 0.1;
    c.call(ta - 0.01, () => { const v = c.view(); RT.set(v.x1 + 60, c.rel(sq).y); });
    c.go(RT, center(c, sq, 0.96, 0.96), ta, 0.6);
    think(c, RT, ta + 0.6, 'a little tilt. nobody will notice.', 1.9);
    c.log(RT.id, 'rotating the yellow square · 12° → 47°', ta + 0.7);
    use(RT, ta + 2.5);
    c.tween(ta + 0.8, 0.9, 'inOut2', (p) => {
      sq.style.rotate = 35 * p + 'deg';
      sq.style.translate = `${38 * p}px ${-22 * p}px`;
      const g = c.rel(sq);
      RT.set(g.x + g.w, g.y + g.h);
    });
    c.go(RT, () => ({ x: c.view().x1 + 80, y: RT.y - 40 }), ta + 1.9, 0.6, 'in');
    c.go(S, center(c, sq, 0.5, 0.5), ta + 2.0, 0.5);
    think(c, S, ta + 2.5, 'that square is off-spec.', 1.6);
    c.log(S.id, 'the square is off the design · fixing', ta + 2.6);
    const done = panel(c, S, ta + 2.8, { at: () => { const bb = c.rel(sq); return { x: bb.x - 210, y: bb.y + bb.h + 12 }; }, title: 'Transform · square',
      rows: [{ label: 'Rotate', from: '47°', to: '12°' }, { label: 'Offset', from: '38, −22', to: '0, 0' }], say: 'Transform ▸ Rotate 12° · Offset 0, 0' });
    c.tween(done[0], 0.45, 'inOut2', (p) => { sq.style.rotate = 35 * (1 - p) + 'deg'; });
    c.tween(done[1], 0.45, 'inOut2', (p) => { sq.style.translate = `${38 * (1 - p)}px ${-22 * (1 - p)}px`; });
    c.call(done[1] + 0.5, () => { sq.style.rotate = ''; sq.style.translate = ''; });
    chipAt(c, done[1] + 0.55, '✓ back on the design', c.color(S.id), () => { const bb = c.rel(sq); return { x: bb.x - 20, y: bb.y + bb.h + 10 }; }, 1.4);
    end = done[1] + 1.1;
  }
  return end + 0.1;
};

// a list under the cards (the two run side by side): a writer types the lines, a researcher the years,
// an eval does the sums
ACTS.honorsList = (c) => {
  const box = c.el, q = queue(c), t0 = c.t, by = (re) => c.who.find((g) => re.test(g.id));
  const W = by(/^writer/) || c.a, R = by(/^retriever|^researcher/) || W, Ev = by(/^eval/);
  const restore = blank(c, t0, box, 'h3, li');
  c.call(t0, () => show(box));
  let end = q(W, t0 + 0.1, (Wg, s) => writeIn(c, Wg, $('h3', box), s, { mode: 'type', cps: 16 }));
  if (Ev && $('.ratio', box)) think(c, Ev, t0 + 0.3, 'every ratio gets a sum.', 1.5);
  $$('.plain-list li', box).forEach((li, i) => {
    const [a, b] = li.children;
    const ta = q(W, t0 + 0.5 + i * 0.3, (Wg, s) => writeIn(c, Wg, a, s, { mode: 'type', cps: 66 }));
    const tb = b ? q(R, ta - 0.4, (Rr, s) => writeIn(c, Rr, b, s, { mode: 'type', cps: 28 })) : ta;
    const em = $('.ratio', li), m = em && em.textContent.match(RATIO);
    const tc = m && Ev ? q(Ev, ta, (E, s) => {
      c.go(E, center(c, em, 1, 0.5), s, 0.3);
      chipAt(c, s + 0.3, `${m[1]} ÷ ${m[2]} = ${share(num(m[1]), num(m[2]))} ✓`, c.color(E.id), () => { const bb = c.rel(em); return { x: bb.x + bb.w + 10, y: bb.y - 3 }; }, 1.2);
      return s + 0.85;
    }) : ta;
    end = Math.max(end, ta, tb, tc);
  });
  restore(end + 0.05);
  return end + 0.1;
};

// ---------------------------------------------------------------- 03 · papers
// Each year is a floor of its own, several building at once. Its papers are drawn in the wireframe; the
// writers type the titles (a typo now and then, caught and fixed), the retriever and the researcher look
// up the authors and the venues, the evals count the citations, the stylist puts the badges on; then
// the researcher picks out Yang Tang in each author list and sets it in bold.
const TYPO = { 'Olbedo: An': ['outdoor environments', 'outdoor enviroments'], 'Remote sensing object': ['deep learning era', 'deep learnign era'],
  'Active and low-cost': ['low-light environment', 'low-ligth environment'], 'An evaluation of PlanetScope': ['change detection', 'change detetcion'] };
ACTS.pubs = (c) => {
  const box = c.el, pubs = $$('.pub', box), q = queue(c), t0 = c.t, of = (re) => c.who.filter((g) => re.test(g.id));
  const Ws = of(/^writer/), Rs = of(/^retriever|^researcher/), Es = of(/^eval/), S = of(/^stylist/)[0], Rb = of(/^researcher/)[0] || Rs[0];
  const restore = blank(c, t0, box, '.pub');
  const badges = $$('.badge', box), names = $$('.pub-authors b', box);
  c.call(t0, () => { badges.forEach((b) => { b.style.opacity = '0'; }); names.forEach((b) => b.classList.add('cl-plain')); show(box); });
  let end = t0;
  pubs.forEach((pub, i) => {
    const title = $('.pub-title', pub), au = $('.pub-authors', pub), ve = $('.pub-venue', pub), ci = $('.pub-cites', pub);
    const want = t0 + 0.1 + i * 0.2, W = q.pick(Ws, want);
    const tt = q(W, want, (Wg, s) => {
      const ed = Editor(c, title), typo = Object.keys(TYPO).find((k) => ed.original.startsWith(k));
      ed.clear(s - 0.02);
      if (!typo || !ed.original.includes(TYPO[typo][0])) { const e = ed.type(Wg, s, ed.original, { cps: 60 }); ed.done(e); return e; }
      let e = ed.type(Wg, s, ed.original.replace(TYPO[typo][0], TYPO[typo][1]), { cps: 60 });
      think(c, Wg, e + 0.05, 'typo. hang on.', 1.1);
      e = ed.to(Wg, e + 0.6, ed.original, { cps: 20, keys: true });
      ed.done(e);
      return e;
    });
    const ta = q(Rs[i % Rs.length], tt - 0.5, (Rr, s) => { scrambleIn(c, null, ve, s + 0.15, 0.45); return scrambleIn(c, Rr, au, s, 0.5); });
    const tc = ci && ci.textContent.trim() ? q(Es[i % Es.length], tt - 0.3, (E, s) => {
      c.go(E, center(c, ci, 0.5, 0.5), s, 0.24);
      const e = countIn(c, ci, s + 0.24, 0.5);
      chipAt(c, e - 0.1, '✓', c.color(E.id), () => { const b = c.rel(ci); return { x: b.x + b.w + 8, y: b.y }; }, 0.7);
      return e;
    }) : tt;
    let tb = tc;
    $$('.badge', pub).forEach((bdg) => {
      tb = q(S || Ws[0], tt - 0.2, (Sg, s) => {
        c.go(Sg, center(c, bdg, 0.2, 0.5), s, 0.25);
        ripple(c, s + 0.25, center(c, bdg, 0.2, 0.5), c.color(Sg.id));
        c.tween(s + 0.25, 0.3, 'out', (k) => { bdg.style.opacity = String(k); bdg.style.scale = String(0.7 + 0.3 * k); });
        const e = writeIn(c, null, bdg, s + 0.25, { mode: 'type', cps: 60 });
        c.call(e + 0.05, () => { bdg.style.opacity = ''; bdg.style.scale = ''; });
        return e;
      });
    });
    end = Math.max(end, tt, ta, tc, tb);
  });
  // the name in bold, paper by paper
  if (Rb && names.length) {
    const sel = names.map(() => { const h = node(c, 'cl-sel'); h.style.opacity = 0; return h; });
    let t = q(Rb, end - 0.6, (Rr, s) => {
      c.log(Rr.id, `Yang Tang in bold · ${names.length} author list${names.length > 1 ? 's' : ''}`, s);
      if (names.length > 1) think(c, Rr, s, 'bold the name. every time.', 1.3);
      let tt = s;
      names.forEach((b, k) => {
        c.go(Rr, () => { const r = c.rel(b); return { x: r.x + r.w + 4, y: r.y + r.h * 0.55 }; }, tt, 0.3);
        tt += 0.32;
        c.call(tt, () => { const r = c.rel(b); Object.assign(sel[k].style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', background: c.color(Rr.id) + '66', opacity: 1 }); });
        tt += 0.2;
        c.call(tt, () => { b.classList.remove('cl-plain'); });
        chipAt(c, tt, '⌘B', c.color(Rr.id), () => { const r = c.rel(b); return { x: r.x + r.w + 8, y: r.y - 22 }; }, 0.6);
        c.tween(tt + 0.1, 0.25, 'out', (p) => { sel[k].style.opacity = String(1 - p); });
        tt += 0.18;
      });
      return tt + 0.1;
    });
    end = Math.max(end, t);
  }
  restore(end + 0.05);
  c.call(end + 0.05, () => { badges.forEach((b) => { b.style.opacity = ''; b.style.scale = ''; }); names.forEach((b) => b.classList.remove('cl-plain')); });
  return end + 0.1;
};
// The red-team adds a zero to the most cited paper; the eval checks Scholar and takes it off again.
ACTS.inflate = (c) => {
  const el = c.el, A = agentIn(c), RT = A('red-team'), E = A('eval'), tn = textsOf(el)[0];
  let end = c.t;
  if (RT && E && tn) {
    const real = tn.data, fake = fmt(num(real) * 10), ta = c.t + 0.1, at = () => { const b = c.rel(el); return { x: b.x + b.w + 4, y: b.y + b.h * 0.55 }; };
    const hl = node(c, 'cl-sel');
    hl.style.opacity = 0;
    c.call(ta - 0.01, () => { const v = c.view(); RT.set(v.x1 + 60, c.rel(el).y - 30); });
    c.glyph(RT, 'ibeam', ta);
    c.go(RT, at, ta, 0.6);
    think(c, RT, ta + 0.55, 'one more zero. who checks?', 1.6);
    c.log(RT.id, `citations ${real} → ${fake}`, ta + 0.8);
    [...fake].forEach((_, k) => c.call(ta + 0.8 + k * 0.08, () => { tn.data = fake.slice(0, k + 1); }));
    const tb = ta + 0.8 + fake.length * 0.08;
    c.call(tb, () => { const b = c.rel(el); Object.assign(hl.style, { left: b.x - 3 + 'px', top: b.y + 'px', width: b.w + 6 + 'px', height: b.h + 'px', background: '#ff3b3b55', opacity: 1 }); });
    c.glyph(RT, 'arrow', tb);
    c.go(RT, () => ({ x: c.view().x1 + 80, y: RT.y - 40 }), tb + 0.2, 0.6, 'in');
    c.go(E, () => { const b = c.rel(el); return { x: b.x - 10, y: b.y - 10 }; }, tb + 0.3, 0.5);
    bubble(c, tb + 0.8, { at: above(c, el, 0, 60), who: E.id, text: `${fake}? Scholar says ${real}.`, life: 1.8 });
    c.log(E.id, `checked Scholar · ${real}, not ${fake}`, tb + 0.9);
    c.call(tb + 1.9, () => { tn.data = real; hl.style.opacity = 0; });
    chipAt(c, tb + 1.95, `✓ ${real} · Scholar`, c.color(E.id), () => { const b = c.rel(el); return { x: b.x - 60, y: b.y + b.h + 6 }; }, 1.3);
    c.call(tb + 1.9, () => c.attacked());
    use(RT, tb + 0.8); use(E, tb + 2.4);
    end = tb + 2.4;
  }
  return end + 0.1;
};

// the topic filter, tried once and put back; then the note under the list
const press = (b) => $$('.filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
ACTS.filter = (c) => {
  const note2 = c.el, ag = c.a, years = $('#papers .years');   // the list of years (each its own floor)
  const btn = $('.filter button[data-filter="p"]'), all = $('.filter button[data-filter="all"]');
  const restore = blank(c, c.t, note2);
  let t = c.t;
  if (btn && all && years) {
    const color = c.color(ag.id), n = $$('#papers .pub[data-area="p"]').length;
    c.go(ag, center(c, btn, 0.5, 0.62), t, 0.45);
    c.log(ag.id, 'testing the topic filter · Photogrammetry', t + 0.1);
    think(c, ag, t + 0.1, 'does the filter work?', 1.3);
    t += 0.5;
    ripple(c, t, center(c, btn, 0.5, 0.62), color);
    c.call(t, () => { press(btn); years.classList.add('cl-dim'); });
    chipAt(c, t + 0.15, `${n} photogrammetry papers ✓`, color, () => { const b = c.rel(btn); return { x: b.x, y: b.y + b.h + 8 }; }, 1.3);
    t += 1.5;
    c.go(ag, center(c, all, 0.5, 0.62), t - 0.35, 0.35);
    ripple(c, t, center(c, all, 0.5, 0.62), color);
    c.call(t, () => { press(all); years.classList.remove('cl-dim'); });
    c.log(ag.id, 'filter back to All', t);
  }
  c.call(t + 0.1, () => show(note2));
  t = writeIn(c, ag, note2, t + 0.2, { mode: 'stream', wps: 12 });
  restore(t + 0.05);
  return t + 0.1;
};

// pills, boxed in the wireframe: the stylist puts each one down, a writer types it
ACTS.pills = (c) => {
  const box = c.el, A = agentIn(c), t0 = c.t, items = $$('button, a', box);
  const S = c.who.find((g) => g.id.startsWith('stylist')) || A('stylist'), W = c.who.find((g) => g.id.startsWith('writer')) || c.a;
  const restore = blank(c, t0, box);
  c.call(t0, () => items.forEach((x) => { x.style.opacity = '0'; }));
  let t = t0 + 0.05;
  c.call(t, () => show(box));
  items.forEach((x) => {
    c.go(S, center(c, x, 0.5, 0.5), t, 0.3);
    ripple(c, t + 0.3, center(c, x, 0.5, 0.5), c.color(S.id));
    c.tween(t + 0.3, 0.3, 'out', (k) => { x.style.opacity = String(k); x.style.scale = String(0.85 + 0.15 * k); });
    t = writeIn(c, W, x, t + 0.4, { mode: 'type', cps: 24 }) + 0.08;
  });
  think(c, S, t, 'pills. very modern.', 1.4);
  c.call(t, () => items.forEach((x) => { x.style.opacity = ''; x.style.scale = ''; }));
  restore(t + 0.05);
  return t + 0.1;
};

// ---------------------------------------------------------------- 04 · education and experience
// The two columns, drawn and painted in the wireframe: the historians add each entry, newest first, one
// column each; the red-team squeezes the columns together and the planner opens the gap again.
ACTS.cv = (c) => {
  const box = c.el, cols = $$('.cv-col', box), q = queue(c), A = agentIn(c), t0 = c.t;
  const H = [A('historian'), A('historian-2')];
  const lis = cols.map((col) => $$('.timeline li', col));
  const restore = blank(c, t0, box, '.cv-col, .timeline li');
  c.call(t0, () => { lis.flat().forEach((li) => { li.style.opacity = '0'; }); show(box); });
  const th = cols.map((col, ci) => q(H[ci] || H[0], t0 + 0.1 + ci * 0.15, (Ag, s) => writeIn(c, Ag, $('h3', col), s, { mode: 'type', cps: 14 })));
  const t = Math.min(...th);
  let end = t;
  cols.forEach((col, ci) => {
    const Hg = H[ci] || H[0];
    let tc = t;
    lis[ci].forEach((li) => {
      tc = q(Hg, tc + 0.1, (Ag, s) => {
        c.go(Ag, () => { const b = c.rel(li); return { x: b.x + 4, y: b.y + 8 }; }, s, 0.3);
        c.tween(s + 0.3, 0.3, 'out', (k) => { li.style.opacity = String(k); });
        const what = $('.t-what', li);
        c.log(Ag.id, `adding ${(what ? what.textContent : '').trim()}`, s + 0.3);
        let x = writeIn(c, Ag, $('.t-when', li), s + 0.35, { mode: 'type', cps: 34 });
        x = writeIn(c, Ag, what, x + 0.05, { mode: 'type', cps: 38 });
        ['.t-where', '.t-note'].forEach((k) => { const n = $(k, li); if (n) x = writeIn(c, Ag, n, x + 0.05, { mode: 'stream', wps: 18 }); });
        return x;
      });
    });
    end = Math.max(end, tc);
  });
  think(c, H[0], t + 0.6, 'newest first, like the papers.', 1.6);
  c.call(end, () => lis.flat().forEach((li) => { li.style.opacity = ''; }));
  restore(end + 0.05);
  return end + 0.1;
};
// The red-team squeezes the two columns together; the planner opens the gap again.
ACTS.squeeze = (c) => {
  const right2 = c.el, cols = $$('.cv-col', right2.parentElement), A = agentIn(c), RT = A('red-team'), P = A('planner');
  let end = c.t;
  if (RT && cols.length > 1) {
    const ta = c.t + 0.1;
    let dx = 0, dy = 0;
    c.call(ta - 0.01, () => {
      const v = c.view(), a = cols[0].getBoundingClientRect(), b = right2.getBoundingClientRect();
      RT.set(v.x1 + 60, c.rel(right2).y + 40);
      if (Math.abs(a.top - b.top) < 10) dx = Math.min(0, a.right - b.left - 60);   // side by side: pushed left over the other
      else dy = Math.min(0, a.bottom - b.top - 60);                             // stacked: pushed up into it
    });
    const at2 = () => { const b = c.rel(right2); return { x: b.x + 16, y: b.y + 30 }; };
    c.go(RT, at2, ta, 0.6);
    think(c, RT, ta + 0.6, 'who needs a gap?', 1.6);
    c.log(RT.id, 'squeezing the columns together', ta + 0.7);
    c.tween(ta + 0.8, 0.7, 'inOut2', (p) => { right2.style.transform = `translate(${dx * p}px, ${dy * p}px)`; const g = at2(); RT.set(g.x, g.y); });
    c.go(RT, () => ({ x: c.view().x1 + 80, y: RT.y }), ta + 1.6, 0.6, 'in');
    c.go(P, at2, ta + 1.7, 0.5);
    think(c, P, ta + 2.2, 'they overlap. gap back to 20.', 1.7);
    c.tween(ta + 2.4, 0.7, 'inOut2', (p) => { right2.style.transform = `translate(${dx * (1 - p)}px, ${dy * (1 - p)}px)`; const g = at2(); P.set(g.x, g.y); });
    c.call(ta + 3.15, () => { right2.style.transform = ''; });
    guides(c, ta + 3.15, cols, 1.2);
    use(RT, ta + 2.2); use(P, ta + 3.15);
    end = ta + 3.4;
  }
  return end + 0.1;
};

// ---------------------------------------------------------------- 05 · service
// The venues arrive shuffled; names typed, publishers looked up, impact factors counted; the librarian
// ranks them; the red-team flips the ranking upside down and the librarian flips it back; the bars grow.
ACTS.rank = (c) => {
  const box = c.el, items = $$('.venue', box), fills = $$('.venue-bar i', box), q = queue(c), A = agentIn(c), t0 = c.t;
  const L = A('librarian'), Ws = [A('writer'), A('writer-3')], Rs = [A('retriever'), A('researcher')], Es = [A('eval'), A('eval-2')];
  const restore = blank(c, t0, box, '.venue');
  const order = items.map((_, i) => i), r = rng(items.length * 31 + 7);
  for (let i = order.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  const off = scatter(c, items, t0, (i, rs) => ({ x: rs[order[i]].left - rs[i].left, y: rs[order[i]].top - rs[i].top }));
  c.call(t0, () => { fills.forEach((f) => { f.dataset.w = f.style.width; f.style.width = '0%'; }); show(box); });
  think(c, L, t0 + 0.2, 'shuffled. of course.', 1.4);
  let end = t0;
  items.forEach((v, i) => {
    const tn = q(Ws[i % 2], t0 + 0.3 + i * 0.08, (W, s) => writeIn(c, W, $('.venue-name', v), s, { mode: 'type', cps: 60 }));
    const tp = q(Rs[i % 2], tn - 0.3, (Rr, s) => scrambleIn(c, Rr, $('.venue-pub', v), s, 0.4));
    const vi = $('.venue-if', v);
    const tf = vi ? q(Es[i % 2], tn - 0.2, (E, s) => { c.go(E, center(c, vi, 0.5, 0.4), s, 0.24); writeIn(c, null, $('small', vi), s + 0.4, { mode: 'type', cps: 80 }); return countIn(c, $('b', vi), s + 0.24, 0.5); }) : tn;
    end = Math.max(end, tn, tp, tf);
  });
  c.log(L.id, `ranking ${items.length} venues by impact factor · JCR 2025`, end + 0.2);
  think(c, L, end + 0.2, 'highest impact first.', 1.5);
  end = settle(c, L, items, off, end + 0.2, { hop: 0.16, dur: 0.42 });
  fills.forEach((f, i) => c.tween(end + i * 0.07, 0.4, 'out', (p) => { f.style.width = num(f.dataset.w) * p + '%'; }));
  end += fills.length * 0.07 + 0.4;
  c.call(end, () => fills.forEach((f) => { f.style.width = f.dataset.w; }));
  restore(end + 0.05);
  return end + 0.1;
};
// The red-team turns the ranking upside down; the librarian turns it back.
ACTS.reverse = (c) => {
  const items = $$('.venue', c.el.parentElement), A = agentIn(c), RT = A('red-team'), L = A('librarian');
  let end = c.t;
  if (RT && items.length > 1) {
    const ta = c.t + 0.1, rev = [];
    c.call(ta + 0.75, () => { const rs = items.map((n) => n.getBoundingClientRect()); items.forEach((n, i) => { const j = items.length - 1 - i; rev[i] = { x: rs[j].left - rs[i].left, y: rs[j].top - rs[i].top }; }); });
    c.call(ta - 0.01, () => { const v = c.view(); RT.set(v.x1 + 60, c.rel(items[0]).y); });
    c.go(RT, center(c, items[0], 0.3, 0.3), ta, 0.6);
    think(c, RT, ta + 0.5, 'smallest first. it’s friendlier.', 1.8);
    c.log(RT.id, 'reversing the ranking', ta + 0.7);
    c.tween(ta + 0.8, 0.8, 'inOut2', (p) => items.forEach((n, i) => { const o = rev[i]; if (o) n.style.transform = `translate(${o.x * p}px, ${o.y * p}px)`; }));
    c.go(RT, () => ({ x: c.view().x1 + 80, y: RT.y }), ta + 1.7, 0.6, 'in');
    c.go(L, center(c, items[0], 0.3, 0.3), ta + 1.8, 0.5);
    think(c, L, ta + 2.3, 'nope. impact factor, descending.', 1.7);
    c.log(L.id, 'ranking restored', ta + 2.5);
    c.tween(ta + 2.5, 0.8, 'inOut2', (p) => items.forEach((n, i) => { const o = rev[i]; if (o) n.style.transform = `translate(${o.x * (1 - p)}px, ${o.y * (1 - p)}px)`; }));
    c.call(ta + 3.35, () => items.forEach((n) => { n.style.transform = ''; }));
    use(RT, ta + 2.3); use(L, ta + 3.35);
    end = ta + 3.4;
  }
  return end + 0.1;
};

// a list written in: the heading typed, each line typed (the first two agents taking turns), the years
// looked up by the last
ACTS.lines = (c) => {
  const box = c.el, q = queue(c), t0 = c.t, ws = c.who.length > 2 ? c.who.slice(0, -1) : c.who.slice(0, 1);
  const W = ws[0], W2 = ws[1] || W, R = c.who[c.who.length - 1];
  const restore = blank(c, t0, box, 'h3, li');
  c.call(t0, () => show(box));
  let end = t0;
  $$('h3', box).forEach((h) => { end = Math.max(end, q(W, t0 + 0.1, (Wg, s) => writeIn(c, Wg, h, s, { mode: 'type', cps: 20 }))); });
  $$('li', box).forEach((li, i) => {
    const [a, b] = li.children.length ? li.children : [li];
    const ta = q(i % 2 ? W2 : W, t0 + 0.4 + i * 0.25, (Wg, s) => writeIn(c, Wg, a, s, { mode: 'type', cps: 46 }));
    const tb = b ? q(R, ta - 0.3, (Rr, s) => writeIn(c, Rr, b, s, { mode: 'type', cps: 30 })) : ta;
    end = Math.max(end, ta, tb);
  });
  restore(end + 0.05);
  return end + 0.1;
};

// ---------------------------------------------------------------- the boot screen: a terminal, then the roll call
const BOOT = $('.crew-boot');
// the order the crew is called and sent out: the hero's own workers first, then the ones bound for the sections
const ORDER = ['writer', 'writer-2', 'retriever', 'eval', 'editor', 'planner', 'writer-3', 'red-team', 'guardrail', 'surveyor', 'photogrammetrist',
  'planner-2', 'painter', 'pilot', 'mechanic', 'electrician', 'skipper', 'researcher', 'eval-2', 'stylist', 'stylist-2', 'librarian', 'historian', 'historian-2'];
let skipBoot = false;
const sleep = (ms) => new Promise((res) => setTimeout(res, skipBoot ? 0 : ms / 1.2));
async function boot() {
  if (!BOOT) return;
  const log = $('.crew-boot__log', BOOT), roster = $('.crew-boot__roster', BOOT), title = $('.crew-boot__title', BOOT);
  const LINES = [['mounting survey drive', 'ok'], ['loading 2,481 aerial images', 'ok'], ['target  : tang.ninja'], ['plan    : the city first, then the page as you read it'],
    ['calibrating 3 cameras', 'ok'], ['deploying build agents', String(ORDER.length)]];
  const stop = () => { skipBoot = true; };
  const evs = ['keydown', 'pointerdown'];
  evs.forEach((e) => addEventListener(e, stop, { passive: true }));
  let done = '';
  for (const [text, end] of LINES) {
    const line = end ? `> ${text} ${'.'.repeat(Math.max(3, 36 - text.length))} ` : `> ${text}`;
    for (let i = 0; i <= line.length && !skipBoot; i += 4) { log.innerHTML = done + esc(line.slice(0, i)) + '<i></i>'; await sleep(14); }
    if (end) await sleep(110);
    done += esc(line) + (end ? `<b>${esc(end)}</b>` : '') + '\n';
    log.innerHTML = done + '<i></i>';
    await sleep(70);
  }
  log.innerHTML = done;
  // the roll call: one chip per agent, with its colour, name and job
  if (roster) {
    for (const id of ORDER) {
      const chip = document.createElement('span');
      chip.className = 'crew-chip';
      chip.dataset.id = id;
      chip.style.setProperty('--c', CREW[id]);
      chip.innerHTML = `<i></i><b>${esc(id)}</b><em>${esc(JOBS[id] || '')}</em>`;
      roster.appendChild(chip);
      requestAnimationFrame(() => chip.classList.add('is-on'));
      await sleep(34);
    }
  }
  if (title) title.classList.add('is-on');
  await sleep(800);
  evs.forEach((e) => removeEventListener(e, stop));
}
function dropBoot(now) {
  const box = $('.crew-boot');
  if (!box) return;
  if (now) { box.remove(); return; }
  box.classList.add('is-out');
  setTimeout(() => box.remove(), 420);
}

// The crew takes the stage: the terminal's black panel lifts like a shutter, and each chip of the roll call
// turns into its cursor and flies off to where it will work first; the ones bound for the sections fly on
// down the page. Replaces the engine's opening orbit.
function entrance(c) {
  const box = $('.crew-boot'), A = agentIn(c), v0 = c.view();
  const h1 = $('.hero h1'), lede = $('.hero .lede'), aff = $('.hero .aff'), idx = $('.hero-index');
  const idxOn = idx && idx.getClientRects().length;
  const at = (el, fx, fy) => (el ? center(c, el, fx, fy) : () => ({ x: c.view().x0 + 160, y: c.view().y0 + 200 }));
  const STATION = {
    writer: at(h1, 0.05, 1.3), 'writer-2': at(lede, 0.25, 1.7), retriever: at(aff, 0.5, 2.1), eval: at(h1, 0.95, 0.1),
    editor: at(lede, 0.85, -0.5), planner: idxOn ? at(idx, -0.08, 0.1) : at(h1, 1.15, 0.6), 'writer-3': idxOn ? at(idx, 0.5, 1.12) : at(aff, 0.9, 2.6),
    'red-team': at(lede, 0.72, 0.7), guardrail: at(lede, 1.0, 1.5),
    surveyor: () => cp(c, 262, 640), photogrammetrist: () => cp(c, 560, 180), 'planner-2': () => cp(c, 1180, 230), painter: () => cp(c, 1250, 330),
    pilot: () => cp(c, 760, 250), mechanic: () => cp(c, 820, 430), electrician: () => cp(c, 1090, 480), skipper: () => cp(c, 420, 610),
  };
  if (box) {
    const bg = $('.crew-boot__bg', box), fade = [$('.crew-boot__log', box), $('.crew-boot__title', box), $('.crew-boot__skip', box)].filter(Boolean);
    c.call(0, () => box.classList.add('is-open'));
    c.tween(0.02, 0.35, 'out', (p) => fade.forEach((n) => { n.style.opacity = String(1 - p); }));
    c.tween(0.05, 0.95, 'inOut2', (p) => { if (bg) bg.style.transform = `translateY(${-101 * p}%)`; });
  }
  c.log('orchestrator', `${c.crew.length} agents deployed · goal: build tang.ninja`, 0.1);
  const T = (id) => 0.32 + ORDER.indexOf(id) * 0.07, D = 0.8;
  ORDER.forEach((id, i) => {
    const ag = c.crew.find((a) => a.id === id);
    if (!ag) return;
    const chip = box && $(`.crew-chip[data-id="${id}"]`, box), t = T(id);
    let from = null, to = null, ctrl = null;
    c.call(t, () => {
      const b = chip ? c.box(chip.getBoundingClientRect()) : { x: v0.x0 + 40, y: v0.y1 - 40, w: 0, h: 0 };
      from = { x: b.x + 9, y: b.y + b.h / 2 };
      if (chip) chip.classList.add('gone');
      ag.set(from.x, from.y);
      to = STATION[id] ? STATION[id]() : { x: from.x + (i % 2 ? 40 : -40), y: c.view().y1 + 90 };
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2, dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
      const bend = (i % 2 ? 1 : -1) * Math.min(150, len * 0.3);
      ctrl = { x: mx - (dy / len) * bend, y: my + (dx / len) * bend };
    });
    c.tween(t, D, 'inOut2', (p) => {
      if (!from) return;
      const u = 1 - p;
      ag.set(u * u * from.x + 2 * u * p * ctrl.x + p * p * to.x, u * u * from.y + 2 * u * p * ctrl.y + p * p * to.y);
    });
    for (let k = 1; k <= 5; k++) {   // a trail of dots behind it
      const dot = node(c, 'cl-trail'), tk = t + (k / 6) * D;
      dot.style.setProperty('--c', CREW[id]);
      dot.style.opacity = 0;
      c.call(tk, () => { dot.style.left = ag.x + 'px'; dot.style.top = ag.y + 'px'; });
      c.tween(tk, 0.5, 'out', (p) => { dot.style.opacity = String(0.85 * (1 - p)); dot.style.transform = `translate(-50%, -50%) scale(${1 - 0.6 * p})`; });
    }
  });
  // first words
  think(c, A('writer'), T('writer') + D, 'a blank page. my favourite.', 1.6);
  think(c, A('surveyor'), T('surveyor') + D, 'boots on the quay.', 1.3);
  think(c, A('photogrammetrist'), T('photogrammetrist') + D + 0.2, '2,481 photos. let’s go.', 1.5);
  const RT = A('red-team'), GR = A('guardrail'), tR = T('red-team') + D;
  think(c, RT, tR + 0.1, 'nice page. be a shame if…', 1.5);
  think(c, GR, tR + 0.9, 'I see you, red-team.', 1.4);
  c.go(RT, () => ({ x: c.view().x1 + 90, y: RT.y - 30 }), tR + 1.8, 0.6, 'in');
  c.log('librarian', 'heading down to Papers · see you there', T('librarian') + 0.3);
  c.log('historian', 'heading down to Education and experience', T('historian') + 0.3);
  c.call(T(ORDER[ORDER.length - 1]) + D + 0.1, () => dropBoot(true));
  heroSketch(c, (id) => T(id) + D);
  return 1.35;
}

// ---------------------------------------------------------------- the wireframe
// Every floor is drawn before it is built: a pencil box round each block, edge by edge with its size
// noted, and grey bars where the lines of text will go. The boxes are inked (dashed to solid), the
// coloured ones painted, and what sits on a painted block is drawn once the paint is on. Only then does
// the content go in, to be refined and revised; at the end the floor is snapped to its grid and the
// wireframe erased. It lives in the crew's layer, follows its blocks when they move, and goes with it.
const SK_BOX = '.hero-index, .area, .impact-total, .bars, .stats > div, .award, .more-honors > div, .filter, .pub, .cv-col, .review-stats > div, .venue, .members, .contact-links a';
const SK_FILL = '.impact, .contact';   // shown before they are built, so their paint waits for the crew
const SK_TEXT = 'h1, h2, h3, .lede, .aff, .hero-index a, .area p, .area-link, .big-label, .bars figcaption, .stats dt, .award p, .plain-list li > span, .filter button, .papers-note, .pub-title, .pub-authors, .pub-venue, .t-when, .t-what, .t-where, .t-note, .review-stats dt, .service-lede, .venue-name, .venue-pub, .venues-note, .contact-mail';
const SK_STATIC = '.venue';   // slots: the cards arrive in the wrong ones and are sorted into them
const SK_LOOSE = '.area, .award, .cv-col, .stats > div, .review-stats > div, .more-honors > div';   // drawn a little off, snapped at the end
const svgEl = (tag, cls, parent) => { const n = document.createElementNS(NS, tag); if (cls) n.setAttribute('class', cls); if (parent) parent.appendChild(n); return n; };
const PENCIL = [150, 154, 163], INK = [29, 29, 31];
const Sketch = {
  all: new Map(), raf: 0,
  of(c) {
    let sk = this.all.get(c.region);
    if (!sk) {
      const svg = svgEl('svg', 'cl-sk');
      c.layer.insertBefore(svg, c.layer.firstChild);   // under the cursors, menus and notes
      sk = { region: c.region, svg, fills: svgEl('g', '', svg), bars: svgEl('g', '', svg), lines: svgEl('g', '', svg), boxes: [], barsets: [] };
      this.all.set(c.region, sk);
      if (!this.raf) this.raf = requestAnimationFrame((t) => this.tick(t));
    }
    return sk;
  },
  drop(region) { this.all.delete(region); },
  box(sk, el, opts = {}) {
    const b = { el, p: 0, dash: 1, op: 1, tag: 0, fp: 0, fop: 1, color: opts.color || null, rx: opts.rx || 0, light: !!opts.light, stat: null, statMe: !!opts.stat,
      lines: [0, 1, 2, 3].map(() => svgEl('line', 'cl-sk__l', sk.lines)), label: svgEl('text', 'cl-sk__t', sk.lines),
      fill: opts.color ? svgEl('rect', 'cl-sk__f', sk.fills) : null };
    if (b.fill) b.fill.setAttribute('fill', opts.color);
    b.label.style.fill = b.light ? 'rgba(245,245,247,0.6)' : 'rgb(120,124,133)';
    sk.boxes.push(b);
    return b;
  },
  rect(sk, b, g = sk.region.getBoundingClientRect()) {   // in the layer's coordinates
    if (b.stat) return b.stat;
    const r = b.el.getBoundingClientRect();
    return { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height };
  },
  // the four edges, each running a little past the corners as a sketch does; where the pencil is after p of them
  pen(r, p) {
    const o = 6, x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
    const E = [[x0 - o, y0, x1 + o, y0], [x1, y0 - o, x1, y1 + o], [x1 + o, y1, x0 - o, y1], [x0, y1 + o, x0, y0 - o]];
    const i = Math.min(3, Math.floor(p)), k = Math.min(1, p - i), [ax, ay, bx, by] = E[i];
    return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, E };
  },
  tick(now) {
    this.raf = 0;
    this.all.forEach((sk, region) => {
      if (!sk.svg.isConnected) { this.all.delete(region); return; }
      try { this.render(sk, now); } catch (err) { this.all.delete(region); }
    });
    if (this.all.size) this.raf = requestAnimationFrame((t) => this.tick(t));
  },
  // every rect and visibility is read first, then everything is written, so the page is laid out once a frame
  render(sk, now) {
    const g = sk.region.getBoundingClientRect();
    if (g.bottom < -300 || g.top > innerHeight + 300) return;   // nobody is looking
    const rb = sk.boxes.map((b) => (b.cleared ? null : this.rect(sk, b, g)));
    const swap = sk.boxes.map((b) => !!(b.fill && b.fop > 0 && b.fp >= 1 && b.swapOn && seen(b.swapOn)));
    const rs = sk.barsets.map((set) => (set.gone ? null : set.el.getBoundingClientRect()));
    const came = sk.barsets.map((set) => !set.shown && !set.gone && !!set.el.textContent.trim() && seen(set.el));
    sk.boxes.forEach((b, i) => {
      const r = rb[i];
      if (!r) return;
      const { E } = this.pen(r, 0), ink = 1 - b.dash;
      const col = b.light ? `rgba(245,245,247,${(0.45 + 0.5 * ink).toFixed(2)})`
        : `rgb(${PENCIL.map((v, j) => Math.round(v + (INK[j] - v) * ink)).join(',')})`;
      b.lines.forEach((l, j) => {
        const k = Math.max(0, Math.min(1, b.p - j)), [ax, ay, bx, by] = E[j];
        l.setAttribute('x1', ax); l.setAttribute('y1', ay);
        l.setAttribute('x2', ax + (bx - ax) * k); l.setAttribute('y2', ay + (by - ay) * k);
        l.style.opacity = k > 0 ? b.op : 0;
        l.style.stroke = col;
        l.style.strokeDasharray = b.dash > 0.02 ? `5 ${(4 * b.dash).toFixed(2)}` : 'none';
      });
      if (b.tag > 0) {
        b.label.textContent = `${Math.round(r.w)} × ${Math.round(r.h)}`;
        b.label.setAttribute('x', r.x + r.w); b.label.setAttribute('y', r.y - 9);
      }
      b.label.style.opacity = Math.min(b.tag, b.op);
      if (b.fill) {
        // the paint stands in for the block until the block itself shows; then the real one takes over
        if (swap[i]) b.fop = 0;
        b.fill.setAttribute('x', r.x); b.fill.setAttribute('y', r.y);
        b.fill.setAttribute('width', Math.max(0, r.w * b.fp)); b.fill.setAttribute('height', r.h);
        b.fill.setAttribute('rx', Math.min(b.rx, (r.w * b.fp) / 2));
        b.fill.style.opacity = b.fop;
      }
      if (b.op <= 0 && (!b.fill || b.fop <= 0)) b.cleared = true;
    });
    sk.barsets.forEach((set, i) => {
      const r = rs[i];
      if (!r) return;
      if (came[i]) set.shown = now;   // the words have come: the bars go
      const fade = set.shown ? Math.max(0, 1 - (now - set.shown) / 300) : 1;
      if (fade <= 0 || set.op <= 0) set.gone = true;
      set.bars.forEach((bar, j) => {
        const k = Math.max(0, Math.min(1, set.p - j));
        bar.n.setAttribute('x', r.left - g.left + bar.dx); bar.n.setAttribute('y', r.top - g.top + bar.dy);
        bar.n.setAttribute('width', Math.max(0, bar.w * k)); bar.n.setAttribute('height', bar.h);
        bar.n.style.opacity = k > 0 && !set.gone ? fade * set.op : 0;
      });
    });
  },
  // grey bars where the lines of an element's text are
  measure(sk, el, light) {
    const set = { el, p: 0, op: 1, bars: [], shown: 0 };
    const er = el.getBoundingClientRect(), rows = [];
    textsOf(el).flatMap((tn) => { const rg = document.createRange(); rg.selectNodeContents(tn); return [...rg.getClientRects()]; }).filter((q) => q.width > 2 && q.height > 2).forEach((q) => {
      const row = rows.find((w) => Math.abs(w.top - q.top) < 4);
      if (row) { row.l = Math.min(row.l, q.left); row.r = Math.max(row.r, q.right); row.h = Math.max(row.h, q.height); }
      else rows.push({ top: q.top, l: q.left, r: q.right, h: q.height });
    });
    rows.forEach((w) => {
      const n = svgEl('rect', 'cl-sk__b', sk.bars);
      n.setAttribute('rx', Math.min(5, w.h * 0.25));
      n.style.fill = light ? 'rgba(255,255,255,0.22)' : 'rgba(29,29,31,0.1)';
      const h = Math.max(4, Math.min(40, w.h * 0.5));
      set.bars.push({ n, dx: w.l - er.left, dy: w.top - er.top + (w.h - h) / 2, w: w.r - w.l, h });
    });
    sk.barsets.push(set);
    return set;
  },
};
// a block's own paint (the dark panels are kept unpainted until the crew paints them, so look underneath)
function fillOf(el) {
  const hidden = el.matches(SK_FILL) && !el.classList.contains('cl-fill');
  if (hidden) el.classList.add('cl-fill');
  const bg = getComputedStyle(el).backgroundColor;
  if (hidden) el.classList.remove('cl-fill');
  const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  const alpha = m && m[4] != null ? +m[4] : 1;
  return m && alpha > 0.02 ? { css: bg, dark: alpha >= 0.6 && (0.3 * m[1] + 0.59 * m[2] + 0.11 * m[3]) / 255 < 0.5 } : null;
}

// One agent draws a box: to its top left corner, then the four edges with the pencil, the size noted.
function drawBox(c, sk, A, el, s, opts) {
  const b = Sketch.box(sk, el, opts);
  b.by = A;
  c.glyph(A, 'cross', s - 0.1);
  c.go(A, () => { const r = Sketch.rect(sk, b); return { x: r.x - 6, y: r.y }; }, s - 0.34, 0.32);
  c.call(s, () => { if (b.statMe) { const r = b.el.getBoundingClientRect(), g = sk.region.getBoundingClientRect(); b.stat = { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height }; } });
  const d = Math.min(1.0, Math.max(0.55, (Sketch.rect(sk, b).w + Sketch.rect(sk, b).h) / 1400));
  c.tween(s, d, 'linear', (k) => { b.p = k * 4; const q = Sketch.pen(Sketch.rect(sk, b), b.p); A.set(q.x, q.y); });
  c.tween(s + d, 0.25, 'out', (k) => { b.tag = k; });
  c.tween(s + d + 0.35, 0.35, 'inOut2', (k) => { b.dash = 1 - k; });   // inked a moment later
  c.glyph(A, 'arrow', s + d + 0.02);
  use(A, s + d);
  span(A, s - 0.34, s + d + 0.05, () => { const r = Sketch.rect(sk, b); return { x: r.x - 6, y: r.y }; });
  b.drawn = s + d;
  return b;
}
// One agent paints a box: a wipe from left to right, the agent riding the edge of the paint.
function fillBox(c, sk, A, b, s) {
  c.go(A, () => { const r = Sketch.rect(sk, b); return { x: r.x + 4, y: r.y + r.h * 0.5 }; }, s - 0.3, 0.3);
  c.tween(s, 0.5, 'inOut2', (k) => { b.fp = k; const r = Sketch.rect(sk, b); A.set(r.x + r.w * k, r.y + r.h * 0.5); });
  use(A, s + 0.5);
  span(A, s - 0.3, s + 0.5, () => { const r = Sketch.rect(sk, b); return { x: r.x + 4, y: r.y + r.h * 0.5 }; });
  return s + 0.5;
}
// One agent lays the grey bars of an element's text, line by line.
function drawBars(c, sk, A, el, s, light) {
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 20, n = Math.max(1, Math.round(c.rel(el).h / lh)), d = Math.min(1.1, 0.16 * n + 0.14);
  let set = null;
  c.call(s - 0.01, () => { set = Sketch.measure(sk, el, light); });
  c.glyph(A, 'cross', s - 0.25);
  c.go(A, () => { const r = c.rel(el); return { x: r.x, y: r.y + Math.min(r.h, lh) * 0.5 }; }, s - 0.3, 0.3);
  c.tween(s, d, 'linear', (k) => {
    if (!set || !set.bars.length) return;
    set.p = k * set.bars.length;
    const j = Math.min(set.bars.length - 1, Math.floor(set.p)), bar = set.bars[j], r = el.getBoundingClientRect(), g = c.region.getBoundingClientRect();
    A.set(r.left - g.left + bar.dx + bar.w * Math.min(1, set.p - j) + 3, r.top - g.top + bar.dy + bar.h / 2);
  });
  c.glyph(A, 'arrow', s + d + 0.02);
  use(A, s + d);
  span(A, s - 0.3, s + d, () => { const r = c.rel(el); return { x: r.x, y: r.y + Math.min(r.h, lh) * 0.5 }; });
  return s + d;
}

// k contiguous runs of a list, as even as can be (empty runs fall between full ones)
const deal = (list, k) => Array.from({ length: k }, (_, i) => list.slice(Math.floor((i * list.length) / k), Math.floor(((i + 1) * list.length) / k)));

// The wireframe of a region: its blocks and texts in reading order, dealt out in runs of neighbours, one
// run per agent, so the crew spreads over the floor and draws all of it at once. The inks follow the
// pencil; the stylists paint the coloured blocks; whatever sits on a painted block is drawn once the paint
// is on; each step of the region waits for the wireframe of what it builds.
function sketchPass(c, mates, late = {}, { t0 = 0.08, only = null } = {}) {
  const region = c.region, sk = Sketch.of(c), mine = (el) => el.closest('[data-swarm]') === region;
  const laid = (el) => el.getClientRects().length && c.rel(el).w > 4 && c.rel(el).h > 4;
  const inScope = (el) => mine(el) && laid(el) && (!only || only.some((o) => o === el || o.contains(el)));
  const blocks = [...new Set([...(region.matches(`${SK_BOX}, ${SK_FILL}`) ? [region] : []), ...$$(`${SK_BOX}, ${SK_FILL}`, region)])].filter(inScope);
  const texts = $$(SK_TEXT, region).filter((el) => inScope(el) && el.textContent.trim() && !blocks.includes(el) && !$$(SK_TEXT, el).length);
  if ((!blocks.length && !texts.length) || !mates.length) return null;
  const paint = new Map();
  blocks.forEach((el) => { const f = fillOf(el); if (f) paint.set(el, f); });
  const holder = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { if (paint.has(p)) return p; if (p === region) break; } return null; };
  const dark = !!region.closest('.hero');
  const lightOn = (el) => dark || (holder(el) ? paint.get(holder(el)).dark : false);
  const order = (list) => list.map((el) => ({ el, r: c.rel(el), box: blocks.includes(el) }))
    .sort((a, b) => (Math.abs(a.r.y - b.r.y) < 6 ? a.r.x - b.r.x : a.r.y - b.r.y) || (a.box ? -1 : 1));
  const outer = order([...blocks, ...texts].filter((el) => !holder(el))), inner = order([...blocks, ...texts].filter((el) => holder(el)));
  // the blocks a little off where a sketch would put them; snapped at the end
  const loose = blocks.filter((el) => el.matches(SK_LOOSE)), rr = rng(blocks.length * 7 + texts.length + 3);
  const offs = loose.map(() => ({ x: Math.round((rr() - 0.5) * 12), y: Math.round((rr() - 0.5) * 9) }));
  if (loose.length) c.call(0.01, () => loose.forEach((el, i) => { el.style.translate = `${offs[i].x}px ${offs[i].y}px`; }));
  sk.loose = (sk.loose || []).concat(loose.map((el, i) => ({ el, o: offs[i] })));
  // the crew: whoever is here now first, those still busy upstairs take the later runs
  const now = mates.filter((a) => !late[a.id]), later = mates.filter((a) => late[a.id]).sort((a, b) => late[a.id] - late[b.id]);
  const n = outer.length + inner.length, want = Math.max(1, Math.min(10, Math.ceil(n / 2.2)));   // two or three things each
  const crew = now.slice(0, want), trades = [...new Set(mates.map((a) => tradeOf(a.id)))].filter((tr) => !NOHELP.test(tr));
  for (let i = 0; crew.length < want && trades.length && i < want * 2; i++) {   // short of hands: call in helpers
    const base = mates.find((a) => tradeOf(a.id) === trades[i % trades.length]), h = helperFor(c, base, 0, crew);
    if (h && !crew.includes(h)) crew.push(h);
  }
  later.forEach((a) => { if (crew.length < want) crew.push(a); });   // still short: those still busy upstairs, when free
  const q = queue(c), doneAt = new Map(), boxes = new Map(), startOf = (A, k) => Math.max(t0 + k * 0.07, late[A.id] ? late[A.id] + 0.25 : 0);
  const job = (it, after = 0) => (Ag, s) => {
    s = Math.max(s, after);
    if (!it.box) { const e = drawBars(c, sk, Ag, it.el, s, lightOn(it.el)); doneAt.set(it.el, e); return e; }
    const f = paint.get(it.el), rx = parseFloat(getComputedStyle(it.el).borderTopLeftRadius) || 0;
    const b = drawBox(c, sk, Ag, it.el, s, { color: f && f.css, rx, light: lightOn(it.el), stat: it.el.matches(SK_STATIC) });
    boxes.set(it.el, b);
    doneAt.set(it.el, b.drawn);
    return b.drawn;
  };
  // 1 · the blocks and texts on the page itself
  deal(outer, crew.length).forEach((run, k) => { let t = startOf(crew[k], k); run.forEach((it) => { t = q(crew[k], t, job(it)) + 0.05; }); });
  // 2 · the paint, once the ink is on, by the stylists (or whoever drew the box)
  const painters = c.crew.filter((a) => /^stylist|^painter/.test(a.id) && !late[a.id]);
  const painted = new Map(), hands = new Set(crew);
  const paintAll = () => boxes.forEach((b, el) => {
    if (!b.fill || painted.has(el)) return;
    const want = b.drawn + 0.7, P = q.pick([...painters, b.by], want);
    const e = q(P, want, (Ag, s) => fillBox(c, sk, Ag, b, s));
    hands.add(P);
    painted.set(el, e);
    if (el.matches(SK_FILL)) c.call(e, () => { el.classList.add('cl-fill'); b.fop = 0; });
    else b.swapOn = el;
    doneAt.set(el, Math.max(doneAt.get(el) || 0, e));
  });
  paintAll();
  // 3 · what sits on a painted block, once the paint is on (its own boxes painted in turn)
  deal(inner, crew.length).forEach((run, k) => {
    let t = startOf(crew[k], k);
    run.forEach((it) => { t = q(crew[k], t, job(it, painted.get(holder(it.el)) || 0)) + 0.05; });
  });
  paintAll();
  // every step of the region waits for the wireframe of what it builds (or of what it sits in)
  $$('[data-swarm-step]', region).filter(mine).forEach((step) => {
    let t = 0;
    doneAt.forEach((e, el) => { if (step === el || step.contains(el) || el.contains(step)) t = Math.max(t, e); });
    if (t) c.wait(step, t + 0.12);
  });
  sk.crew = (sk.crew || []).concat([...hands].filter((a) => !(sk.crew || []).includes(a)));
  return { crew: [...hands], end: Math.max(0, ...doneAt.values()) };
}

// The hero's own wireframe, in white on the night sky: each writer lays the bars of the line it will
// write as it reaches its place, the planner boxes the section index and writer-3 its lines.
function heroSketch(c, T) {
  const A = agentIn(c), sk = Sketch.of(c), h1 = $('.hero h1'), lede = $('.hero .lede'), aff = $('.hero .aff'), idx = $('.hero-index');
  const wait = new Map(), mark = (step, e) => wait.set(step, Math.max(wait.get(step) || 0, e));
  [[A('writer'), h1], [A('writer-2'), lede], [A('retriever'), aff]].forEach(([W, el]) => { if (W && el) mark(el, drawBars(c, sk, W, el, T(W.id) + 0.15, true)); });
  if (idx && idx.getClientRects().length) {
    const P = A('planner'), W3 = A('writer-3');
    if (P) { const b = drawBox(c, sk, P, idx, T(P.id) + 0.12, { light: true }); mark(idx, b.drawn + 0.7); }
    if (W3) { let t = T(W3.id) + 0.15; $$('a', idx).forEach((a) => { t = drawBars(c, sk, W3, a, t, true) + 0.05; }); mark(idx, t); }
  }
  wait.forEach((e, el) => c.wait(el, e + 0.12));
}

// The crew arriving at a floor: whoever is on a floor still being built comes over from there when it is
// free (late, seconds), its cursor carried across; the others come in from the side of the screen. Each
// goes straight to its run of the wireframe; anyone with nothing to draw steps off the screen until an act
// needs it, so nobody waits about in a crowd.
const HELLO = {
  research: ['writer', 'section one. no pressure.'], honors: ['planner', 'careful. these are awards.'],
  papers: ['editor', () => `${$$('#papers .pub').length} papers. bring coffee.`], cv: ['historian', 'let’s start at the start.'],
  service: ['librarian', 'impact factors. my favourite.'], contact: ['writer', 'top floor! well, bottom.'],
};
function arrival(c, first, late = {}) {
  const v = c.view(), mates = c.crew.filter((a) => a.id !== 'red-team');
  // the floor keeps its finished height while its words are emptied and typed back, so nothing below moves
  c.region.style.minHeight = c.region.getBoundingClientRect().height + 'px';
  c.crew.forEach((a) => { if (late[a.id]) LATE.set(a, late[a.id] + 0.3); });
  const b0 = c.rel(first), mid = Math.max(v.y0 + 60, Math.min(v.y1 - 60, b0.y + 40));
  mates.forEach((a, i) => a.set(i % 2 ? v.x1 + 50 : v.x0 - 160, mid + (i % 5) * 26));   // out of sight, name tag and all
  mates.forEach((a) => c.call(late[a.id] || 0, () => {
    const p = c.takeOver(a.id), g = c.region.getBoundingClientRect();
    if (p) a.set(p.x - g.left, p.y - g.top);
  }));
  const rt = c.crew.find((a) => a.id === 'red-team');
  if (rt) {
    rt.set(v.x1 + 90, b0.y);
    c.call(late['red-team'] || 0.02, () => c.takeOver('red-team'));
  }
  const pass = sketchPass(c, mates, late), drawing = new Set(pass ? pass.crew : []);
  mates.filter((a) => !drawing.has(a)).forEach((a, i) => c.go(a, () => {
    const w = c.view();
    return { x: a.x < (w.x0 + w.x1) / 2 ? w.x0 - 160 : w.x1 + 50, y: a.y };
  }, (late[a.id] || 0) + 0.05 + i * 0.04, 0.7, 'in'));
  const key = c.region.id || (c.region.classList.contains('impact') ? 'impact' : '');
  const hi = key === 'impact' ? ['researcher', 'numbers time.'] : HELLO[key];
  const ag = hi && c.crew.find((a) => a.id === hi[0]);
  if (ag && drawing.has(ag)) think(c, ag, Math.max(0.9, (late[ag.id] || 0) + 0.9), typeof hi[1] === 'function' ? hi[1]() : hi[1], 1.6);
}

// The end of a floor: the blocks drawn a little off are snapped onto their grid, then the wireframe is
// erased, box by box, by whoever is free (one agent for a few boxes, up to three for many). Returns when
// it is gone.
function finale(c, end) {
  const sk = Sketch.all.get(c.region);
  if (!sk || (!sk.boxes.length && !sk.barsets.length)) return end;
  const crew = c.crew.filter((a) => a.id !== 'red-team' && !a.gone), free = (a) => Math.max(USE.get(a) || 0, LATE.get(a) || 0);
  if (!crew.length) return end;
  const order = (re, t) => [...crew].sort((a, b) => (re.test(b.id) - re.test(a.id)) || (Math.max(t, free(a)) - Math.max(t, free(b))));
  let t = end + 0.15;
  if (sk.loose && sk.loose.length) {
    const P = order(/^planner|^stylist/, t)[0], els = sk.loose.map(({ el }) => el);
    c.go(P, () => { const r = c.rel(els[0]); return { x: r.x - 10, y: r.y - 16 }; }, t - 0.35, 0.35);
    c.log(P.id, `Align ▸ snap ${els.length} blocks to the grid`, t);
    think(c, P, t, 'snap to grid.', 1.1);
    c.tween(t + 0.1, 0.45, 'inOut2', (k) => sk.loose.forEach(({ el, o }) => { el.style.translate = `${o.x * (1 - k)}px ${o.y * (1 - k)}px`; }));
    c.call(t + 0.57, () => sk.loose.forEach(({ el }) => { el.style.translate = ''; }));
    guides(c, t + 0.55, els, 1.1);
    use(P, t + 0.6);
    span(P, t - 0.35, t + 0.6);
    t += 0.7;
  }
  const boxes = [...sk.boxes].sort((a, b) => Sketch.rect(sk, a).y - Sketch.rect(sk, b).y || Sketch.rect(sk, a).x - Sketch.rect(sk, b).x);
  const k = Math.max(1, Math.min(3, Math.ceil(boxes.length / 6))), Es = order(/^editor|^stylist|^planner/, t).slice(0, k);
  let te = t;
  deal(boxes, Es.length).forEach((run, i) => {
    const E = Es[i], hop = Math.max(0.08, Math.min(0.16, 1.8 / Math.max(1, run.length)));
    let ti = Math.max(t, free(E)) + 0.1 + i * 0.12;
    if (!run.length) return;
    c.glyph(E, 'cross', ti - hop);
    if (i === 0) { c.log(E.id, `erasing the wireframe · ${boxes.length} box${boxes.length > 1 ? 'es' : ''}`, ti); think(c, E, ti, 'clean up.', 1.1); }
    const t0e = ti - hop;
    run.forEach((b) => {
      ti += hop;
      c.go(E, () => { const r = Sketch.rect(sk, b); return { x: r.x + r.w * 0.5, y: r.y }; }, ti - hop, hop);
      c.tween(ti, 0.3, 'out', (p) => { b.op = 1 - p; });
    });
    span(E, t0e, ti + 0.3, () => { const r = Sketch.rect(sk, run[0]); return { x: r.x + r.w * 0.5, y: r.y }; });
    c.glyph(E, 'arrow', ti + 0.3);
    use(E, ti + 0.3);
    te = Math.max(te, ti + 0.3);
  });
  c.call(te, () => sk.barsets.forEach((set) => { set.op = 0; }));
  return te;
}

// Where a floor may start: the hero first; then where the visitor is: the first floor once the page has
// been scrolled to it, the others once their top is on the screen and within 1.3 screens of the top of
// the highest floor still being built, so what is on the screen builds at once and the rest waits for
// the floors above. Scrolling never changes the pace: nothing is finished early, nothing waits longer.
function ownBox(r) {
  const mine = $$('[data-swarm-step]', r).filter((el) => el.closest('[data-swarm]') === r && el.getClientRects().length);
  if (!mine.length) { const g = r.getBoundingClientRect(); return { top: g.top, bottom: g.bottom }; }
  const rs = mine.map((el) => el.getBoundingClientRect());
  return { top: Math.min(...rs.map((q) => q.top)), bottom: Math.max(...rs.map((q) => q.bottom)) };
}
function canStart(r, building) {
  const rs = $$('[data-swarm]');
  if (!rs[0].classList.contains('swarm-done')) return false;
  const vh = innerHeight, b = ownBox(r);
  if (b.top > vh * (r === rs[1] ? 0.6 : 0.92)) return false;   // not reached yet
  const up = building.filter((x) => x !== rs[0]);
  return !up.length || b.top - Math.min(...up.map((x) => ownBox(x).top)) < vh * 1.3;
}

const seen = (el) => (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : !!el.getClientRects().length);
const ease2 = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
// legs of a walk: { to (point or function), d (ms), hold (ms), then (called when it gets there) }
function walk(from, legs, t0) {
  let start = t0, fx = from.x, fy = from.y, i = 0;
  return {
    at(now) {
      while (i < legs.length) {
        const L = legs[i];
        if (!L.q) L.q = typeof L.to === 'function' ? L.to() : L.to;
        if (!L.q) return null;
        const k = (now - start) / L.d;
        if (k < 1) return { x: fx + (L.q.x - fx) * ease2(Math.max(0, k)), y: fy + (L.q.y - fy) * ease2(Math.max(0, k)) };
        if (L.then) { L.then(); L.then = null; }
        if (now - start < L.d + (L.hold || 0)) return L.q;
        start += L.d + (L.hold || 0); fx = L.q.x; fy = L.q.y; i++;
      }
      return null;
    },
  };
}
// Nobody waits where the visitor can see it (the user's rule): an agent the script has left alone for a
// moment heads for its next job if that comes within a few seconds, and otherwise leaves the screen by
// the nearest side, to fly back in when the script next needs it. Runs outside the timeline, since it
// changes nothing on the page; the script's next move starts from wherever the agent is.
const Idle = {
  runs: new Map(), raf: 0,
  start(c) {
    this.runs.set(c.region, { c, st: new Map() });
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.tick(t));
  },
  stop(region) { this.runs.delete(region); },
  tick(now) {
    this.raf = 0;
    this.runs.forEach((run) => { try { this.step(run, now); } catch (err) { this.runs.delete(run.c.region); } });
    if (this.runs.size) this.raf = requestAnimationFrame((t) => this.tick(t));
  },
  step(run, now) {
    const { c } = run;
    if (!c.region.classList.contains('sb-host')) return;
    const v = c.view(), t = c.now(), k = Math.max(0.1, c.scale());
    for (const a of c.crew) {
      if (a.id === 'red-team' || a.gone) continue;   // the red-team keeps out of sight on its own
      let s = run.st.get(a);
      if (!s) { s = { lx: a.x, ly: a.y, still: now, beh: null, sx: NaN, sy: NaN }; run.st.set(a, s); }
      if ((a.x !== s.lx || a.y !== s.ly) && !(s.beh && a.x === s.sx && a.y === s.sy)) { s.beh = null; s.still = now; }   // the script moved it
      s.lx = a.x; s.ly = a.y;
      if (!s.beh) {
        const on = a.x > v.x0 - 12 && a.x < v.x1 + 12 && a.y > v.y0 - 12 && a.y < v.y1 + 12;
        if (!on || now - s.still < 350) continue;
        const sp = spansOf(a);
        if (sp.some((x) => t >= x.t0 - 0.05 && t <= x.t1 + 0.3)) continue;   // at work, or just between two moves
        const next = sp.find((x) => x.t0 > t), wait = next ? (next.t0 - t) / k : Infinity;
        if (wait <= 0.9) continue;   // about to start
        if (wait <= 3) {
          // its next job is near: head for the place it moves to next and be ready (a word or a look comes where it is)
          const nx = sp.find((x) => x.t0 > t && x.to && (x.t0 - t) / k <= 3);
          let to = null;
          if (nx) { try { to = typeof nx.to === 'function' ? nx.to() : nx.to; } catch (err) { to = null; } }
          if (!to || (Math.abs(to.x - a.x) < 30 && Math.abs(to.y - a.y) < 30)) { s.still = now; continue; }
          const d = Math.max(350, Math.min(1100, ((nx.t0 - t) / k - 0.35) * 1000));
          s.beh = walk({ x: a.x, y: a.y }, [{ to: { x: to.x - 18, y: to.y - 14 }, d, hold: 60000 }], now);
        } else {
          // nothing for a while: off the screen by the nearest side
          const left = a.x - v.x0 < (v.x1 - v.x0) / 2, dest = { x: left ? v.x0 - 160 : v.x1 + 50, y: Math.max(v.y0 + 20, Math.min(v.y1 - 20, a.y)) };
          s.beh = walk({ x: a.x, y: a.y }, [{ to: dest, d: 650 + Math.abs(dest.x - a.x) * 0.25 }], now);
        }
      }
      const p = s.beh.at(now);
      if (!p) { s.beh = null; s.still = now; continue; }
      a.set(p.x, p.y);
      s.sx = a.x; s.sy = a.y; s.lx = a.x; s.ly = a.y;
    }
  },
};

// ---------------------------------------------------------------- running it, Skip and replay
let heroStarted = false;
const swarm = swarmBuild({
  crew: CREW, waitForCrew: false, acts: Object.fromEntries(Object.entries(ACTS).map(([k, f]) => [k, (c) => {
    c.who = c.who.map((g) => {
      if (!busyAt(g, c.t)) return g;
      const h = helperFor(c, g, c.t);
      if (!h) return g;
      (c.sub = c.sub || new Map()).set(g.id, h);
      return h;
    });
    c.a = c.who[0] || c.a;
    c.t = Math.max(c.t, ...c.who.map((g) => Math.max(BUSY.get(g) || 0, LATE.get(g) || 0)));
    instrument(c);
    const e = f(c);
    c.who.forEach((g) => busy(g, +e || 0));
    return e;
  }])),
  entrance, arrival, canStart, speed: 1.2, pace: 1.6, gap: 0.3, traceDots: true,
  useOf: (ag) => USE.get(ag) || 0,
  planned: (c, { end }) => { Idle.start(c); return finale(c, end); },
  ffEvents: ['keydown', 'click'],
  onRegionStart: (region) => {
    if (region.matches('.hero')) heroStarted = true; else if (!heroStarted) dropBoot();
  },
  onRegionEnd: (region) => {
    HELPERS.forEach((r, id) => { if (r === region) HELPERS.delete(id); });
    region.style.minHeight = '';
    Idle.stop(region);
    Sketch.drop(region);
    if (region.matches('.hero')) { finishScene(); dropBoot(true); lock(false); }   // the city is done: scroll on
    for (let i = RESTORE.length - 1; i >= 0; i--) if (RESTORE[i].region === region) { RESTORE[i].put(); RESTORE.splice(i, 1); }
    $$(SK_FILL, region).concat(region.matches(SK_FILL) ? [region] : []).forEach((el) => el.classList.add('cl-fill'));
    if ($$('[data-swarm]').every((r) => r.classList.contains('swarm-done'))) skipButton(false);
  },
});

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

// every move an act makes marks its agent as needed until then, and as at work while it makes it
function instrument(c) {
  const { go, follow, frame, glyph, log } = c;
  c.log = (who, msg, at) => log((c.sub && c.sub.get(who) && c.sub.get(who).id) || who, msg, at);
  c.go = (ag, to, at, d = 0.45, ease) => { use(ag, at + d); span(ag, at, at + d, to); go(ag, to, at, d, ease); };
  c.follow = (ag, to, at, d) => { use(ag, at + d); span(ag, at, at + d, to); follow(ag, to, at, d); };
  c.frame = (ag, n, at, d = 0.42) => { use(ag, at + d * c.P + 0.6); span(ag, at - 0.35, at + d * c.P + 0.3, () => { const r = c.rel(n); return { x: r.x, y: r.y }; }); return frame(ag, n, at, d); };
  c.glyph = (ag, g, at) => { use(ag, at); span(ag, at, at); glyph(ag, g, at); };
}

// The page holds still while the boot and the hero are being built (the user's rule): no wheel, trackpad,
// keys or touch scrolling until the hero is done, the visitor skips, or something goes wrong. The class is
// set in the page's head before anything paints; on phones touch scrolling is stopped here as well.
const holdStill = (e) => { if (e.cancelable) e.preventDefault(); };
function lock(on) {
  root.classList.toggle('cl-lock', on);
  if (on) addEventListener('touchmove', holdStill, { passive: false });
  else removeEventListener('touchmove', holdStill, { passive: false });
}

// stop the build for good and show the page as it is
function stopAll() {
  skipBoot = true;
  lock(false);
  swarm.stop();
  $$('[data-swarm]').forEach((r) => { r.style.minHeight = ''; });
  HELPERS.clear();
  finishScene();
  dropBoot(true);
  $$(SK_FILL).forEach((el) => el.classList.add('cl-fill'));
  skipButton(false);
}

let skipEl = null;
function skipButton(on) {
  if (on && !skipEl) {
    skipEl = document.createElement('button');
    skipEl.type = 'button';
    skipEl.className = 'crew-skip';
    skipEl.innerHTML = 'Skip the build <span aria-hidden="true">▸▸</span>';
    skipEl.addEventListener('click', stopAll);
    document.body.appendChild(skipEl);
    requestAnimationFrame(() => skipEl && skipEl.classList.add('is-on'));
  } else if (!on && skipEl) {
    const el = skipEl;
    skipEl = null;
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 300);
  }
}

(async () => {
  try {
    // what this screen does not show (the section index on phones) is left out, so no one works on it
    for (const el of $$('[data-swarm-step]')) if (!el.getClientRects().length) el.removeAttribute('data-swarm-step');
    const again = $('.crew-replay');
    if (again) { again.hidden = false; again.addEventListener('click', () => swarm.replay()); }
    if (!swarm.active) { lock(false); dropBoot(true); swarm.start(); return; }
    lock(true);
    scrollTo(0, 0);   // always from the top
    skipButton(true);
    // a link to a part of the page that is not built yet: stop building and go there
    addEventListener('click', (e) => {
      if (swarm.stopped || !skipEl) return;
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      const to = a && document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (to && !to.closest('.hero')) stopAll();
    }, true);
    // the floors start where the visitor is: ask again as they scroll (and now and then, as things move)
    let ask = 0;
    addEventListener('scroll', () => { if (!ask) ask = requestAnimationFrame(() => { ask = 0; swarm.poke(); }); }, { passive: true });
    const tick = setInterval(() => { if (swarm.stopped || !skipEl) clearInterval(tick); else swarm.poke(); }, 500);
    const clouds = Promise.race([Cloud.load(), new Promise((res) => setTimeout(res, 2500))]);
    await boot();
    await clouds;
    if (swarm.stopped) return;
    swarm.start();
    setTimeout(() => { if (!heroStarted) dropBoot(); }, 4000);   // the hero is not in view (it always is, but still)
  } catch (err) {
    console.error('[crew]', err);
    lock(false);
    $$('[data-swarm]').forEach((r) => { r.style.minHeight = ''; });
    try { swarm.stop(); } catch (e) { /* nothing left to stop */ }
    dropBoot(true);
    $$(SK_FILL).forEach((el) => el.classList.add('cl-fill'));
  }
})();
