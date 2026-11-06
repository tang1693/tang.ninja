// tang.ninja: the build crew. On the first visit of a browser session a cast of labelled agent cursors
// builds the page in front of the visitor, each with a job and a mind of its own. A boot terminal calls
// the roll and sends each one out to work. The hero city is rebuilt like a photogrammetry job (control
// points, aligned cameras, a point cloud, a mesh, textures, lights) and its characters are brought to
// life through menus. Text is typed, reviewed, revised and typed again; cards arrive in a heap and are
// laid out; a red-team agent keeps trying to break things and someone always puts them right. The page
// is built floor by floor, like a house: nothing below the floor being built can be scrolled to.
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
// the region's own agent of that name, or the act's first one
const agentIn = (c) => (n) => c.crew.find((a) => a.id === n) || c.a;

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


// What an agent is thinking, in a small bubble that rides along with it.
function think(c, ag, t, text, life = 1.8) {
  if (!ag) return;
  const n = node(c, 'cl-think', esc(text));
  n.style.setProperty('--c', c.color(ag.id));
  n.style.opacity = 0;
  let w = 0;
  c.tween(t, life, 'linear', (k) => {
    if (!w) w = n.offsetWidth || 120;
    const v = c.view(), flip = ag.x + 16 + w > v.x1 - 8;   // near the right edge: think on the left
    n.classList.toggle('is-left', flip);
    n.style.left = (flip ? ag.x - 10 - w : ag.x + 16) + 'px';
    n.style.top = Math.max(v.y0 + 6, ag.y - 36) + 'px';
    n.style.opacity = String(Math.max(0, Math.min(1, (k * life) / 0.15, ((1 - k) * life) / 0.25)));
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
  if (ag) c.glyph(ag, 'arrow', tt + 0.1);
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

// When each agent is next free, across the acts of its region (agents are the region's own objects).
const BUSY = new WeakMap();
const busy = (ag, t) => { if (ag) BUSY.set(ag, Math.max(BUSY.get(ag) || 0, t)); };
// Each agent works through its own jobs in order: q(agent, wanted start, job) runs the job when the
// agent is next free and returns when it ends; q.pick(agents, t) is whichever of them is free first.
function queue() {
  const free = new Map(), when = (ag) => Math.max(free.get(ag) || 0, BUSY.get(ag) || 0);
  const q = (ag, t, job) => {
    if (!ag) return t;
    const s = Math.max(t, when(ag)), e = job(ag, s);
    free.set(ag, e + 0.08);
    busy(ag, e + 0.08);
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
  aside(c, c.who.filter((g) => g.id !== 'red-team'), ed.el, t + 0.1);
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
// typed in, no story
ACTS.type = (c) => {
  const restore = blank(c, c.t, c.el);
  c.call(c.t, () => show(c.el));
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

// the hero's section index: framed by the planner, then typed in line by line
ACTS.index = (c) => {
  const nav = c.el, A = agentIn(c), P = A('planner'), W = A('writer-3'), links = $$('a', nav);
  const restore = blank(c, c.t, nav, 'ol', true);
  c.log(P.id, 'frame · section index', c.t);
  let t = c.frame(P, nav, c.t + 0.55);
  c.call(t, () => show(nav));
  think(c, P, t, `${links.length} sections. one index.`, 1.5);
  links.forEach((a) => { t = writeIn(c, W, a, t + 0.08, { mode: 'type', cps: 34 }); });
  restore(t + 0.05);
  return t + 0.1;
};

// ---------------------------------------------------------------- 01 · research
// The three cards land in a heap; the planner lays them out in a row; the stylists insert their shapes,
// the writers fill them in, and the red-team turns the triangle upside down until a stylist turns it back.
ACTS.cards = (c) => {
  const box = c.el, cards = $$('.area', box), q = queue(), A = agentIn(c), t0 = c.t;
  const P = A('planner'), Ws = [A('writer-2'), A('writer-3'), A('writer')], Ss = [A('stylist'), A('stylist-2')], R = A('retriever'), E = A('eval'), RT = A('red-team');
  const shapes = cards.map((k) => $('.area-shape', k));
  const restore = blank(c, t0, box, '.area');
  const off = scatter(c, cards, t0, (i, rs) => ({ x: rs[0].left - rs[i].left + i * 18, y: rs[0].top - rs[i].top + i * 14, r: [-6, 4, -2][i] || 0, s: 0.92 }));
  c.call(t0, () => { shapes.forEach((s) => { if (s) s.style.opacity = '0'; }); show(box); });
  think(c, P, t0 + 0.1, 'a heap. let’s fix that.', 1.6);
  const row = innerWidth > 1000;
  let t = menu(c, P, t0 + 0.5, { at: () => { const b = c.rel(cards[0]); return { x: b.x + b.w * 0.45, y: b.y + 60 }; }, title: 'Auto layout',
    items: [{ label: 'Stack', key: '⌥S' }, { label: 'Row · 3 columns', key: '⌥R' }, { label: 'Grid · 2 columns', key: '⌥G' }], pick: row ? 1 : 0,
    say: row ? 'Auto layout ▸ Row · 3 columns · gap 20' : 'Auto layout ▸ Stack · gap 20' }).hit;
  t = settle(c, P, cards, off, t + 0.1, { hop: 0.3 });
  guides(c, t, cards);
  think(c, P, t + 0.1, 'room to breathe.', 1.4);
  const NAMES = ['Triangle', 'Square', 'Circle'], COLORS = ['yellow', 'red', 'blue'];
  let end = t;
  cards.forEach((card, i) => {
    const k = card.classList.contains('area-p') ? 0 : card.classList.contains('area-r') ? 1 : 2, s = shapes[i];
    if (s) {
      end = Math.max(end, q(Ss[i % 2], t + 0.2 + i * 0.6, (S, ts) => {
        const m = menu(c, S, ts, { at: center(c, card, 0.55, 0.16), title: 'Insert shape', move: 0.45,
          items: [{ label: '▲  Triangle', key: '⇧T' }, { label: '■  Square', key: '⇧S' }, { label: '●  Circle', key: '⇧C' }], pick: k,
          say: `Insert ▸ ${NAMES[k]} · Bauhaus ${COLORS[k]}` });
        c.tween(m.hit + 0.1, 0.5, 'out', (p) => { s.style.opacity = String(p); s.style.scale = String(0.55 + 0.45 * p); });
        c.call(m.hit + 0.62, () => { s.style.opacity = ''; s.style.scale = ''; });
        return m.hit + 0.62;
      }));
    }
    const h3 = $('h3', card), p = $('p', card), link = $('.area-link', card), tw = t + 0.6 + i * 0.5;
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
  const tri = shapes[cards.findIndex((k) => k.classList.contains('area-p'))];
  if (tri && RT) {
    const ta = end + 0.3, S = Ss[0];
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
    end = ta + 3.3;
  }
  restore(end + 0.05);
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
    c.tween(tt, 0.6, 'inOut2', (p) => {
      f.style.height = 4 + (H[i] - 4) * p + 'px';
      v.textContent = fmt(Math.round(V[i] * p));
      const r = c.rel(f);
      ag.set(r.x + r.w / 2, r.y);
    });
  });
  t += 0.45 + bars.length * 0.75 + 0.1;
  think(c, ag, t - 0.4, 'up and to the right.', 1.4);
  c.call(t, () => bars.forEach((b) => { const f = $('.bar-fill', b), v = $('.bar-value', b); f.style.transition = ''; f.style.height = ''; v.textContent = v.dataset.v; }));
  c.glyph(ag, 'arrow', t);
  if (cap) t = writeIn(c, ag, cap, t + 0.2, { mode: 'type', cps: 44 });
  back.forEach((r) => r(t + 0.05));
  return t + 0.1;
};

// rows of numbers with labels: each number counted and checked, each label written in
ACTS.stats = (c) => {
  const box = c.el, q = queue(), A = agentIn(c), t0 = c.t, rows = $$(':scope > div', box);
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
// Four cards in a heap, laid out 2 × 2; every word typed in; the eval checks the Best Paper sum; the
// red-team tilts the yellow square and pushes it off; the stylist puts it back from the Transform panel.
ACTS.awards = (c) => {
  const box = c.el, cards = $$('.award', box), q = queue(), A = agentIn(c), t0 = c.t;
  const P = A('planner'), P2 = A('planner-2'), Ws = [A('writer-2'), A('writer-3'), A('writer')], R = A('retriever'), Ev = A('eval'), Ed = A('editor'), Ss = [A('stylist'), A('stylist-2')];
  const shapes = cards.map((k) => $('.award-shape', k));
  const restore = blank(c, t0, box, '.award');
  const off = scatter(c, cards, t0, (i, rs) => ({ x: rs[0].left - rs[i].left + i * 20, y: rs[0].top - rs[i].top + i * 16, r: [-7, 5, -3, 8][i] || 0, s: 0.9 }));
  c.call(t0, () => { shapes.forEach((s) => { if (s) s.style.opacity = '0'; }); show(box); });
  think(c, P, t0 + 0.1, 'four awards, one pile.', 1.6);
  const grid = innerWidth > 1000;
  let t = menu(c, P, t0 + 0.5, { at: () => { const b = c.rel(cards[0]); return { x: b.x + b.w * 0.4, y: b.y + 70 }; }, title: 'Auto layout',
    items: [{ label: 'Stack', key: '⌥S' }, { label: 'Row', key: '⌥R' }, { label: 'Grid · 2 × 2', key: '⌥G' }], pick: grid ? 2 : 0,
    say: grid ? 'Auto layout ▸ Grid · 2 × 2 · gap 20' : 'Auto layout ▸ Stack · gap 20' }).hit;
  t = settle(c, P, cards, off, t + 0.1, { hop: 0.32 });
  guides(c, t, cards, 1.7);
  think(c, P2, t + 0.2, '20 all round. even.', 1.5);
  let end = t;
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

// the lists under the cards: the writers type the lines, the retriever the years, the eval-2 does the sums
ACTS.honorsList = (c) => {
  const box = c.el, q = queue(), A = agentIn(c), t0 = c.t;
  const Ws = [A('writer'), A('writer-2'), A('writer-3')], R = A('retriever'), Ev = A('eval-2');
  const restore = blank(c, t0, box, 'h3, li');
  c.call(t0, () => show(box));
  let end = t0;
  $$('h3', box).forEach((h, i) => { end = Math.max(end, q(Ws[i], t0 + 0.1 + i * 0.3, (W, s) => writeIn(c, W, h, s, { mode: 'type', cps: 16 }))); });
  think(c, Ev, t0 + 0.3, 'every ratio gets a sum.', 1.5);
  $$('.plain-list li', box).forEach((li, i) => {
    const [a, b] = li.children;
    const ta = q(q.pick(Ws, t0 + 0.7 + i * 0.3), t0 + 0.7 + i * 0.3, (W, s) => writeIn(c, W, a, s, { mode: 'type', cps: 66 }));
    const tb = b ? q(R, ta - 0.4, (Rr, s) => writeIn(c, Rr, b, s, { mode: 'type', cps: 28 })) : ta;
    const em = $('.ratio', li), m = em && em.textContent.match(RATIO);
    const tc = m ? q(Ev, ta, (E, s) => {
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
// The years arrive shuffled; titles are typed, authors and venues looked up, citations counted, badges
// placed; the librarian sorts the years, newest first; the red-team drags the oldest to the top and the
// librarian puts it back.
ACTS.papers = (c) => {
  const box = c.el, groups = $$('.year-group', box), pubs = $$('.pub', box), q = queue(), A = agentIn(c), t0 = c.t;
  const L = A('librarian'), Ws = [A('writer-2'), A('writer-3')], Rs = [A('retriever'), A('researcher')], Es = [A('eval'), A('eval-2')], S = A('stylist'), RT = A('red-team');
  const restore = blank(c, t0, box, '.year-group, .pub');
  const badges = $$('.badge', box);
  const order = groups.map((_, i) => i), r = rng(groups.length * 31 + 7);
  for (let i = order.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  const off = [];
  c.call(t0, () => {
    badges.forEach((b) => { b.style.opacity = '0'; });
    const rs = groups.map((n) => n.getBoundingClientRect());
    let y = rs[0].top;
    const slot = [];
    order.forEach((idx) => { slot[idx] = y; y += rs[idx].height; });
    groups.forEach((n, i) => { off[i] = { x: 0, y: slot[i] - rs[i].top }; n.style.transform = `translateY(${off[i].y}px)`; });
    show(box);
  });
  think(c, L, t0 + 0.2, 'in no order at all. hm.', 1.6);
  groups.forEach((g, i) => q(L, t0 + 0.3 + i * 0.05, (Lg, s) => writeIn(c, Lg, $('.year', g), s, { mode: 'type', cps: 22 })));
  think(c, Ws[0], t0 + 0.7, `${pubs.length} titles. typing fast.`, 1.5);
  let end = t0;
  pubs.forEach((pub, i) => {
    const title = $('.pub-title', pub), au = $('.pub-authors', pub), ve = $('.pub-venue', pub), ci = $('.pub-cites', pub);
    const tt = q(Ws[i % 2], t0 + 0.5 + i * 0.06, (W, s) => writeIn(c, W, title, s, { mode: 'type', cps: 100 }));
    const ta = q(Rs[i % 2], tt - 0.3, (Rr, s) => { scrambleIn(c, null, ve, s + 0.1, 0.4); return scrambleIn(c, Rr, au, s, 0.45); });
    const tc = ci && ci.textContent.trim() ? q(Es[i % 2], tt - 0.2, (E, s) => { c.go(E, center(c, ci, 0.5, 0.5), s, 0.22); return countIn(c, ci, s + 0.22, 0.45); }) : tt;
    let tb = tc;
    $$('.badge', pub).forEach((bdg) => {
      tb = q(S, tt, (Sg, s) => {
        c.go(Sg, center(c, bdg, 0.2, 0.5), s, 0.25);
        c.tween(s + 0.25, 0.3, 'out', (k) => { bdg.style.opacity = String(k); bdg.style.scale = String(0.7 + 0.3 * k); });
        const e = writeIn(c, null, bdg, s + 0.25, { mode: 'type', cps: 60 });
        c.call(e + 0.05, () => { bdg.style.opacity = ''; bdg.style.scale = ''; });
        return e;
      });
    });
    end = Math.max(end, tt, ta, tc, tb);
  });
  think(c, Rs[0], t0 + 1.4, 'authors, straight from Scholar.', 1.5);
  c.log(L.id, 'sorting by year, newest first', end + 0.2);
  think(c, L, end + 0.2, 'newest first. always.', 1.6);
  end = settle(c, L, groups, off, end + 0.2, { hop: 0.28, dur: 0.5 });
  const last = groups[groups.length - 1], first = groups[0];
  if (RT && last && first && last !== first) {
    const ta = end + 0.3, yr = $('.year', last) || last, grab = () => { const b = c.rel(yr); return { x: b.x + 10, y: b.y + 14 }; };
    let dy = 0;
    c.call(ta - 0.01, () => { const v = c.view(); RT.set(v.x1 + 60, c.rel(last).y); dy = first.getBoundingClientRect().top - last.getBoundingClientRect().top; });
    c.go(RT, grab, ta, 0.6);
    think(c, RT, ta + 0.6, 'oldest first. for nostalgia.', 1.7);
    c.log(RT.id, `dragging ${yr.textContent.trim()} to the top`, ta + 0.7);
    c.tween(ta + 0.8, 0.8, 'inOut2', (p) => { last.style.transform = `translateY(${dy * p}px)`; last.style.zIndex = '2'; const g = grab(); RT.set(g.x, g.y); });
    c.go(RT, () => ({ x: c.view().x1 + 80, y: RT.y }), ta + 1.7, 0.6, 'in');
    c.go(L, grab, ta + 1.8, 0.5);
    think(c, L, ta + 2.3, 'nope. newest first.', 1.5);
    c.log(L.id, `put ${yr.textContent.trim()} back at the bottom`, ta + 2.4);
    c.tween(ta + 2.4, 0.8, 'inOut2', (p) => { last.style.transform = `translateY(${dy * (1 - p)}px)`; const g = grab(); L.set(g.x, g.y); });
    c.call(ta + 3.25, () => { last.style.transform = ''; last.style.zIndex = ''; });
    end = ta + 3.3;
  }
  restore(end + 0.05);
  c.call(end + 0.05, () => badges.forEach((b) => { b.style.opacity = ''; b.style.scale = ''; }));
  return end + 0.1;
};

// the topic filter, tried once and put back; then the note under the list
const press = (b) => $$('.filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
ACTS.filter = (c) => {
  const note2 = c.el, ag = c.a, years = $('#papers .years');
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

// pills: the planner frames the row if there is one, the stylist puts each pill down, a writer types it
ACTS.pills = (c) => {
  const box = c.el, A = agentIn(c), t0 = c.t, items = $$('button, a', box);
  const P = c.who.find((g) => g.id.startsWith('planner')), S = A('stylist'), W = c.who.find((g) => g.id.startsWith('writer')) || c.a;
  const restore = blank(c, t0, box);
  c.call(t0, () => items.forEach((x) => { x.style.opacity = '0'; }));
  let t = t0 + 0.05;
  if (P) { c.log(P.id, 'frame · ' + (box.getAttribute('aria-label') || 'links'), t); t = c.frame(P, box, t + 0.5); }
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
// The two columns start the wrong way round; the planner swaps them back; the historians add each
// entry, newest first; the red-team squeezes the columns together and the planner opens the gap again.
ACTS.cv = (c) => {
  const box = c.el, cols = $$('.cv-col', box), q = queue(), A = agentIn(c), t0 = c.t;
  const P = A('planner'), H = [A('historian'), A('historian-2')], RT = A('red-team');
  const lis = cols.map((col) => $$('.timeline li', col));
  const restore = blank(c, t0, box, '.cv-col, .timeline li');
  const off = scatter(c, cols, t0, (i, rs) => { const j = cols.length - 1 - i; return { x: rs[j].left - rs[i].left, y: rs[j].top - rs[i].top, r: i ? 2 : -2 }; });
  c.call(t0, () => { lis.flat().forEach((li) => { li.style.opacity = '0'; }); show(box); });
  const th = cols.map((col, ci) => q(H[ci] || H[0], t0 + 0.2 + ci * 0.2, (Ag, s) => writeIn(c, Ag, $('h3', col), s, { mode: 'type', cps: 14 })));
  const ts = Math.max(...th);
  think(c, P, ts + 0.1, 'experience before education? no.', 1.8);
  c.log(P.id, 'swapping the columns · Education first', ts + 0.6);
  let t = settle(c, P, cols, off, ts + 0.6, { hop: 0.25, dur: 0.6 });
  guides(c, t, cols);
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
  if (RT && cols.length > 1) {
    const ta = end + 0.3, right2 = cols[1];
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
    end = ta + 3.4;
  }
  c.call(end, () => lis.flat().forEach((li) => { li.style.opacity = ''; }));
  restore(end + 0.05);
  return end + 0.1;
};

// ---------------------------------------------------------------- 05 · service
// The venues arrive shuffled; names typed, publishers looked up, impact factors counted; the librarian
// ranks them; the red-team flips the ranking upside down and the librarian flips it back; the bars grow.
ACTS.rank = (c) => {
  const box = c.el, items = $$('.venue', box), fills = $$('.venue-bar i', box), q = queue(), A = agentIn(c), t0 = c.t;
  const L = A('librarian'), Ws = [A('writer'), A('writer-3')], Rs = [A('retriever'), A('researcher')], Es = [A('eval'), A('eval-2')], RT = A('red-team');
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
  if (RT) {
    const ta = end + 0.3, rev = [];
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
    end = ta + 3.4;
  }
  fills.forEach((f, i) => c.tween(end + i * 0.07, 0.4, 'out', (p) => { f.style.width = num(f.dataset.w) * p + '%'; }));
  end += fills.length * 0.07 + 0.4;
  c.call(end, () => fills.forEach((f) => { f.style.width = f.dataset.w; }));
  restore(end + 0.05);
  return end + 0.1;
};

// a list written in: the heading typed, each line typed, the years looked up
ACTS.lines = (c) => {
  const box = c.el, q = queue(), A = agentIn(c), t0 = c.t, W = A('writer'), W2 = A('writer-2'), R = A('retriever');
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
const sleep = (ms) => new Promise((res) => setTimeout(res, skipBoot ? 0 : ms));
async function boot() {
  if (!BOOT) return;
  const log = $('.crew-boot__log', BOOT), roster = $('.crew-boot__roster', BOOT), title = $('.crew-boot__title', BOOT);
  const LINES = [['mounting survey drive', 'ok'], ['loading 2,481 aerial images', 'ok'], ['target  : tang.ninja'], ['plan    : the city first, then the page, floor by floor'],
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
  c.log('orchestrator', `${c.crew.length} agents deployed · goal: build tang.ninja, floor by floor`, 0.1);
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
  return 1.35;
}

// The crew arriving at a section: they come in from both sides and wait in the space above its first
// line, the red-team out of sight; the one who knows the section best says what it thinks of it.
const HELLO = {
  research: ['writer', 'section one. no pressure.'], honors: ['planner', 'careful. these are awards.'],
  papers: ['librarian', () => `${$$('#papers .pub').length} papers. I have a system.`], cv: ['historian', 'let’s start at the start.'],
  service: ['librarian', 'impact factors. my favourite.'], contact: ['writer', 'top floor! well, bottom.'],
};
function arrival(c, first) {
  const v = c.view(), b = c.rel(first), mates = c.crew.filter((a) => a.id !== 'red-team');
  const per = Math.max(3, Math.floor((v.x1 - v.x0 - 80) / 54)), cols = Math.min(per, mates.length);
  const x0 = Math.max(v.x0 + 24, Math.min(b.x + 12, v.x1 - cols * 54 - 24));
  mates.forEach((a, i) => {
    const row = Math.floor(i / per), col = i % per;
    a.set(i % 2 ? v.x1 + 60 : v.x0 - 60, b.y - 40 - row * 26 + col * 5);
    c.go(a, { x: x0 + col * 54, y: b.y - 46 - row * 30 - (col % 2) * 9 }, 0.02 + i * 0.06, 0.55);
  });
  const rt = c.crew.find((a) => a.id === 'red-team');
  if (rt) rt.set(v.x1 + 90, b.y);
  const key = c.region.id || (c.region.classList.contains('impact') ? 'impact' : '');
  const hi = key === 'impact' ? ['researcher', 'numbers time.'] : HELLO[key];
  const ag = hi && c.crew.find((a) => a.id === hi[0]);
  if (ag) think(c, ag, 0.8, typeof hi[1] === 'function' ? hi[1]() : hi[1], 1.6);
}

// ---------------------------------------------------------------- the house rule: one floor at a time
// While the page is being built, the sheet ends just below the floor the crew is on, so no one scrolls
// past work that is not done; a hazard tape marks the edge, and each finished floor opens the next.
const TAPE = 88;
const nameOf = (r) => r.getAttribute('aria-label') || (($('h2', r) || {}).textContent || '').replace(/^\s*\d+\s*/, '').trim() || r.id || 'the page';
const Gate = {
  on: false, h: -1, sheet: null, tape: null, label: null, regions: [], names: new Map(), timer: 0,
  init() {
    this.sheet = $('.sheet');
    this.regions = $$('[data-swarm]');
    if (!this.sheet) return;
    this.regions.forEach((r) => this.names.set(r, nameOf(r)));
    const tape = document.createElement('div');
    tape.className = 'crew-gate';
    tape.setAttribute('aria-hidden', 'true');
    tape.innerHTML = '<p><b>Under construction</b><span></span></p>';
    this.sheet.appendChild(tape);
    this.tape = tape;
    this.label = $('span', tape);
    this.on = true;
    this.update();
    this.timer = setInterval(() => this.update(), 300);
    addEventListener('resize', () => this.update(), { passive: true });
  },
  update() {
    if (!this.on) return;
    const next = this.regions.find((r) => !r.classList.contains('swarm-done'));
    if (!next || swarm.stopped) { this.open(); return; }
    let h = 0;
    if (this.sheet.contains(next)) {
      const top = this.sheet.getBoundingClientRect().top;
      const upto = this.regions.slice(0, this.regions.indexOf(next) + 1).filter((r) => this.sheet.contains(r));
      h = Math.ceil(Math.max(...upto.map((r) => r.getBoundingClientRect().bottom)) - top) + TAPE;
    }
    if (h !== this.h) { this.h = h; root.style.setProperty('--crew-gate', h + 'px'); }
    const working = next.classList.contains('sb-host'), n = working ? $$(':scope > .sb-layer > .sb-ag', next).length : 0;
    const text = ` · ${this.names.get(next)}` + (working ? ` · ${n} agents at work · click to speed up` : ' · next floor, scroll on');
    if (this.label && this.label.textContent !== text) this.label.textContent = text;
  },
  open() {
    if (!this.on && root.classList.contains('cl-open')) return;
    this.on = false;
    clearInterval(this.timer);
    root.classList.add('cl-open');
    root.style.removeProperty('--crew-gate');
    const tape = this.tape;
    this.tape = null;
    if (tape) { tape.classList.add('is-out'); setTimeout(() => tape.remove(), 500); }
  },
};

// ---------------------------------------------------------------- running it, Skip and replay
let heroBuilding = false, heroStarted = false;
const swarm = swarmBuild({
  crew: CREW, acts: Object.fromEntries(Object.entries(ACTS).map(([k, f]) => [k, (c) => {
    c.t = Math.max(c.t, ...c.who.map((g) => BUSY.get(g) || 0));
    const e = f(c);
    c.who.forEach((g) => busy(g, +e || 0));
    return e;
  }])),
  entrance, arrival, speed: 1, pace: 1.6, gap: 0.3, traceDots: true,
  ffEvents: ['keydown', 'click'],
  onRegionStart: (region) => {
    if (region.matches('.hero')) { heroBuilding = true; heroStarted = true; } else dropBoot();
    Gate.update();
  },
  onRegionEnd: (region) => {
    if (region.matches('.hero')) { heroBuilding = false; finishScene(); dropBoot(true); }
    for (let i = RESTORE.length - 1; i >= 0; i--) if (RESTORE[i].region === region) { RESTORE[i].put(); RESTORE.splice(i, 1); }
    Gate.update();
    if ($$('[data-swarm]').every((r) => r.classList.contains('swarm-done'))) { skipButton(false); Gate.open(); }
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

// stop the build for good and show the page as it is
function stopAll() {
  skipBoot = true;
  swarm.stop();
  finishScene();
  dropBoot(true);
  Gate.open();
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
    if (!swarm.active) { dropBoot(true); root.classList.add('cl-open'); swarm.start(); return; }
    Gate.init();
    skipButton(true);
    // a link to a part of the page that is not built yet: stop building and go there
    addEventListener('click', (e) => {
      if (!Gate.on) return;
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      const to = a && document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (to && !to.closest('.hero')) stopAll();
    }, true);
    // past the hero while it is still being built (short screens): finish it
    addEventListener('scroll', () => { if (heroBuilding && scrollY > innerHeight * 0.5) swarm.skip(); }, { passive: true });
    const clouds = Promise.race([Cloud.load(), new Promise((res) => setTimeout(res, 2500))]);
    await boot();
    await clouds;
    if (swarm.stopped) return;
    swarm.start();
    setTimeout(() => { if (!heroStarted) dropBoot(); }, 4000);   // the hero is not in view (it always is, but still)
  } catch (err) {
    console.error('[crew]', err);
    try { swarm.stop(); } catch (e) { /* nothing left to stop */ }
    dropBoot(true);
    Gate.open();
  }
})();
