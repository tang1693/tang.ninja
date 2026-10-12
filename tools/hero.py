# Draws the home page hero into home/hero/: one SVG per depth layer on a shared 1600x720
# canvas, small animated pieces cut from that canvas, and scene.html, the markup that
# places all of them (build.mjs puts it into the home page at <!-- SCENE -->).
#
# The picture: a Bauhaus survey robot punching a chubby, dopey red dinosaur in a harbour city
# at night, flat colour with bold ink outlines. Original characters only. Research details
# hidden in it: a survey crew and coded targets on a roof, two drones photographing the robot
# (photogrammetry), a satellite sweeping the dino line by line (push-broom hyperspectral), a
# lab with a colour chart, detection boxes on both giants, and a box on whichever small thing
# the mouse is on. For fun: a forged rune sword, jets, tanks, a helicopter, boats, a ferris
# wheel, a forge on a roof, a fastback coupe, a journalist up close, and a few Easter eggs.
#
#   python3 tools/hero.py
import math, os, random, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "home", "hero")
os.makedirs(OUT, exist_ok=True)
W, H = 1600, 720

# ---------- palette ----------
INK = "#06080d"
RED, RED_D, RED_DD = "#e2321f", "#a91d0e", "#5e0f06"
YEL, YEL_L, YEL_D = "#f6be00", "#ffdb5c", "#c08b00"
BLU, BLU_L, BLU_D, BLU_DD = "#1c4fb8", "#4479e8", "#143c8f", "#0b2462"
WHT, WHT_D, WHT_DD = "#eef0f5", "#c3c9d6", "#8b93a8"
STEEL, STEEL_L = "#252a36", "#3e4556"
RIM = "#ffe6a0"
WARM, WARM2, COOL = "#ffcf66", "#ffb347", "#d2e2ff"
WIN = "#121729"


# ---------- tiny SVG toolkit ----------
def num(v):
    if isinstance(v, float):
        s = f"{v:.2f}".rstrip("0").rstrip(".")
        return "0" if s in ("", "-0") else s
    return str(v)


def attrs(kw):
    return "".join(f' {k.rstrip("_").replace("_", "-")}="{num(v)}"' for k, v in kw.items() if v is not None)


def rect(x, y, w, h, fill, **kw):
    return f'<rect x="{num(float(x))}" y="{num(float(y))}" width="{num(float(w))}" height="{num(float(h))}" fill="{fill}"{attrs(kw)}/>'


def circ(cx, cy, r, fill, **kw):
    return f'<circle cx="{num(float(cx))}" cy="{num(float(cy))}" r="{num(float(r))}" fill="{fill}"{attrs(kw)}/>'


def ell(cx, cy, rx, ry, fill, **kw):
    return f'<ellipse cx="{num(float(cx))}" cy="{num(float(cy))}" rx="{num(float(rx))}" ry="{num(float(ry))}" fill="{fill}"{attrs(kw)}/>'


def poly(pts, fill, **kw):
    p = " ".join(f"{num(float(x))},{num(float(y))}" for x, y in pts)
    return f'<polygon points="{p}" fill="{fill}"{attrs(kw)}/>'


def path(d, fill="none", **kw):
    return f'<path d="{d}" fill="{fill}"{attrs(kw)}/>'


def line(x1, y1, x2, y2, stroke, w=1.0, **kw):
    return (f'<line x1="{num(float(x1))}" y1="{num(float(y1))}" x2="{num(float(x2))}" y2="{num(float(y2))}" '
            f'stroke="{stroke}" stroke-width="{num(float(w))}"{attrs(kw)}/>')


def g(*items, **kw):
    return f"<g{attrs(kw)}>" + "".join(items) + "</g>"


def pl(pts, close=False):
    d = "M " + " L ".join(f"{num(float(x))} {num(float(y))}" for x, y in pts)
    return d + (" Z" if close else "")


def hexrgb(c):
    c = c.lstrip("#")
    return [int(c[i:i + 2], 16) for i in (0, 2, 4)]


def mix(a, b, t):
    ra, rb = hexrgb(a), hexrgb(b)
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(ra, rb))


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


class Svg:
    def __init__(self, name, box=(0, 0, W, H)):
        self.name, self.box, self.defs, self.items, self.n = name, box, [], [], 0

    def _id(self, p):
        self.n += 1
        return f"{p}{self.n}"

    @staticmethod
    def _stops(stops):
        out = []
        for s in stops:
            o, c, a = s if len(s) == 3 else (s[0], s[1], 1)
            out.append(f'<stop offset="{num(float(o))}" stop-color="{c}"' + (f' stop-opacity="{num(float(a))}"' if a != 1 else "") + "/>")
        return "".join(out)

    def lin(self, stops, x1=0, y1=0, x2=0, y2=1, user=False):
        i = self._id("g")
        u = ' gradientUnits="userSpaceOnUse"' if user else ""
        self.defs.append(f'<linearGradient id="{i}" x1="{num(float(x1))}" y1="{num(float(y1))}" x2="{num(float(x2))}" '
                         f'y2="{num(float(y2))}"{u}>{self._stops(stops)}</linearGradient>')
        return f"url(#{i})"

    def rad(self, stops, cx=0.5, cy=0.5, r=0.5, user=False):
        i = self._id("r")
        u = ' gradientUnits="userSpaceOnUse"' if user else ""
        self.defs.append(f'<radialGradient id="{i}" cx="{num(float(cx))}" cy="{num(float(cy))}" r="{num(float(r))}"{u}>'
                         f"{self._stops(stops)}</radialGradient>")
        return f"url(#{i})"

    def clip(self, *shapes):
        i = self._id("c")
        self.defs.append(f'<clipPath id="{i}">' + "".join(shapes) + "</clipPath>")
        return f"url(#{i})"

    def add(self, *items):
        self.items.extend(items)

    def save(self):
        x, y, w, h = self.box
        s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{num(float(x))} {num(float(y))} {num(float(w))} {num(float(h))}" '
             f'width="{num(float(w))}" height="{num(float(h))}">')
        if self.defs:
            s += "<defs>" + "".join(self.defs) + "</defs>"
        s += "".join(self.items) + "</svg>"
        with open(os.path.join(OUT, self.name), "w") as f:
            f.write(s)
        SIZES[self.name] = len(s)
        return self


SIZES = {}

def limb(x1, y1, x2, y2, w, fill, rx=None):
    """A limb from (x1, y1) to (x2, y2), w wide, in one flat colour."""
    L = math.hypot(x2 - x1, y2 - y1)
    a = math.degrees(math.atan2(y2 - y1, x2 - x1))
    return rect(0, -w / 2, L, w, fill, rx=w * 0.34 if rx is None else rx,
                transform=f"translate({num(float(x1))} {num(float(y1))}) rotate({num(a)})")


def person(x, y, h=16.0, jacket="#2b3350", helmet=None, vest=False, arms=None, skin="#d9b08c"):
    """A tiny standing person, feet at (x, y). arms: list of (dx, dy) hand positions from the shoulder."""
    k = h / 16.0
    head_r = 2.4 * k
    sh_y = y - 11.5 * k
    out = [
        line(x - 1.1 * k, y - 5 * k, x - 1.6 * k, y, "#151925", 1.8 * k, stroke_linecap="round"),
        line(x + 1.1 * k, y - 5 * k, x + 1.6 * k, y, "#151925", 1.8 * k, stroke_linecap="round"),
        rect(x - 2.9 * k, sh_y, 5.8 * k, 7.4 * k, jacket, rx=1.8 * k),
    ]
    if vest:
        out.append(rect(x - 2.9 * k, sh_y + 0.4 * k, 5.8 * k, 5.6 * k, YEL, rx=1.4 * k))
        out.append(rect(x - 2.9 * k, sh_y + 3.4 * k, 5.8 * k, 1 * k, "#f2f2f2"))
    for dx, dy in arms or [(-2.6, 6), (2.6, 6)]:
        sx = x + (2.2 * k if dx > 0 else -2.2 * k)
        out.append(line(sx, sh_y + 1 * k, sx + dx * k, sh_y + dy * k, jacket if not vest else YEL, 1.5 * k, stroke_linecap="round"))
    out.append(circ(x, sh_y - head_r - 0.3 * k, head_r, skin))
    if helmet:
        out.append(path(f"M {num(x - head_r * 1.15)} {num(sh_y - head_r)} A {num(head_r * 1.15)} {num(head_r * 1.15)} 0 0 1 "
                        f"{num(x + head_r * 1.15)} {num(sh_y - head_r)} Z", helmet))
    else:
        out.append(path(f"M {num(x - head_r)} {num(sh_y - head_r - 0.3 * k)} A {num(head_r)} {num(head_r)} 0 0 1 "
                        f"{num(x + head_r)} {num(sh_y - head_r - 0.3 * k)} Z", "#2a2018"))
    return "".join(out)


# ---------- bold outlines ----------
# The giants and the vehicles are flat colour with a bold ink outline, no light or shade.
LINE = "#0b0d14"   # the ink
EDGE = LINE        # the outer edge: ink, or a light colour for a sticker look


def _attr(el, name):
    m = re.search(f' {name}="([^"]*)"', el)
    return m.group(1) if m else None


def _with(el, **kw):
    """The element with these attributes replaced or added; None removes one."""
    for k, v in kw.items():
        name = k.rstrip("_").replace("_", "-")
        el = re.sub(f' {name}="[^"]*"', "", el, count=1)
        if v is not None:
            el = el.replace("/>", f' {name}="{v if isinstance(v, str) else num(float(v))}"/>', 1)
    return el


class Inked:
    """Parts drawn with a bold outline. A backing pass in the edge colour, grown by `edge` all round, makes
    the outer outline; then every part is drawn with an ink line `line` wide, which also separates the
    parts inside. Details go on top of their part as they are."""

    def __init__(self, line=3.4, edge=4.6):
        self.items, self.line, self.edge = [], line, edge

    def part(self, *els):
        self.items += [("part", e) for e in els]

    def detail(self, *els):
        self.items += [("detail", e) for e in els]

    def group(self, tag):
        self.items.append(("wrap", tag))

    def end(self):
        self.items.append(("wrap", "</g>"))

    def svg(self, edge=None):
        edge = edge or EDGE
        back, front = [], []
        for kind, el in self.items:
            if kind == "wrap":
                back.append(el)
                front.append(el)
            elif kind == "detail":
                front.append(el)
            elif _attr(el, "stroke") not in (None, "none"):
                w = float(_attr(el, "stroke-width") or 1)
                back.append(_with(el, stroke=edge, stroke_width=w + self.line + 2 * self.edge, opacity=None))
                front.append(_with(el, stroke=LINE, stroke_width=w + self.line, opacity=None))
                front.append(el)
            else:
                back.append(_with(el, fill=edge, stroke=edge, stroke_width=self.line + 2 * self.edge,
                                  stroke_linejoin="round", opacity=None))
                front.append(_with(el, stroke=LINE, stroke_width=self.line, stroke_linejoin="round"))
        return "".join(back) + "".join(front)


# ---------- the scene markup ----------
LAYERS = []


def pct(v):
    return f"{v * 100:.3f}".rstrip("0").rstrip(".") + "%"


class Layer:
    def __init__(self, cls, depth, delay, rise):
        self.cls, self.depth, self.delay, self.rise, self.items = cls, depth, delay, rise, []
        LAYERS.append(self)

    def art(self, svg, cls="", style=""):
        c = "art" + (f" {cls}" if cls else "")
        st = f' style="{style}"' if style else ""
        self.items.append(f'<img class="{c}" src="/hero/{svg.name}" alt=""{st}>')

    def fx(self, svg, cls="", style=""):
        x, y, w, h = svg.box
        st = f"left:{pct(x / W)};top:{pct(y / H)};width:{pct(w / W)}" + (f";{style}" if style else "")
        self.items.append(f'<img class="fx{(" " + cls) if cls else ""}" src="/hero/{svg.name}" alt="" style="{st}">')

    def at(self, svg, cls, cx, cy, style=""):
        """Place a piece drawn around (0,0)-ish at the given canvas point (piece box is relative)."""
        x, y, w, h = svg.box
        st = f"left:{pct((cx + x) / W)};top:{pct((cy + y) / H)};width:{pct(w / W)}" + (f";{style}" if style else "")
        self.items.append(f'<img class="fx {cls}" src="/hero/{svg.name}" alt="" style="{st}">')

    def box(self, cls, x, y, w, h, inner="", style=""):
        st = f"left:{pct(x / W)};top:{pct(y / H)};width:{pct(w / W)};height:{pct(h / H)}" + (f";{style}" if style else "")
        self.items.append(f'<div class="{cls}" style="{st}">{inner}</div>')

    def det(self, label, x, y, w, h, conf=None, below=False):
        """A detection box that appears when the pointer is over that object: an invisible anchor
        here, in the object's layer, and the box itself in the top hud layer (write_dets)."""
        i = len(DETS)
        DETS.append((label, w, h, conf, below))
        self.box("anchor", x, y, w, h, style=f"--i:{i}")

    def mover(self, cls, x, y, w, h, style=""):
        """A box that moves as one (an animated div): the pieces and the detection box put in it
        travel together, so the box stays on its object."""
        m = Mover(cls, x, y, w, h, style)
        self.items.append(m)
        return m

    def html(self):
        rise = f"--delay:{self.delay}s;--rise:{self.rise}%"
        inner = "\n".join("    " + (i.html() if isinstance(i, Mover) else i) for i in self.items)
        return f'  <div class="layer {self.cls}" data-depth="{self.depth}" style="{rise}">\n{inner}\n  </div>'


class Mover:
    """An animated group. Motion is given in canvas pixels and written as percentages of the
    group's own box, so it scales with the scene: ax/ay for to-and-fro paths, x0/x1 for a
    crossing, th (degrees) and pivot (a canvas point) for a swing, dur and delay in seconds."""

    def __init__(self, cls, x, y, w, h, style):
        self.cls, self.box_, self.style, self.items = cls, (x, y, w, h), style, []

    def motion(self, ax=None, ay=None, x0=None, x1=None, th=None, pivot=None, dur=None, delay=None, clip=False):
        mx, my, mw, mh = self.box_
        st = []
        if ax is not None:
            st.append(f"--ax:{ax / mw * 100:.1f}%")
        if ay is not None:
            st.append(f"--ay:{ay / mh * 100:.1f}%")
        if x0 is not None:
            st.append(f"--x0:{(x0 - mx) / mw * 100:.1f}%;--x1:{(x1 - mx) / mw * 100:.1f}%")
        if th is not None:
            st.append(f"--th:{th}deg")
        if pivot is not None:
            st.append(f"transform-origin:{(pivot[0] - mx) / mw * 100:.2f}% {(pivot[1] - my) / mh * 100:.2f}%")
        if dur is not None:
            st.append(f"--dur:{dur}s")
        if delay is not None:
            st.append(f"animation-delay:{delay}s")
        if clip:
            st.append("overflow:hidden")
        self.style = ";".join([self.style] + st) if self.style else ";".join(st)
        return self

    def _rel(self, x, y, w, h=None):
        mx, my, mw, mh = self.box_
        st = f"left:{pct((x - mx) / mw)};top:{pct((y - my) / mh)};width:{pct(w / mw)}"
        return st + (f";height:{pct(h / mh)}" if h is not None else "")

    def fx(self, svg, cls="", style=""):
        x, y, w, h = svg.box
        st = self._rel(x, y, w) + (f";{style}" if style else "")
        self.items.append(f'<img class="fx{(" " + cls) if cls else ""}" src="/hero/{svg.name}" alt="" style="{st}">')

    def at(self, svg, cls, cx, cy, style=""):
        x, y, w, h = svg.box
        st = self._rel(cx + x, cy + y, w) + (f";{style}" if style else "")
        self.items.append(f'<img class="fx {cls}" src="/hero/{svg.name}" alt="" style="{st}">')

    def box(self, cls, x, y, w, h, inner="", style=""):
        st = self._rel(x, y, w, h) + (f";{style}" if style else "")
        self.items.append(f'<div class="{cls}" style="{st}">{inner}</div>')

    def img(self, svg, cls, x, y, w, style=""):
        """A piece placed at a canvas point with a given width (its own box ignored)."""
        st = self._rel(x, y, w) + (f";{style}" if style else "")
        self.items.append(f'<img class="fx {cls}" src="/hero/{svg.name}" alt="" style="{st}">')

    def det(self, label, x, y, w, h, conf=None, below=False):
        """The anchor travels with the group; the box is in the top hud layer."""
        i = len(DETS)
        DETS.append((label, w, h, conf, below))
        self.box("anchor", x, y, w, h, style=f"--i:{i}")

    def html(self):
        x, y, w, h = self.box_
        st = f"left:{pct(x / W)};top:{pct(y / H)};width:{pct(w / W)};height:{pct(h / H)}" + (f";{self.style}" if self.style else "")
        inner = "\n".join("  " + i for i in self.items)
        return f'<div class="fx mover {self.cls}" style="{st}">\n{inner}\n    </div>'


DET_RNG = random.Random(12)


DETS = []


def write_dets(rng):
    """One hud layer on top of everything, with every detection box; home.js shows the one whose
    anchor is under the pointer (the smallest, when several are) and places it over that anchor."""
    hud = Layer("hud", 0, 0, 0)
    for i, (label, w, h, conf, below) in enumerate(DETS):
        conf = round(rng.uniform(0.72, 0.98), 2) if conf is None else conf
        cls = "det det-more" + (" det-s" if w < 90 or h < 60 else "") + (" det-below" if below else "")
        hud.items.append(f'<div class="{cls}" style="--i:{i}"><span>{label} {conf:.2f}</span></div>')



# =====================================================================
# Sky: the moon and its halo, faint orbits. The sky colour comes from CSS, and the
# stars are a 480px tile repeated behind the whole hero.
# =====================================================================
def draw_stars():
    rng = random.Random(7)
    s = Svg("stars.svg", (0, 0, 480, 480))
    for _ in range(46):
        r = rng.uniform(0.5, 1.5)
        s.add(circ(rng.uniform(0, 480), rng.uniform(0, 480), r, "#f5f5f7", opacity=round(rng.uniform(0.25, 0.85), 2)))
    for _ in range(3):
        x, y = rng.uniform(20, 460), rng.uniform(20, 460)
        s.add(circ(x, y, 1.6, "#ffffff"), line(x - 5, y, x + 5, y, "#ffffff", 0.7, opacity=0.6), line(x, y - 5, x, y + 5, "#ffffff", 0.7, opacity=0.6))
    return s.save()


def draw_sky():
    s = Svg("sky.svg")
    # the wide halo is a CSS gradient (it reaches above the scene); this is the inner glow
    s.add(circ(1010, 250, 236, s.rad([(0, YEL, 0.3), (0.5, YEL, 0.12), (1, YEL, 0)])))
    s.add('<ellipse cx="800" cy="560" rx="1000" ry="430" fill="none" stroke="#ffffff" stroke-opacity="0.1" '
          'stroke-width="1.5" transform="rotate(-7 800 560)"/>')
    s.add('<ellipse cx="820" cy="600" rx="1100" ry="520" fill="none" stroke="#ffffff" stroke-opacity="0.07" '
          'stroke-width="1.2" stroke-dasharray="4 10" transform="rotate(5 820 600)"/>')
    s.add(circ(1010, 250, 150, s.rad([(0, "#ffeaa0"), (0.5, "#fdcb2a"), (1, "#eba700")], cx=0.4, cy=0.36, r=0.72)))
    for cx, cy, r, op in [(966, 196, 36, 0.2), (1064, 296, 44, 0.18), (1094, 196, 17, 0.24), (976, 326, 19, 0.2),
                          (924, 262, 12, 0.2), (1122, 258, 11, 0.22), (1032, 158, 9, 0.2), (1040, 228, 7, 0.2)]:
        s.add(circ(cx, cy, r, "#cf8f00", opacity=op))
        s.add(circ(cx - r * 0.2, cy - r * 0.2, r * 0.72, "#fff0b8", opacity=round(op * 0.7, 2)))
    # the rabbit in the moon, in the crater colour
    s.add(g(ell(0, 0, 22, 15, "#cf8f00"), circ(22, -10, 10, "#cf8f00"), ell(26, -30, 4, 13, "#cf8f00", transform="rotate(-12 26 -30)"),
            ell(34, -27, 4, 12, "#cf8f00", transform="rotate(14 34 -27)"), circ(-22, -2, 7, "#cf8f00"),
            transform="translate(944 316) rotate(-18)", opacity=0.2))
    s.add(circ(1010, 250, 150, s.rad([(0, "#9c6a00", 0), (0.72, "#9c6a00", 0), (1, "#9c6a00", 0.38)], cx=0.36, cy=0.32, r=0.8)))
    return s.save()


def draw_cloud(name, x0, y0, w, h, rows, body="#131a33", edge="#7a6f55", edge_op=0.9):
    """A flat cloud made of stacked pills, lit along its top edge. rows: (left, width) as
    fractions of w, bottom row first."""
    s = Svg(name, (x0, y0, w, h))
    rows = [r if len(r) == 3 else (r[0], r[1], i) for i, r in enumerate(rows)]
    n = max(r[2] for r in rows) + 1
    ph = h / (1 + (n - 1) * 0.62)
    pills = []
    for off, frac, level in rows:
        py = y0 + h - ph - level * ph * 0.62
        pills.append((x0 + off * w, py, frac * w, ph))
    s.add(*(rect(px, py, pw, ph, edge, rx=ph / 2, opacity=edge_op) for px, py, pw, ph in pills))
    s.add(*(rect(px + 0.6, py + 1.7, pw - 1.2, ph - 1.7, body, rx=(ph - 1.7) / 2) for px, py, pw, ph in pills))
    return s.save()


# =====================================================================
# Far city across the bay, hills, a TV tower; fog at its foot.
# =====================================================================
def draw_far():
    s = Svg("far.svg")
    rng = random.Random(11)
    pts = [(-20, 640)]
    for i in range(36):
        x = -20 + i * 48
        pts.append((x, 468 + 14 * math.sin(i * 0.62) + 8 * math.sin(i * 1.7) + rng.uniform(-4, 4)))
    pts += [(1640, 470), (1640, 640)]
    s.add(poly(pts, "#0c1330"))
    for _ in range(70):
        x = rng.uniform(0, W)
        s.add(circ(x, rng.uniform(480, 520), 0.9, WARM, opacity=round(rng.uniform(0.2, 0.5), 2)))
    x = -10.0
    while x < W + 10:
        w = rng.uniform(20, 62)
        top = rng.uniform(380, 486)
        if rng.random() < 0.12:
            top -= rng.uniform(28, 60)
        c = mix("#121b38", "#1b2647", rng.random())
        s.add(rect(x, top, w + 0.6, 640 - top, c))
        s.add(line(x + w, top, x + w, top + 40, "#2a3762", 1, opacity=0.6))
        for wy in range(int(top) + 6, 590, 8):
            for wx in range(int(x) + 4, int(x + w) - 3, 6):
                if rng.random() < 0.12:
                    s.add(rect(wx, wy, 2, 2.6, rng.choice([WARM, WARM, WARM2, COOL]), opacity=round(rng.uniform(0.3, 0.7), 2)))
        if rng.random() < 0.22:
            ax = x + w * rng.uniform(0.3, 0.7)
            s.add(line(ax, top, ax, top - rng.uniform(12, 30), "#1d2849", 1.6))
        x += w
    # TV tower with a lit observation deck
    tx = 344
    s.add(poly([(tx - 12, 600), (tx + 12, 600), (tx + 4, 380), (tx - 4, 380)], "#1a2446"))
    s.add(ell(tx, 372, 15, 9, "#1e2a50"))
    s.add(rect(tx - 13, 369, 26, 2.6, WARM, opacity=0.75))
    s.add(rect(tx - 6, 352, 12, 12, "#1a2446", rx=2))
    s.add(line(tx, 352, tx, 296, "#26335f", 2.4))
    # a ferris wheel across the bay, between the two giants: its supports; the wheel turns (draw_wheel)
    wx, wy, _ = WHEEL
    s.add(line(wx - 26, 470, wx, wy, "#1d2849", 2.2), line(wx + 26, 470, wx, wy, "#1d2849", 2.2))
    # fog over the far shore
    s.add(rect(-20, 420, 1640, 220, s.lin([(0, "#18234a", 0), (0.55, "#18234a", 0.5), (1, "#1a2650", 0.95)])))
    return s.save()


WHEEL = (760, 402, 44)


def draw_wheel(layer):
    wx, wy, wr = WHEEL
    s = Svg("wheel.svg", (wx - wr - 6, wy - wr - 6, 2 * wr + 12, 2 * wr + 12))
    s.add(circ(wx, wy, wr, "none", stroke="#2a3762", stroke_width=2))
    s.add(circ(wx, wy, wr - 7, "none", stroke="#2a3762", stroke_width=1))
    for k in range(12):
        a = math.pi * k / 6
        s.add(line(wx, wy, wx + wr * math.cos(a), wy + wr * math.sin(a), "#2a3762", 1))
        s.add(circ(wx + wr * math.cos(a), wy + wr * math.sin(a), 3.2, "#2a3762"))
        s.add(circ(wx + wr * math.cos(a), wy + wr * math.sin(a), 2, WARM if k % 2 else COOL, opacity=0.9))
    s.add(circ(wx, wy, 4, WARM))
    s.save()
    layer.fx(s, "fx-wheel")
    layer.det("ferris wheel", wx - wr - 4, wy - wr - 4, 2 * wr + 8, 2 * wr + 8)


JET, JET_D = "#5b6d92", "#3c4a66"


def jet(J, x, y, k=1.0, d=1):
    """A small fighter, nose at (x, y), flying right (d=1) or left (d=-1). Returns its box."""
    X = lambda t: x - t * k * d
    J.part(poly([(X(0), y), (X(34), y - 5 * k), (X(62), y - 4 * k), (X(62), y + 4 * k), (X(34), y + 5 * k)], JET))
    J.part(poly([(X(24), y - 1 * k), (X(56), y - 16 * k), (X(60), y - 1 * k)], JET_D))
    J.part(poly([(X(24), y + 1 * k), (X(56), y + 16 * k), (X(60), y + 1 * k)], JET))
    J.part(poly([(X(48), y - 1 * k), (X(60), y - 15 * k), (X(63), y - 1 * k)], RED))
    J.detail(ell(X(20), y - 1.5 * k, 7 * k, 3 * k, YEL))
    J.detail(circ(X(59), y + 0.5 * k, 2.4 * k, "#ffb347"))
    return (min(X(0), X(64)) - 2, y - 18 * k, 68 * k, 36 * k)


JETS = [(236, 128, 1.0), (150, 100, 0.82), (162, 162, 0.82)]


def draw_jets(layer):
    """Three jets in a V at the top left, flying toward the monster in front of the cloud."""
    s = Svg("jets.svg", (-10, 80, 300, 90))
    for x, y, k in JETS:
        s.add(line(x - 60 * k, y, x - 230, y + 4, "#ffffff", 3, opacity=0.1, stroke_linecap="round"))
        s.add(line(x - 60 * k, y, x - 160, y + 2, "#ffffff", 2, opacity=0.28, stroke_linecap="round"))
    J = Inked(line=1.8, edge=1.6)
    boxes = [jet(J, x, y, k) for x, y, k in JETS]
    s.add(J.svg())
    s.save()
    m = layer.mover("fx-cross", -10, 70, 300, 110, "").motion(x0=-620, x1=1900, ay=14, dur=42)
    m.fx(s)
    for b in boxes:
        m.det("jet", *b)


def draw_searchlight():
    s = Svg("searchlight.svg", (0, 0, 70, 460))
    s.add(poly([(0, 0), (70, 0), (37.5, 460), (32.5, 460)], s.lin([(0, "#e3ecff", 0), (0.55, "#e3ecff", 0.07), (1, "#e3ecff", 0.26)])))
    return s.save()


def draw_light():
    s = Svg("light.svg", (0, 0, 40, 40))
    s.add(circ(20, 20, 20, s.rad([(0, "#ff5a3c", 0.6), (0.4, "#ff5a3c", 0.18), (1, "#ff5a3c", 0)])))
    s.add(circ(20, 20, 3.6, "#ff8466"))
    return s.save()


# Where the robot's fist meets the monster's hand.
IMPACT = (858, 256)


def draw_burst():
    cx, cy = IMPACT
    s = Svg("burst.svg", (cx - 60, cy - 60, 120, 120))
    pts = []
    for k in range(18):
        a = math.pi * 2 * k / 18
        r = (56 if k % 3 == 0 else 42) if k % 2 == 0 else 21
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    s.add(poly(pts, YEL))
    pts = []
    for k in range(12):
        a = math.pi * 2 * k / 12 + 0.26
        r = 27 if k % 2 == 0 else 12
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    s.add(poly(pts, "#fff6d0"))
    return s.save()


# =====================================================================
# The monster: a red block of a cyclops, flat colour with a bold outline: white horns, one big
# eye, a mouthful of teeth, a target on its belly. Its hand catches the robot's fist. The
# satellite above it is its own moving group (see draw_satellite).
# =====================================================================
M_RED, M_DARK, M_WHITE, M_INK = "#e2321f", "#b8261a", "#f5f5f7", "#000000"
DIZZY = (982, 124)   # where the stars circle over its head after the punch


def draw_monster(layer):
    s = Svg("monster.svg")
    M = Inked()
    # far arm, hanging behind the body
    M.part(path("M 1180 380 L 1236 440 L 1252 510", stroke=M_DARK, stroke_width=44, stroke_linecap="round", stroke_linejoin="round"))
    # body: a round-shouldered dome, facing left, a target on its belly, bumps along its back
    M.part(path("M 868 640 L 868 400 Q 868 306 968 300 L 1086 300 Q 1196 306 1200 418 L 1200 640 Z", M_RED))
    M.part(circ(1040, 478, 96, M_DARK), circ(1040, 478, 58, M_RED), circ(1040, 478, 24, M_DARK))
    M.detail(circ(1128, 336, 9, M_INK), circ(1152, 356, 9, M_INK))
    # head: a rounded block with two horns, one big eye, a frown and teeth
    M.part(poly([(916, 196), (930, 116), (960, 186)], M_WHITE), poly([(1004, 186), (1034, 116), (1048, 196)], M_WHITE))
    M.part(rect(902, 172, 156, 140, M_RED, rx=42))
    M.part(circ(982, 230, 32, YEL))
    M.detail(circ(972, 233, 13, M_INK))
    M.detail(line(944, 200, 1014, 212, M_INK, 10, stroke_linecap="round"))
    M.part(poly([(926, 266), (1042, 266), (1032, 304), (938, 304)], M_INK))
    for i in range(6):
        tx = 934 + i * 17
        M.detail(poly([(tx, 266), (tx + 14, 266), (tx + 7, 280)], M_WHITE))
    for i in range(5):
        tx = 944 + i * 17
        M.detail(poly([(tx, 304), (tx + 14, 304), (tx + 7, 291)], M_WHITE))
    # near arm, raised: the hand stops the robot's fist, three claws gripping it
    hx, hy = IMPACT[0] + 40, IMPACT[1] - 2
    M.part(path(pl([(904, 384), (hx - 24, hy + 64), (hx, hy)]), stroke=M_RED, stroke_width=46, stroke_linecap="round",
                stroke_linejoin="round"))
    M.detail(circ(904, 384, 25, M_RED))  # the arm grows out of the body: no line at its root
    for tri in [[(-10, -18), (-50, -32), (-8, -4)], [(-12, -4), (-54, 0), (-10, 10)], [(-10, 10), (-48, 30), (-6, 22)]]:
        M.part(poly([(hx + dx, hy + dy) for dx, dy in tri], M_WHITE))
    s.add(M.svg())
    s.save()
    layer.art(s)
    lid = Svg("eyelid.svg", (946, 194, 72, 72))
    lid.add(circ(982, 230, 34, M_RED), path("M 954 234 Q 982 250 1010 234", stroke=LINE, stroke_width=4, stroke_linecap="round"))
    lid.save()
    layer.fx(lid, "fx-blink")
    # stars circling over its head once the punches start
    dz = Svg("dizzy.svg", (DIZZY[0] - 44, DIZZY[1] - 44, 88, 88))
    for k in range(3):
        a = math.radians(90 + 120 * k)
        cx, cy = DIZZY[0] + 32 * math.cos(a), DIZZY[1] + 32 * math.sin(a)
        pts = []
        for j in range(8):
            r = 9 if j % 2 == 0 else 3.6
            pts.append((cx + r * math.cos(math.pi * j / 4 + a), cy + r * math.sin(math.pi * j / 4 + a)))
        dz.add(poly(pts, YEL_L, stroke=LINE, stroke_width=1.6, stroke_linejoin="round"))
    dz.add(circ(DIZZY[0], DIZZY[1], 34, "none", stroke="#fff3b0", stroke_width=1.2, stroke_dasharray="2 6", opacity=0.7))
    dz.save()
    layer.fx(dz, "fx-dizzy")


SAT = (1034, 46)      # the satellite at the top of its pass
FOOT = (1034, 470)    # the centre of its footprint on the monster
STYLES = []           # keyframes the script works out from the geometry, written into scene.html


def orbit(t):
    """Where the satellite is at t in [0, 1]: a pass from off the left to off the right, highest
    over the monster."""
    x = -220 + 2040 * t
    return x, SAT[1] + 0.00009 * (x - SAT[0]) ** 2


def draw_satellite(layer):
    """The satellite crosses the sky on its orbit, once a minute. While it passes, its beam stays on
    the monster: the beam is drawn pointing straight up from the footprint and turned and stretched
    to reach the satellite, frame by frame."""
    sx, sy = SAT
    s = Svg("satellite.svg", (sx - 108, sy - 36, 216, 74))
    sat = []
    for x in (sx - 100, sx + 24):
        sat.append(rect(x, sy - 13, 78, 26, s.lin([(0, "#3f73e0"), (1, BLU_D)]), stroke="#c9d3ea", stroke_width=1.2))
        for k in range(1, 4):
            sat.append(line(x + k * 19.5, sy - 13, x + k * 19.5, sy + 13, "#a9c1ff", 0.9, opacity=0.6))
        sat.append(line(x, sy, x + 78, sy, "#a9c1ff", 0.9, opacity=0.6))
    sat.append(line(sx - 22, sy, sx + 24, sy, "#d6dbe6", 2.4))
    sat.append(rect(sx - 18, sy - 23, 36, 46, s.lin([(0, YEL_L), (0.5, YEL), (1, YEL_D)], x1=0, y1=0, x2=1, y2=1), rx=3))
    sat.append(path(f"M {sx - 14} {sy - 11} L {sx - 6} {sy - 15} L {sx + 2} {sy - 7} L {sx + 12} {sy - 14} "
                    f"M {sx - 12} {sy + 7} L {sx - 2} {sy + 1} L {sx + 8} {sy + 9} L {sx + 14} {sy + 3}", stroke="#fff1b0", stroke_width=1, opacity=0.8))
    sat.append(rect(sx - 7, sy + 21, 14, 8, STEEL, rx=2))
    sat.append(circ(sx, sy + 29, 5, INK))
    sat.append(circ(sx - 1.5, sy + 27.5, 1.6, "#9cc2ff"))
    sat.append(ell(sx, sy - 29, 11, 4, WHT))
    sat.append(line(sx, sy - 29, sx, sy - 23, WHT_D, 1.6))
    s.add(g(*sat))
    s.save()
    fx, fy = FOOT
    ax, ay = sx, sy + 33                     # the camera, at the top of the pass
    L0 = fy - ay
    beam_pts = [(ax - 5, ay), (ax + 5, ay), (fx + 130, fy), (fx - 130, fy)]
    bx, by, bw, bh = fx - 134, ay, 268, fy - ay
    beam = Svg("beam.svg", (bx, by, bw, bh))
    beam.add(poly(beam_pts, beam.lin([(0, YEL, 0.32), (1, YEL, 0.05)])))
    beam.add(line(*beam_pts[0], *beam_pts[3], YEL, 1.3, opacity=0.55))
    beam.add(line(*beam_pts[1], *beam_pts[2], YEL, 1.3, opacity=0.55))
    beam.save()
    # the keyframes: the satellite's place, and the beam's turn and stretch to meet it
    n = 24
    k_sat, k_beam = [], []
    for i in range(n + 1):
        t = i / n
        x, y = orbit(t)
        k_sat.append(f"{t * 100:.1f}% {{ translate: {(x - sx) / 216 * 100:.1f}% {(y - sy) / 74 * 100:.1f}%; }}")
        cx, cy = x, y + 33
        th = math.degrees(math.atan2(cx - fx, fy - cy))
        sc = math.hypot(cx - fx, fy - cy) / L0
        op = max(0.0, min(1.0, 1 - (abs(th) - 24) / 22))
        k_beam.append(f"{t * 100:.1f}% {{ rotate: {th:.1f}deg; scale: 1 {sc:.3f}; opacity: {op:.2f}; }}")
    STYLES.append("@keyframes orbit-sat { " + " ".join(k_sat) + " }")
    STYLES.append("@keyframes orbit-beam { " + " ".join(k_beam) + " }")
    mb = layer.mover("fx-orbit-beam", bx, by, bw, bh, "").motion(pivot=(fx, fy))
    mb.fx(beam, "fx-beam")
    cp = ", ".join(f"{(x - bx) / bw * 100:.1f}% {(y - by) / bh * 100:.1f}%" for x, y in beam_pts)
    mb.box("fx scan", bx, by, bw, bh, "<i></i>", style=f"clip-path:polygon({cp})")
    m = layer.mover("fx-orbit-sat", sx - 108, sy - 36, 216, 74, "")
    m.fx(s)
    m.det("satellite", sx - 108, sy - 36, 216, 74, 0.99)


# =====================================================================
# Mid city on the far quay, in front of the monster's legs.
# =====================================================================
def draw_mid(layer):
    s = Svg("mid.svg")
    L = Svg("mid-lights.svg")
    GROUPS = [Svg("mid-lights-a.svg"), Svg("mid-lights-b.svg"), Svg("mid-lights-c.svg")]
    rng = random.Random(23)
    BASE = 622
    VP = (800, 640)

    def fog_op(y):
        return 1 - 0.8 * smooth(520, 618, y)

    def win_grid(x0, y0, x1, y1, ww, wh, gx, gy, lit=0.42, warm=0.78):
        y = y0
        while y + wh <= y1:
            x = x0
            while x + ww <= x1 + 0.01:
                s.add(rect(x, y, ww, wh, WIN))
                r = rng.random()
                if r < lit + 0.1:
                    # most lit windows stay on; some belong to a group that switches on and off
                    T = L if r < lit * 0.7 else rng.choice(GROUPS)
                    c = rng.choice([WARM, WARM, WARM2]) if rng.random() < warm else COOL
                    op = round(rng.uniform(0.62, 0.95) * fog_op(y), 2)
                    T.add(rect(x, y, ww, wh, c, opacity=op))
                    if rng.random() < 0.25:  # blinds
                        T.add(rect(x, y, ww, wh * 0.4, "#2a2238", opacity=op))
                x += ww + gx
            y += wh + gy

    def block(x, top, w, face, side=10, rim=True):
        cx = x + w / 2
        if cx < VP[0]:
            k = (VP[1] - top) / max(1, VP[0] - (x + w))
            s.add(poly([(x + w, top), (x + w + side, top + side * k), (x + w + side, BASE), (x + w, BASE)], mix(face, "#000000", 0.35)))
        else:
            k = (VP[1] - top) / max(1, x - VP[0])
            s.add(poly([(x, top), (x - side, top + side * k), (x - side, BASE), (x, BASE)], mix(face, "#000000", 0.35)))
        s.add(rect(x, top, w, BASE - top, s.lin([(0, mix(face, "#ffffff", 0.06)), (1, face)])))
        s.add(line(x, top + 0.5, x + w, top + 0.5, mix(face, "#ffffff", 0.25), 1.2))
        if rim:
            ex = x + w if cx < 1010 else x
            s.add(line(ex, top, ex, top + 90, RIM, 1.2, opacity=0.28))

    def tank(x, roof):
        s.add(line(x + 3, roof, x + 5, roof - 12, "#141a2e", 2))
        s.add(line(x + 19, roof, x + 17, roof - 12, "#141a2e", 2))
        s.add(rect(x, roof - 30, 22, 18, "#2a2022"))
        s.add(poly([(x - 2, roof - 30), (x + 11, roof - 38), (x + 24, roof - 30)], "#231a1c"))
        s.add(line(x, roof - 24, x + 22, roof - 24, "#3a2d2e", 1))
        s.add(line(x + 22, roof - 30, x + 22, roof - 12, RIM, 1, opacity=0.3))

    def ac(x, roof, w=12):
        s.add(rect(x, roof - 6, w, 6, "#1d2440"))
        s.add(line(x + 2, roof - 3, x + w - 2, roof - 3, "#2d3660", 1))

    lights = []

    def mast(x, roof, hgt):
        s.add(line(x, roof, x, roof - hgt, "#1f2848", 2.2))
        s.add(line(x - 5, roof - hgt * 0.45, x + 5, roof - hgt * 0.45, "#1f2848", 1.4))
        s.add(line(x - 4, roof - hgt * 0.7, x + 4, roof - hgt * 0.7, "#1f2848", 1.2))
        lights.append((x, roof - hgt - 1))

    # left of the robot
    block(236, 456, 94, "#1b2647")
    for gx in range(244, 324, 10):
        s.add(line(gx, 462, gx, BASE, "#273560", 1))
    win_grid(246, 466, 324, 610, 6, 8, 4, 6, lit=0.35, warm=0.3)
    mast(282, 456, 40)
    block(324, 500, 76, "#241f3c")
    win_grid(332, 512, 392, 610, 10, 12, 8, 10)
    tank(350, 500)
    block(392, 468, 108, "#1d2443")
    for yy in range(482, 610, 22):
        s.add(rect(398, yy, 96, 9, WIN))
        if rng.random() < 0.8:
            L.add(rect(398 + rng.uniform(0, 30), yy, rng.uniform(30, 60), 9, WARM, opacity=round(0.75 * fog_op(yy), 2)))
    ac(410, 468)
    ac(430, 468, 16)
    block(492, 486, 118, "#1a213f")
    win_grid(500, 496, 600, 610, 9, 11, 7, 9)

    # between the giants: a pale Bauhaus cube with ribbon windows, and a tower with a red circle
    block(604, 474, 92, "#4b5373")
    for yy in (490, 516, 542, 568, 594):
        s.add(rect(610, yy, 80, 11, WIN))
        L.add(rect(610, yy, 80, 11, WARM, opacity=round(0.82 * fog_op(yy), 2)))
        for mx in range(618, 690, 12):
            L.add(line(mx, yy, mx, yy + 11, "#4b5373", 1.4, opacity=round(fog_op(yy), 2)))
    ac(620, 474)
    s.add(rect(650, 462, 30, 12, "#3d4563"))
    block(688, 452, 142, "#222a4a")
    # a clock on the tower (its second hand is a separate piece, ticking)
    s.add(circ(759, 506, 42, "#111625"), circ(759, 506, 37, "#f4f1e8"))
    for k in range(12):
        a = math.pi * k / 6
        r0 = 30 if k % 3 else 26
        s.add(line(759 + r0 * math.cos(a), 506 + r0 * math.sin(a), 759 + 34 * math.cos(a), 506 + 34 * math.sin(a), "#111625", 2.4 if k % 3 == 0 else 1.4))
    win_grid(698, 560, 822, 612, 10, 10, 8, 8)
    mast(800, 452, 46)
    block(828, 520, 66, "#1a213d")
    tank(846, 520)
    win_grid(836, 530, 886, 612, 8, 9, 6, 9)

    # in front of the monster: yellow fins, the LoD2 house, the antenna tower
    block(862, 498, 134, "#202744")
    win_grid(870, 512, 988, 612, 7, 10, 18, 10, lit=0.5)
    for k in range(5):
        fx = 878 + k * 24
        s.add(rect(fx, 504, 9, 108, s.lin([(0, "#ffd84a"), (1, "#b88400")], x1=0, y1=0, x2=1, y2=0)))
        s.add(rect(fx, 504, 9, 108, s.lin([(0, "#000", 0), (1, "#000", 0.45)])))
    block(994, 478, 128, "#283053")
    s.add(poly([(994, 478), (1058, 430), (1058, 478)], "#1f2643"))
    s.add(poly([(1058, 430), (1122, 478), (1058, 478)], "#343d63"))
    s.add(line(1058, 430, 1122, 478, RIM, 1.3, opacity=0.5))
    # LoD2 wireframe: the roof as a reconstruction would draw it
    s.add(path("M 994 478 L 1058 430 L 1122 478 M 1058 430 L 1058 478 M 994 478 L 1122 478", stroke="#9fc1ff", stroke_width=1,
               opacity=0.45, stroke_dasharray="3 3"))
    s.add(rect(1086, 440, 10, 22, "#1f2643"))
    win_grid(1004, 488, 1112, 612, 14, 14, 10, 12, lit=0.5)
    block(1120, 432, 112, "#1e2645")
    win_grid(1128, 444, 1224, 612, 8, 9, 6, 8, lit=0.38)
    s.add(line(1176, 432, 1176, 356, "#26305a", 3))
    for yy, hw in [(372, 10), (392, 14), (412, 18)]:
        s.add(line(1176 - hw, yy, 1176 + hw, yy, "#26305a", 1.6))
        s.add(line(1176 - hw, yy, 1176, yy - 18, "#26305a", 1))
    s.add(ell(1160, 404, 7, 3.4, "#3a4570", transform="rotate(-30 1160 404)"))
    s.add(ell(1194, 396, 6, 3, "#3a4570", transform="rotate(25 1194 396)"))
    lights.append((1176, 354))

    # right: a striped Bauhaus block and fillers
    block(1230, 520, 64, "#1c2340")
    win_grid(1238, 530, 1288, 612, 8, 9, 6, 9)
    block(1290, 482, 170, "#4a5272")
    for k, yy in enumerate(range(490, 612, 20)):
        s.add(rect(1290, yy, 170, 10, "#1d3a86"))
        if k % 2 == 0:
            for wx in range(1298, 1452, 16):
                if rng.random() < 0.55:
                    L.add(rect(wx, yy + 2, 10, 6, WARM, opacity=round(0.8 * fog_op(yy), 2)))
    tank(1330, 482)
    ac(1400, 482, 18)
    block(1452, 500, 160, "#1a213f", rim=False)
    win_grid(1460, 510, 1604, 612, 10, 11, 8, 9)

    # what the water will mirror: the buildings so far and their steady lights (the quay comes after)
    CITY_REFLECTION.append((list(s.items), list(s.defs), list(L.items), list(L.defs)))
    # the quay, its lamps, and the fog
    s.add(rect(-20, 612, 1640, 12, "#0a0f22"))
    for x in range(10, 1600, 38):
        s.add(line(x, 612, x, 603, "#141b33", 1))
        L.add(circ(x, 602.5, 1.6, WARM))
        L.add(circ(x, 603, 6, L.rad([(0, WARM, 0.5), (1, WARM, 0)])))
    s.add(rect(-20, 520, 1640, 104, s.lin([(0, "#1c2a52", 0), (0.7, "#1c2a52", 0.45), (1, "#1f2d57", 0.8)])))

    # the bay: dark water; the moon and the city lights in it are a separate, wobbling piece
    s.add(rect(-20, 622, 1640, 120, s.lin([(0, "#0e1b40"), (0.35, "#0a1431"), (1, "#04081a")])))
    s.add(line(-20, 622.6, 1620, 622.6, "#33447a", 1.4, opacity=0.8))
    # on the water: a buoy (the ferry and the tug are movers, draw_boats)
    B = Inked(line=1.8, edge=1.6)
    B.part(poly([(874, 642), (894, 642), (890, 660), (878, 660)], RED))
    B.part(rect(882, 632, 4, 10, "#20263a"))
    s.add(B.svg())
    lights.append((884, 630))
    # a news helicopter hovering right of the dino
    s.save()
    L.save()
    layer.art(s)
    layer.art(L, "lights", "--on:1.3s")
    for k, G in enumerate(GROUPS):
        G.save()
        layer.art(G, f"lights lights-{'abc'[k]}", f"--on:{1.3 + k * 0.3:.1f}s")
    for name, length, width, color in [("clock-h", 18, 4, "#111625"), ("clock-m", 27, 3, "#111625"), ("clock-s", 32, 1.6, RED)]:
        hand = Svg(f"{name}.svg", (759 - 40, 506 - 40, 80, 80))
        hand.add(line(759, 506 + (8 if name == "clock-s" else 4), 759, 506 - length, color, width, stroke_linecap="round"))
        hand.add(circ(759, 506, 3 if name != "clock-s" else 2, color))
        hand.save()
        layer.fx(hand, name, "transform-origin:50% 50%")
    layer.det("clock", 715, 462, 88, 88)
    draw_water(layer)
    draw_boats(layer)
    draw_heli(layer)
    sh = Svg("shimmer.svg", (950, 626, 120, 90))
    r2 = random.Random(6)
    for y in range(629, 714, 4):
        half = 10 + (y - 629) * 0.5 + r2.uniform(-5, 5)
        sh.add(rect(1010 - half + r2.uniform(-8, 8), y, half * 2 * r2.uniform(0.4, 0.9), 1.8, "#fff2b8",
                    opacity=round(0.6 * (1 - (y - 629) / 100), 2)))
    sh.save()
    layer.fx(sh, "fx-shimmer")
    return lights


WATER_EXTRAS = []       # what the robot leaves in the water (its reflection, rings), drawn by draw_water
CITY_REFLECTION = []    # the mid city's drawing, saved by draw_mid for its reflection


def draw_water(layer):
    """What moves on the water: the reflected lights wobbling, two sheets of ripples sliding
    against each other, and the robot's reflection with rings spreading from its legs."""
    for items, defs, litems, ldefs in CITY_REFLECTION:
        cr = Svg("city-reflection.svg", (-20, 622, 1640, 98))
        cr.defs = defs + ldefs
        cr.add(g(*items, *litems, transform="translate(0 1244) scale(1 -1)", opacity=0.4))
        cr.save()
        layer.fx(cr, "fx-wobble")
    wl = Svg("water-lights.svg", (-20, 622, 1640, 98))
    wr = random.Random(5)
    for y in range(628, 716, 5):
        half = 12 + (y - 628) * 0.55 + wr.uniform(-4, 4)
        wl.add(rect(1010 - half + wr.uniform(-6, 6), y, half * 2, 2.2, YEL, opacity=round(0.32 * (1 - (y - 628) / 110), 2)))
    for x in wr.sample(range(240, 1470, 7), 70):
        y0 = 628 + wr.uniform(0, 8)
        wl.add(line(x, y0, x, y0 + wr.uniform(14, 56), wr.choice([WARM, WARM, COOL]), 1.3,
                    opacity=round(wr.uniform(0.07, 0.18), 2), stroke_dasharray="3 4"))
    wl.save()
    layer.fx(wl, "fx-wobble")
    for k, (name, seed, op) in enumerate([("ripples-a.svg", 8, 0.11), ("ripples-b.svg", 9, 0.07)]):
        rp = Svg(name, (-20, 622, 1640, 98))
        rr = random.Random(seed)
        y = 627.0
        while y < 716:
            amp = 1.2 + (y - 627) * 0.03
            lam = 40 + (y - 627) * 1.1
            ph = rr.uniform(0, 6.28)
            pts = [(x, y + amp * math.sin(x / lam * 6.283 + ph)) for x in range(-20, 1621, 8)]
            rp.add(path(pl(pts), stroke="#dbe6ff", stroke_width=1 + (y - 627) * 0.012, opacity=round(op * rr.uniform(0.6, 1.2), 3)))
            y += 4 + (y - 627) * 0.09 + rr.uniform(0, 3)
        rp.save()
        layer.fx(rp, "fx-ripples", f"--dur:{9 + k * 4}s;--ax:{(1 if k == 0 else -1) * 1.1}%")
    for extra in WATER_EXTRAS:
        extra(layer)


def draw_boats(layer):
    """A ferry crossing on the right, slowly; a tug on the left, the other way; a rubber duck
    and a periscope for whoever looks closely."""
    F = Inked(line=1.8, edge=1.6)
    F.part(poly([(1122, 648), (1250, 648), (1240, 662), (1132, 662)], "#1f2a4a"))
    F.part(rect(1138, 634, 96, 14, "#dfe4ee", rx=3))
    F.part(rect(1160, 624, 44, 10, "#dfe4ee", rx=3))
    F.detail(rect(1180, 626, 6, 6, "#20263a"), rect(1142, 652, 84, 2, RED))
    for wx in range(1144, 1230, 10):
        F.detail(rect(wx, 637, 6, 7, WARM))
    for wx in (1166, 1190):
        F.detail(rect(wx, 626, 4, 6, "#9ec0ff"))
    ferry = Svg("ferry.svg", (1116, 618, 140, 54))
    ferry.add(F.svg())
    for y in (665, 669):
        ferry.add(line(1126, y, 1246, y, "#dbe6ff", 1, opacity=0.25))
    ferry.save()
    m = layer.mover("fx-cross", 1116, 618, 140, 54, "").motion(x0=120, x1=1460, ay=1.5, dur=75, delay=-30)
    m.fx(ferry)
    m.det("ferry", 1118, 620, 136, 46)

    T = Inked(line=1.8, edge=1.6)
    T.part(poly([(702, 650), (772, 650), (766, 662), (708, 662)], "#242a3c"))
    T.part(rect(716, 638, 30, 12, YEL, rx=2))
    T.part(rect(734, 628, 10, 10, "#242a3c"))
    T.detail(rect(720, 641, 5, 5, WARM), rect(728, 641, 5, 5, WARM), rect(760, 652, 8, 3, RED))
    tug = Svg("tug.svg", (696, 622, 82, 50))
    tug.add(T.svg())
    for y in (665, 669):
        tug.add(line(704, y, 770, y, "#dbe6ff", 1, opacity=0.25))
    tug.save()
    m = layer.mover("fx-cross", 696, 622, 82, 50, "").motion(x0=180, x1=1420, ay=2, dur=48, delay=-7)
    m.fx(tug)
    m.det("boat", 698, 624, 78, 42)

    D = Inked(line=1.6, edge=1.4)
    dx = 800   # the duck sits in open water, right of the robot, under nothing
    D.part(ell(412 + dx, 646, 12, 7.5, YEL))
    D.part(circ(420 + dx, 637, 7, YEL))
    D.part(poly([(426 + dx, 636), (434 + dx, 638.5), (426 + dx, 641)], "#f4a325"))
    D.detail(circ(422 + dx, 635, 1.3, INK))
    D.detail(path(f"M {402 + dx} 647 q 6 -5 12 -1", stroke=YEL_D, stroke_width=1.4, stroke_linecap="round"))
    duck = Svg("duck.svg", (396 + dx, 626, 42, 32))
    duck.add(D.svg())
    duck.save()
    m = layer.mover("fx-bob", 396 + dx, 626, 42, 32, "").motion(ax=14, ay=3, dur=5)
    m.fx(duck)
    m.det("duck", 396 + dx, 626, 42, 32, 0.99)

    P = Inked(line=1.6, edge=1.4)
    P.part(rect(834, 636, 6, 24, STEEL_L, rx=1))
    P.part(rect(830, 630, 16, 8, STEEL_L, rx=2))
    P.detail(circ(844, 634, 2, "#9ec0ff"))
    peri = Svg("periscope.svg", (826, 626, 26, 38))
    peri.add(P.svg())
    peri.add(ell(837, 660, 12, 2.5, "none", stroke="#dbe6ff", stroke_width=1, opacity=0.4))
    peri.save()
    m = layer.mover("fx-tofro", 826, 626, 26, 38, "").motion(ax=-40, ay=0, dur=23, delay=-5, clip=True)
    m.fx(peri, "fx-sink")
    m.det("periscope", 826, 626, 26, 38, 0.66)


def draw_heli(layer):
    """A news helicopter, its searchlight on the dino's tail."""
    hx, hy = 1322, 352
    s = Svg("heli.svg", (hx - 56, hy - 30, 112, 60))
    H = Inked(line=1.8, edge=1.6)
    H.part(path(f"M {hx - 14} {hy - 6} L {hx - 54} {hy - 14} L {hx - 54} {hy - 2} L {hx - 16} {hy + 6} Z", "#2b3350"))
    H.part(poly([(hx - 58, hy - 24), (hx - 50, hy - 24), (hx - 50, hy - 4), (hx - 58, hy - 4)], RED))
    H.part(ell(hx + 6, hy, 26, 14, "#2b3350"))
    H.part(path(f"M {hx + 8} {hy - 12} C {hx + 24} {hy - 12} {hx + 32} {hy - 4} {hx + 30} {hy + 4} L {hx + 8} {hy + 4} Z", "#9ec0ff"))
    H.detail(rect(hx - 6, hy - 20, 6, 8, "#2b3350"), line(hx - 30, hy - 22, hx + 44, hy - 22, "#c9cfdb", 2.4, stroke_linecap="round"))
    H.detail(line(hx - 10, hy + 16, hx + 20, hy + 16, "#c9cfdb", 2), line(hx - 4, hy + 10, hx - 6, hy + 16, "#c9cfdb", 1.4),
             line(hx + 14, hy + 10, hx + 16, hy + 16, "#c9cfdb", 1.4))
    H.detail(ell(hx + 8, hy - 22, 40, 2.6, "#ffffff", opacity=0.35))
    H.detail(circ(hx - 54, hy - 8, 2, RED))
    s.add(g(H.svg(), transform=f"translate({2 * hx} 0) scale(-1 1)"))
    s.save()
    cone = Svg("heli-light.svg", (hx - 90, hy + 8, 110, 140))
    cone.add(poly([(hx - 6, hy + 14), (hx + 6, hy + 14), (hx - 30, hy + 140), (hx - 86, hy + 128)],
                  cone.lin([(0, "#fff4cc", 0.3), (1, "#fff4cc", 0.02)])))
    cone.save()
    m = layer.mover("fx-lift", hx - 92, hy - 96, 206, 246, "").motion(ax=16, ay=62, dur=9, delay=-3)
    m.fx(cone, "fx-beam")
    m.fx(s)
    m.det("helicopter", hx - 60, hy - 30, 120, 60)


# =====================================================================
# The robot, the water it stands in, and the punch. Flat colour, no highlights: blue body,
# yellow joints, red fists and belt, a white head.
# =====================================================================
BLADE, FULLER, TEMPER, RUNE = "#dfe4ee", "#9aa5bb", "#b9c2d2", "#8ff0ff"
HAND = (429, 483)              # the robot's left fist, holding the sword
SWORD = (125, 36, 150)         # blade angle (degrees, pointing down and back), where it leaves the guard, length


def along(c, ang, t, k=0.0):
    """The point t along direction ang from c, k to its side."""
    d = (math.cos(math.radians(ang)), math.sin(math.radians(ang)))
    return (c[0] + d[0] * t - d[1] * k, c[1] + d[1] * t + d[0] * k)


def sword(R):
    """A forged sword in the robot's left fist: a broad steel blade with a temper line, a yellow guard
    with a gem. Its runes are a separate piece, so they can pulse."""
    ang, t0, L = SWORD
    P = lambda t, k=0: along(HAND, ang, t, k)
    blade = [P(t0, -11), P(t0 + L * 0.8, -9), P(t0 + L, 0), P(t0 + L * 0.8, 9), P(t0, 11)]
    R.part(poly(blade, BLADE))
    wave = [P(t0 + 6 + i * 4, 5 + 1.8 * math.sin(i * 0.9)) for i in range(int(L * 0.78 / 4))]
    R.detail(path(pl(wave), stroke=TEMPER, stroke_width=1.6, stroke_linecap="round"))
    R.detail(path(pl([P(t0 + 6, 0), P(t0 + L * 0.72, 0)]), stroke=FULLER, stroke_width=4, stroke_linecap="round"))
    R.part(line(*P(t0 - 4, -25), *P(t0 - 4, 25), YEL, 9, stroke_linecap="round"))
    R.part(circ(*P(t0 - 4), 5.5, RUNE))


def draw_runes():
    """The runes along the sword's fuller, one flat colour."""
    ang, t0, L = SWORD
    pts = [along(HAND, ang, t0 + L * f) for f in (0.14, 0.27, 0.4, 0.53, 0.66)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    s = Svg("runes.svg", (min(xs) - 10, min(ys) - 10, max(xs) - min(xs) + 20, max(ys) - min(ys) + 20))
    for i, (x, y) in enumerate(pts):
        s.add(g(path(GLYPHS[i * 3 % len(GLYPHS)], stroke=RUNE, stroke_width=1.6, stroke_linecap="round", stroke_linejoin="round"),
                transform=f"translate({num(x)} {num(y)}) rotate({num(float(ang - 90))}) scale(0.9)"))
    return s.save()


# Rune-like glyphs, about 8 units across, centred on (0, 0). Made up, none of them a real letter.
GLYPHS = [
    "M 0 -4 L 0 4 M -3 -1 L 0 -4 L 3 -1",
    "M -3 3 L 0 -4 L 3 3 Z",
    "M -3 -3 L 3 -3 L 3 3 L -3 3 Z M 0 0 L 0 0.1",
    "M 0 -4 L 0 4 M 0 -1 L 3 -3",
    "M -3 -4 L 3 4 M 3 -4 L -3 4",
    "M -3 0 L 3 0 M 0 -4 L 0 4 M -2 -4 L 2 -4",
    "M -3 4 L -3 -4 L 3 0 L -3 4",
    "M -3 -3 Q 0 -6 3 -3 M 0 -3 L 0 4",
]


def fist(R, x, y, w=52.0, h=48.0):
    """A red fist, its top-left corner at (x, y), knuckle lines across it."""
    R.part(rect(x, y, w, h, RED, rx=h * 0.24))
    for k in range(3):
        yy = y + h * (0.3 + 0.2 * k)
        R.detail(line(x + 8, yy, x + w - 10, yy, RED_DD, 2, opacity=0.65, stroke_linecap="round"))


def shoulder(R, cx, cy):
    R.part(circ(cx, cy, 36, YEL))
    R.part(path(f"M {cx - 40} {cy} A 40 40 0 0 1 {cx + 40} {cy} L {cx + 30} {cy} A 30 30 0 0 0 {cx - 30} {cy} Z", RED))


def leg(R, x, mirror=False):
    """A leg whose hip is at (x, 466): thigh, knee, shin, a red band, the 01 marking, a piston on
    its outer side, an ankle band and toe lines. Both legs are the same design, mirrored."""
    m = -1 if mirror else 1
    R.part(limb(x, 466, x + 4 * m, 548, 48, BLU))
    R.part(limb(x + 4 * m, 556, x + 7 * m, 652, 52, BLU))
    R.part(rect(x - 25 + 2 * m, 590, 50, 8, WHT))
    R.part(circ(x + 4 * m, 552, 20, YEL))
    R.detail(rect(x - 21, 498, 42, 6, RED))
    R.detail(rect(x - 8, 508, 7, 14, "none", stroke=WHT, stroke_width=2, rx=2.5), rect(x + 4, 508, 2.4, 14, WHT))
    px = x + 27 * m
    R.part(line(px, 528, px + 5 * m, 578, STEEL_L, 3.2, stroke_linecap="round"))
    R.detail(line(px, 528, px + 2 * m, 548, WHT_D, 3.2, stroke_linecap="round"))
    for y in (604, 611):
        R.detail(line(x - 12 + 4 * m, y, x + 20 + 4 * m, y, BLU_DD, 2, stroke_linecap="round"))


def draw_robot(layer):
    s = Svg("robot.svg")
    R = Inked()

    # back arm (the robot's left), hanging, the sword in its fist
    R.part(limb(446, 306, 434, 392, 36, BLU))
    R.part(circ(434, 398, 15, YEL))
    blade_clip = s.clip(rect(0, 0, W, 624, "#000"))
    R.group(f'<g clip-path="{blade_clip}">')
    sword(R)
    R.end()
    R.part(limb(434, 402, 429, 466, 34, BLU))
    R.part(rect(416, 416, 32, 8, WHT), rect(415, 432, 32, 8, WHT))
    R.part(rect(411, 454, 38, 12, RED_D, rx=4))
    fist(R, 403, 460)
    # radar dish on the back shoulder
    R.part(line(440, 288, 412, 242, STEEL_L, 5, stroke_linecap="round"))
    R.group('<g transform="translate(404 232) rotate(-32)">')
    R.part(ell(0, 0, 34, 13, WHT))
    R.detail(ell(0, -2, 26, 8.5, WHT_D), circ(0, 0, 3.6, INK))
    R.end()
    R.part(line(404, 232, 420, 214, WHT_D, 2))
    R.detail(circ(420, 213, 3, RED))

    # legs, standing in the water: everything below the waterline is clipped away
    legs = s.clip(rect(0, 0, W, 624, "#000"))
    R.group(f'<g clip-path="{legs}">')
    leg(R, 500, mirror=True)
    leg(R, 564)
    R.end()

    # hips, torso, chest emblem, vents, belt
    R.part(poly([(478, 440), (582, 440), (574, 478), (486, 478)], BLU_DD))
    R.detail(circ(493, 458, 4, RED), circ(567, 458, 4, RED))
    R.part(poly([(452, 286), (600, 286), (584, 434), (474, 434)], BLU))
    R.detail(line(474, 298, 580, 298, BLU_DD, 1.6), line(474, 298, 486, 432, BLU_DD, 1.6), line(580, 298, 572, 432, BLU_DD, 1.6))
    R.part(circ(527, 334, 25, WHT))
    R.part(poly([(511, 324), (543, 324), (527, 352)], YEL))
    R.part(poly([(488, 376), (568, 376), (563, 430), (493, 430)], BLU_DD))
    for i in range(4):
        R.detail(rect(498 + i * 0.8, 383 + i * 11, 60 - i * 1.6, 6, WHT, rx=3))
    for x, y in [(462, 294), (592, 294), (482, 424), (576, 424), (480, 340), (580, 340)]:
        R.detail(circ(x, y, 2.3, BLU_DD))
    R.part(poly([(472, 428), (588, 428), (584, 446), (476, 446)], RED))
    R.part(rect(517, 427, 24, 20, YEL, rx=2))
    R.detail(rect(521, 431, 16, 12, YEL_D, rx=1.5))
    shoulder(R, 446, 300)

    # neck and head: a white box with a visor, ear bolts, a grille and an antenna
    R.part(rect(513, 254, 32, 36, STEEL, rx=4))
    for y in (264, 272, 280):
        R.detail(line(515, y, 543, y, STEEL_L, 2))
    R.part(line(556, 192, 565, 153, WHT_D, 3, stroke_linecap="round"))
    R.part(circ(566, 148, 5, RED))
    R.part(rect(490, 188, 78, 72, WHT, rx=14))
    R.part(rect(497, 207, 64, 26, INK, rx=9))
    R.detail(rect(504, 216, 50, 8, YEL, rx=4))
    for ex in (490, 568):
        R.part(circ(ex, 220, 10, YEL))
        R.detail(circ(ex, 220, 4, YEL_D))
    for y in (243, 250):
        R.detail(line(516, y, 542, y, WHT_DD, 2.4, stroke_linecap="round"))

    s.add(R.svg())

    # the punching arm (the robot's right) is its own piece so it can keep striking: drawn level and
    # turned up 11 degrees at the shoulder, the speed lines with it; the shoulder cap sits over it
    A = Inked()
    arm = Svg("arm.svg", (596, 226, 290, 118))
    arm.add(g(*(line(x0, 302 + dy, x1, 302 + dy, "#ffffff", 2, opacity=0.38, stroke_linecap="round")
                for dy, x0, x1 in [(-50, 660, 760), (-36, 700, 790), (36, 690, 788), (50, 650, 742)]),
             transform="rotate(-11.2 616 302)"))
    A.group('<g transform="rotate(-11.2 616 302)">')
    A.part(rect(622, 284, 86, 36, BLU, rx=12))
    A.part(circ(712, 302, 15, YEL))
    A.part(rect(718, 285, 80, 34, BLU, rx=10))
    A.part(rect(736, 285, 8, 34, WHT), rect(752, 285, 8, 34, WHT))
    A.part(rect(792, 280, 12, 44, RED_D, rx=4))
    fist(A, 802, 278)
    A.end()
    arm.add(A.svg())
    arm.save()
    S2 = Inked()
    shoulder(S2, 616, 302)
    cap = Svg("shoulder.svg", (570, 256, 92, 92))
    cap.add(S2.svg())
    cap.save()

    s.save()

    # the robot in the water: the same drawing mirrored about the waterline, faint, wobbling;
    # and rings spreading from its legs and the sword's tip (the water itself is in the mid layer)
    refl = Svg("robot-reflection.svg", (290, 624, 420, 96))
    refl.add(g(R.svg(), transform="translate(0 1248) scale(1 -1)", opacity=0.3))
    refl.save()
    tip_x = HAND[0] + (624 - HAND[1]) / math.tan(math.radians(SWORD[0]))
    ring = Svg("ring.svg", (-40, -12, 80, 24))
    ring.add(ell(0, 0, 36, 9, "none", stroke="#dbe6ff", stroke_width=1.6))
    ring.add(ell(0, 0, 24, 6, "none", stroke="#dbe6ff", stroke_width=1.2, opacity=0.7))
    ring.save()

    # behind the robot: two drones photographing it from two sides, their views overlapping
    d1 = draw_drone("drone-a.svg", 298, 176, [(500, 196), (470, 446)])
    d2 = draw_drone("drone-b.svg", 688, 128, [(594, 214), (604, 428)])
    m = layer.mover("fx-swing", *d1.box, style="").motion(th=13, pivot=(485, 321), ay=10, dur=11)
    m.fx(d1)
    m.det("drone", 270, 158, 58, 32, below=True)
    m = layer.mover("fx-swing", *d2.box, style="").motion(th=-11, pivot=(599, 321), ay=8, dur=8.5, delay=-3)
    m.fx(d2)
    m.det("drone", 660, 110, 58, 32)
    WATER_EXTRAS.append(lambda L: (L.fx(refl, "fx-wobble"), [L.at(ring, "fx-ring", cx, 626, f"--k:{k};animation-delay:-{i * 1.1:.1f}s")
                                                                 for i, (cx, k) in enumerate([(503, 1.0), (568, 1.1), (tip_x, 0.5)])]))
    layer.art(s)
    layer.fx(arm, "fx-punch", "transform-origin:6.9% 64.4%")
    layer.fx(cap)
    bar = Svg("visor-bar.svg", (504, 216, 12, 8))
    bar.add(rect(504, 216, 12, 8, "#fff8d0", rx=4))
    bar.save()
    layer.fx(bar, "fx-visor")
    layer.fx(draw_runes(), "fx-glow")
    # in front of the robot: the flash of the punch and its sparks
    cx, cy = IMPACT
    flash = Svg("flash.svg", (cx - 70, cy - 70, 140, 140))
    flash.add(circ(cx, cy, 70, flash.rad([(0, "#ffffff", 0.6), (0.3, "#fff1b0", 0.3), (1, YEL, 0)])))
    flash.save()
    layer.fx(flash, "fx-flash")
    sp = Svg("sparks.svg", (cx - 110, cy - 100, 220, 200))
    rr = random.Random(9)
    for _ in range(22):
        a = rr.uniform(0, math.pi * 2)
        r0 = rr.uniform(34, 52)
        r1 = r0 + rr.uniform(14, 46)
        sp.add(line(cx + r0 * math.cos(a), cy + r0 * math.sin(a), cx + r1 * math.cos(a), cy + r1 * math.sin(a),
                    rr.choice(["#ffffff", YEL_L, YEL]), rr.uniform(1.2, 2.6), stroke_linecap="round", opacity=round(rr.uniform(0.6, 1), 2)))
    for _ in range(9):
        a = rr.uniform(0, math.pi * 2)
        r0 = rr.uniform(48, 92)
        x, y = cx + r0 * math.cos(a), cy + r0 * math.sin(a)
        sz = rr.uniform(3, 6)
        sp.add(poly([(x, y - sz), (x + sz * 0.8, y), (x, y + sz * 0.7), (x - sz, y + 0.5)], rr.choice([RED_D, "#3a2a2a", WHT_D])))
    sp.save()
    layer.fx(sp, "fx-sparks")
    layer.det("robot", 300, 132, 564, 506, 0.99)
    return (566, 148)


def draw_drone(name, x, y, targets):
    xs = [x - 26, x + 26] + [t[0] for t in targets]
    ys = [y - 12, y + 14] + [t[1] for t in targets]
    x0, y0 = min(xs) - 4, min(ys) - 4
    s = Svg(name, (x0, y0, max(xs) - x0 + 4, max(ys) - y0 + 4))
    cam = (x, y + 10)
    s.add(poly([cam] + targets, "#ffffff", opacity=0.06))
    for tx, ty in targets:
        s.add(line(cam[0], cam[1], tx, ty, "#ffffff", 1.2, opacity=0.5, stroke_dasharray="5 5"))
    s.add(line(x - 22, y, x + 22, y, STEEL_L, 2.6))
    s.add(line(x - 14, y + 3, x - 20, y + 12, STEEL_L, 1.6))
    s.add(line(x + 14, y + 3, x + 20, y + 12, STEEL_L, 1.6))
    for dx in (-22, 22):
        s.add(rect(x + dx - 1.5, y - 5, 3, 5, STEEL))
        s.add(ell(x + dx, y - 6, 15, 2.6, "#ffffff", opacity=0.55))
    s.add(rect(x - 11, y - 4, 22, 9, WHT, rx=3))
    s.add(rect(x - 11, y + 1, 22, 4, WHT_D, rx=2))
    s.add(circ(x, y + 9, 4, INK))
    s.add(circ(x + 1, y + 8, 1.4, "#9cc2ff"))
    s.add(circ(x + 9, y - 1, 1.6, RED))
    return s.save()


# =====================================================================
# Near buildings framing the scene, with people and labs.
# =====================================================================
def draw_near(layer):
    s = Svg("near.svg")
    L = Svg("near-lights.svg")
    GROUPS = [Svg("near-lights-a.svg"), Svg("near-lights-b.svg"), Svg("near-lights-c.svg")]
    rng = random.Random(41)
    lights = []
    walkers = []

    def wins(x0, y0, x1, y1, ww, wh, gx, gy, lit=0.45, skip=None):
        y = y0
        while y + wh <= y1:
            x = x0
            while x + ww <= x1 + 0.01:
                if not (skip and skip(x, y)):
                    s.add(rect(x, y, ww, wh, "#090c16"))
                    s.add(line(x, y + wh, x + ww, y + wh, "#1c2440", 1))
                    r = rng.random()
                    if r < lit + 0.1:
                        T = L if r < lit * 0.7 else rng.choice(GROUPS)
                        c = rng.choice([WARM, WARM, WARM2, COOL])
                        T.add(rect(x, y, ww, wh, c, opacity=round(rng.uniform(0.7, 0.95), 2)))
                        T.add(rect(x, y + wh * 0.62, ww, wh * 0.38, "#000000", opacity=0.18))
                        if rng.random() < 0.3:  # someone in the room, walking about (placed after the art)
                            walkers.append((x, y, ww, wh, x + ww * rng.uniform(0.25, 0.75), wh * 0.8,
                                            round(rng.uniform(6, 15), 1), round(-rng.uniform(0, 12), 1), round(rng.uniform(0.3, 0.7), 2)))
                x += ww + gx
            y += wh + gy

    # ---- left tower: survey crew on the roof, two labs ----
    x0, x1, top = -24, 196, 352
    s.add(rect(x0, top, x1 - x0, H - top + 10, s.lin([(0, "#161d33"), (1, "#0a0e19")])))
    s.add(poly([(x1, top), (x1 + 16, top + 9), (x1 + 16, H + 10), (x1, H + 10)], "#080b14"))
    s.add(line(x1 + 16, top + 9, x1 + 16, H, RIM, 1.4, opacity=0.4))
    s.add(rect(x0, top - 9, x1 - x0 + 4, 10, "#1b2340"))
    s.add(line(x0, top - 9, x1 + 4, top - 9, "#4a5683", 1.3))
    in_lab = lambda x, y: 38 <= x <= 152 and 412 <= y <= 574
    wins(-10, 372, 186, 712, 24, 19, 10, 13, skip=in_lab)
    # coded targets on the facade, for photogrammetry
    for tx in (14, 172):
        s.add(circ(tx, 364, 6.5, "#f2f2f2"))
        s.add(circ(tx, 364, 4.6, "none", stroke=INK, stroke_width=2.2, stroke_dasharray="3 2.2"))
        s.add(circ(tx, 364, 1.8, INK))
    # lab 1: point cloud and detections on screen
    for (ly, kind) in [(414, "pc"), (504, "hs")]:
        s.add(rect(40, ly, 112, 64, "#06080f"))
        L.add(rect(40, ly, 112, 64, L.lin([(0, "#3b2f4a"), (1, "#1f1a2a")])))
        L.add(circ(60, ly + 6, 26, L.rad([(0, WARM, 0.55), (1, WARM, 0)])))
        L.add(line(40, ly + 50, 152, ly + 50, "#120e18", 2.4))
        if kind == "pc":
            L.add(rect(86, ly + 22, 30, 20, "#0f1c3d"), rect(120, ly + 22, 30, 20, "#0f1c3d"))
            L.add(rect(87, ly + 23, 28, 18, "#2a4fa8", opacity=0.7))
            for _ in range(46):
                a = rng.uniform(0, math.pi * 2)
                rr = rng.uniform(0, 1) ** 0.6
                L.add(circ(101 + 8 * rr * math.cos(a), ly + 32 + 6 * rr * math.sin(a), 0.6, "#cfe2ff", opacity=0.9))
            L.add(rect(121, ly + 23, 28, 18, "#173226"))
            L.add(rect(126, ly + 27, 9, 7, "none", stroke=YEL, stroke_width=0.9))
            L.add(rect(137, ly + 30, 8, 8, "none", stroke=YEL, stroke_width=0.9))
            L.add(person(70, ly + 50, 22, "#2a2f45"))
            L.add(rect(86, ly + 42, 64, 3, "#120e18"))
        else:
            # a hyperspectral camera on a tripod, a colour chart, and a spectrum on the monitor
            L.add(line(66, ly + 50, 60, ly + 64, "#120e18", 1.4), line(66, ly + 50, 72, ly + 64, "#120e18", 1.4),
                  line(66, ly + 50, 66, ly + 64, "#120e18", 1.4))
            L.add(rect(60, ly + 40, 14, 10, "#222634", rx=1.5), circ(76, ly + 45, 3, "#0c0f17"))
            chart = ["#735244", "#c29682", "#627a9d", "#576c43", "#8580b1", "#67bdaa",
                     "#d67e2c", "#505ba6", "#c15a63", "#5e3c6c", "#9dbc40", "#e0a32e"]
            for i, c in enumerate(chart):
                L.add(rect(96 + (i % 6) * 4.6, ly + 14 + (i // 6) * 4.6, 4, 4, c))
            L.add(rect(94.5, ly + 12.5, 29, 11.5, "none", stroke="#0c0f17", stroke_width=1))
            L.add(rect(118, ly + 30, 30, 18, "#0f1426"))
            L.add(rect(119, ly + 31, 28, 16, L.lin([(0, "#6b5bff"), (0.25, "#2f8bff"), (0.5, "#22c38e"), (0.72, YEL), (1, RED)], x1=0, y1=0, x2=1, y2=0), opacity=0.35))
            L.add(path(f"M 120 {ly + 45} C 126 {ly + 44} 128 {ly + 34} 133 {ly + 36} S 140 {ly + 43} 146 {ly + 33}", stroke="#ffffff", stroke_width=1.1))
        s.add(rect(40, ly, 112, 64, "none", stroke="#1c2440", stroke_width=2))
        s.add(line(96, ly, 96, ly + 64, "#1c2440", 1.6))
        L.add(line(96, ly, 96, ly + 64, "#14101c", 1.6))
    # roof: total station, GNSS rover, drone pilot, laptop
    ry = top - 9
    s.add(rect(126, ry - 28, 44, 28, "#141b31"))
    s.add(rect(140, ry - 20, 12, 20, "#0b0f1c"))
    L.add(rect(140, ry - 20, 12, 20, WARM, opacity=0.7))
    s.add(line(170, ry - 28, 170, ry, RIM, 1.1, opacity=0.4))
    s.add(line(22, ry, 22, ry - 64, "#222b4a", 2.4))
    for yy, hw in [(ry - 22, 8), (ry - 42, 6)]:
        s.add(line(22 - hw, yy, 22 + hw, yy, "#222b4a", 1.4))
    lights.append((22, ry - 66))
    layer.det("people", 42, ry - 26, 82, 30)
    s.add(person(54, ry, 16, "#2b3350", helmet="#f2f2f2", vest=True, arms=[(2.5, 6), (5.5, 2)]))
    s.add(line(66, ry - 9, 61, ry, "#c8cdd8", 1.1), line(66, ry - 9, 71, ry, "#c8cdd8", 1.1), line(66, ry - 9, 66, ry, "#c8cdd8", 1.1))
    s.add(rect(62.5, ry - 14, 7, 5, YEL, rx=1), circ(70, ry - 11.5, 1.4, INK))
    s.add(person(86, ry, 16, "#2b3350", helmet="#f2f2f2", vest=True, arms=[(-2.4, 7), (3.2, -1)]))
    s.add(line(91, ry - 20, 91, ry, "#c8cdd8", 1.2))
    s.add(ell(91, ry - 21, 3.6, 1.3, WHT))
    s.add(person(112, ry, 16, "#30395a", arms=[(2.6, -2), (-2.6, -2)]))
    s.add(rect(109, ry - 13.5, 7, 3, "#151925"))
    s.add(rect(30, ry - 4, 12, 4, "#3a3328"))
    L.add(rect(31, ry - 9, 10, 6, "#9ec0ff", opacity=0.85))
    s.add(rect(31, ry - 9, 10, 6, "#202638"))
    # ---- second building on the left with a water tower ----
    bx0, bx1, btop = 196, 300, 470
    s.add(rect(bx0 + 16, btop, bx1 - bx0 - 16, H - btop + 10, s.lin([(0, "#141a2f"), (1, "#0a0e19")])))
    s.add(poly([(bx1, btop), (bx1 + 12, btop + 6), (bx1 + 12, H + 10), (bx1, H + 10)], "#080b14"))
    s.add(line(bx1 + 12, btop + 6, bx1 + 12, H, RIM, 1.2, opacity=0.35))
    s.add(line(bx0 + 16, btop, bx1, btop, "#3e4973", 1.2))
    wins(222, 488, 292, 712, 16, 16, 9, 12)
    for lx in (226, 262):
        s.add(line(lx, btop, lx + 4, btop - 26, "#121828", 2.2))
    s.add(rect(218, btop - 64, 56, 40, "#271c1c"))
    for yy in (btop - 54, btop - 40):
        s.add(line(218, yy, 274, yy, "#3d2d2b", 1.2))
    s.add(poly([(214, btop - 64), (246, btop - 84), (278, btop - 64)], "#201717"))
    s.add(line(274, btop - 64, 274, btop - 24, RIM, 1.2, opacity=0.35))
    s.add(line(278, btop - 64, 246, btop - 84, RIM, 1.1, opacity=0.35))

    # ---- right tower: a billboard, a family watching, a crane ----
    rx0, rtop = 1420, 330
    s.add(rect(rx0, rtop, W - rx0 + 30, H - rtop + 10, s.lin([(0, "#161d33"), (1, "#0a0e19")])))
    s.add(poly([(rx0, rtop), (rx0 - 16, rtop + 9), (rx0 - 16, H + 10), (rx0, H + 10)], "#080b14"))
    s.add(line(rx0 - 16, rtop + 9, rx0 - 16, H, RIM, 1.4, opacity=0.45))
    s.add(rect(rx0 - 4, rtop - 9, W - rx0 + 34, 10, "#1b2340"))
    s.add(line(rx0 - 4, rtop - 9, W + 30, rtop - 9, "#4a5683", 1.3))
    # billboard
    s.add(rect(1438, 372, 156, 96, "#0b0f1b"), rect(1442, 376, 148, 88, "#141a2c"))
    L.add(rect(1442, 376, 148, 88, "#efe6d0"))
    L.add(circ(1486, 420, 30, RED), rect(1522, 386, 54, 54, BLU), poly([(1500, 456), (1546, 456), (1523, 414)], YEL))
    L.add(rect(1452, 446, 58, 7, INK))
    L.add(rect(1442, 376, 148, 88, L.lin([(0, "#000", 0.25), (0.5, "#000", 0), (1, "#000", 0.3)])))
    for lx in (1466, 1566):
        s.add(line(lx, 468, lx, 478, "#1f2640", 2))
        L.add(poly([(lx - 3, 468), (lx + 3, 468), (lx + 24, 380), (lx - 24, 380)], "#fff4cc", opacity=0.06))
    wins(1432, 492, 1600, 712, 24, 19, 10, 13)
    # crane
    cx = 1574
    for k in range(9):
        y = rtop - 9 - k * 15
        s.add(line(cx - 5, y, cx + 5, y - 15, "#1a2138", 1.2), line(cx - 5, y - 15, cx + 5, y, "#1a2138", 1.2))
    s.add(line(cx - 5, rtop - 9, cx - 5, rtop - 144, "#1a2138", 2), line(cx + 5, rtop - 9, cx + 5, rtop - 144, "#1a2138", 2))
    jy = rtop - 144
    s.add(line(1462, jy, 1640, jy, "#1a2138", 2.4), line(1462, jy + 9, 1640, jy + 9, "#1a2138", 1.6))
    for k in range(13):
        x = 1462 + k * 14
        s.add(line(x, jy + 9, x + 7, jy, "#1a2138", 1), line(x + 7, jy, x + 14, jy + 9, "#1a2138", 1))
    s.add(line(cx, jy, cx - 50, jy - 20, "#1a2138", 1.2), line(cx, jy - 20, cx - 50, jy - 20, "#1a2138", 1.2))
    s.add(line(cx, jy - 20, cx, jy, "#1a2138", 2))
    s.add(rect(1604, jy + 9, 24, 14, "#141a2c"))
    s.add(rect(cx - 16, jy + 4, 13, 12, "#141a2c"))
    L.add(rect(cx - 14, jy + 6, 9, 6, WARM, opacity=0.8))
    hook = Svg("hook.svg", (1488, jy + 9, 24, 90))
    hook.add(line(1500, jy + 9, 1500, jy + 80, "#3a4366", 1))
    hook.add(rect(1495, jy + 80, 10, 8, YEL_D), path(f"M 1500 {jy + 88} q 0 7 5 6", stroke="#3a4366", stroke_width=1.6))
    hook.save()
    layer.fx(hook, "fx-sway", "transform-origin:50% 0;--th:3deg;--dur:5.5s")
    s.add(line(1462, jy, 1640, jy, RIM, 1, opacity=0.3))
    lights.append((cx, jy - 22))
    # the family watching: one takes a photo, one points, one waves
    ry = rtop - 9
    layer.det("people", 1441, ry - 28, 66, 32)
    s.add(person(1452, ry, 17, "#2c3048", arms=[(-1.6, -6), (1.8, -6)]))
    s.add(rect(1449.5, ry - 22, 5, 4, "#0c0f17"))
    s.add(person(1470, ry, 12, RED, arms=[(-7, -5), (2, 5)]))
    s.add(person(1484, ry, 11, YEL, arms=[(-2, 5), (3, -6)]))
    s.add(person(1497, ry, 12.5, BLU, arms=[(-2, 5), (2, 5)]))
    phone = (1452, ry - 21)
    # ---- second building on the right ----
    bx0, bx1, btop = 1316, 1404, 478
    s.add(rect(bx0, btop, bx1 - bx0, H - btop + 10, s.lin([(0, "#141a2f"), (1, "#0a0e19")])))
    s.add(poly([(bx0, btop), (bx0 - 12, btop + 6), (bx0 - 12, H + 10), (bx0, H + 10)], "#080b14"))
    s.add(line(bx0 - 12, btop + 6, bx0 - 12, H, RIM, 1.2, opacity=0.35))
    s.add(line(bx0, btop, bx1, btop, "#3e4973", 1.2))
    wins(1324, 494, 1398, 712, 16, 16, 9, 12)
    # a cat in one window, watching
    L.add(rect(1349, 522, 16, 16, WARM, opacity=0.9))
    L.add(ell(1357, 535, 5.5, 3.5, "#14121a"), circ(1361.5, 530.5, 3, "#14121a"))
    L.add(poly([(1359, 529), (1360, 526), (1361.5, 528.5)], "#14121a"), poly([(1362, 528.5), (1363.5, 526), (1364, 529)], "#14121a"))
    L.add(path("M 1352 536 q -3 -5 2 -7", stroke="#14121a", stroke_width=1.3, stroke_linecap="round"))
    layer.det("cat", 1347, 520, 20, 20, 0.93)
    # a smith forging a sword on the roof: furnace, anvil, a glowing blade, two finished swords
    s.add(rect(1322, btop - 20, 22, 20, "#33231f"), rect(1336, btop - 34, 6, 14, "#2a1c19"))
    s.add(rect(1327, btop - 12, 12, 8, "#140c0a"))
    L.add(rect(1327, btop - 12, 12, 8, "#ff7a1a"), circ(1333, btop - 8, 18, L.rad([(0, "#ff8a2a", 0.45), (1, "#ff8a2a", 0)])))
    for x0, x1 in [(1315, 1311), (1319, 1317)]:
        s.add(line(x0, btop, x1, btop - 22, "#c9cfdb", 1.6), line(x1 - 2.5, btop - 17, x1 + 2.5, btop - 17, YEL_D, 1.4))
    s.add(rect(1352, btop - 10, 20, 3, "#2a3040"), rect(1358, btop - 7, 8, 4, "#2a3040"), rect(1355, btop - 3, 14, 3, "#2a3040"))
    L.add(line(1350, btop - 11.5, 1373, btop - 11.5, "#ff9a2e", 2, stroke_linecap="round"),
          circ(1361, btop - 12, 10, L.rad([(0, "#ffb347", 0.5), (1, "#ffb347", 0)])))
    s.add(person(1384, btop, 15, "#3b2f2a", arms=[(-3.5, -6.5), (2.2, 5)]))
    layer.det("forge and fire", 1306, 438, 92, 44, 0.91)
    s.add(rect(1376.5, btop - 21, 5, 3.4, "#20242e"), line(1379, btop - 19, 1381, btop - 13, "#20242e", 1.2))
    s.save()
    L.save()
    layer.art(s)
    layer.art(L, "lights", "--on:1.55s")
    for k, G in enumerate(GROUPS):
        G.save()
        layer.art(G, f"lights lights-{'abc'[k]}", f"--on:{1.55 + k * 0.25:.2f}s;animation-delay:-{k * 3}s")
    # the people: one silhouette, shown in each of those windows, pacing to its own rhythm, clipped by the window
    wk = Svg("walker.svg", (0, 0, 12, 16))
    wk.add(rect(0, 6.5, 12, 9.5, "#1a1420", rx=4), circ(6, 3.4, 3.4, "#1a1420"))
    wk.save()
    for x, y, ww, wh, px, sz, dur, delay, span in walkers:
        m = layer.mover("", x, y, ww, wh, "").motion(clip=True)
        m.img(wk, "fx-walk", px - sz * 0.375, y + wh - sz, sz * 0.75, f"--dur:{dur}s;--span:{span * 100:.0f}%;animation-delay:{delay}s")
    em = Svg("embers.svg", (1348, btop - 30, 28, 22))
    er = random.Random(4)
    for _ in range(9):
        em.add(circ(er.uniform(1351, 1373), er.uniform(btop - 28, btop - 13), er.uniform(0.6, 1.2), er.choice(["#ffd27a", "#ff9a2e", "#fff1c2"])))
    em.save()
    layer.fx(em, "fx-ember")
    return lights, phone


# =====================================================================
# Foreground: a pier railing with two lamps.
# =====================================================================
def draw_front():
    s = Svg("front.svg")
    dark = "#04060b"
    deck = 678
    for lx in (262, 1346):
        s.add(circ(lx + 16, 566, 70, s.rad([(0, WARM, 0.32), (0.4, WARM, 0.1), (1, WARM, 0)])))
    s.add(rect(-20, deck, 1640, 60, dark))
    s.add(line(-20, deck - 12, 1620, deck - 12, dark, 4))
    s.add(line(-20, deck, 1620, deck, dark, 3))
    for x in range(-12, 1620, 56):
        s.add(rect(x, deck - 18, 5, 40, dark))
    for lx in (262, 1346):
        s.add(rect(lx - 3, 568, 6, deck - 568, dark))
        s.add(path(f"M {lx} 572 C {lx} 556 {lx + 8} 552 {lx + 16} 552", stroke=dark, stroke_width=4))
        s.add(poly([(lx + 9, 552), (lx + 23, 552), (lx + 20, 560), (lx + 12, 560)], dark))
        s.add(ell(lx + 16, 561, 5, 2.4, "#fff1c2"))
        s.add(line(lx + 3, 576, lx + 3, deck, WARM, 1, opacity=0.35))
    # a life ring and a gull
    s.add(circ(800, deck - 8, 8, "none", stroke=RED, stroke_width=4.4))
    s.add(circ(800, deck - 8, 8, "none", stroke="#f2f2f2", stroke_width=4.4, stroke_dasharray="6.28 6.28"))
    s.add(path(f"M 1104 {deck - 14} q 6 -7 12 -2 q 4 -3 9 0 q -5 2 -7 6 z", "#d8dce6"),
          path(f"M 1116 {deck - 16} l 6 -4", stroke="#d8dce6", stroke_width=1.4))
    return s.save()


# =====================================================================
# Very near: a bollard with its rope and a gull on the left, a surveyor at a total station on
# the right, both cut by the frame. They move the most.
# =====================================================================
def draw_close(layer):
    s = Svg("close.svg")
    C = Inked(line=4, edge=5)
    # bollard, and the gull on it
    C.part(rect(66, 600, 68, 150, "#232a3d", rx=8))
    C.part(ell(100, 600, 44, 15, "#303852"))
    C.detail(ell(100, 600, 30, 8, "#3b4460"))
    C.part(poly([(76, 582), (62, 578), (68, 590)], "#b7c0d0"))
    C.part(ell(96, 582, 21, 11, WHT))
    C.part(circ(114, 568, 9.5, WHT))
    C.part(poly([(122, 565), (136, 569), (122, 572)], "#f4a325"))
    C.part(line(131, 569, 146, 583, YEL, 4.4, stroke_linecap="round"))   # the fry
    C.detail(line(133, 571, 144, 581, "#f8d270", 1.6, stroke_linecap="round"))
    C.detail(path("M 80 582 Q 94 568 112 580", stroke=LINE, stroke_width=2, stroke_linecap="round"))
    C.detail(circ(116, 566, 1.8, INK))
    C.detail(line(92, 592, 90, 600, "#f4a325", 2.2, stroke_linecap="round"), line(102, 592, 104, 600, "#f4a325", 2.2, stroke_linecap="round"))
    # a tripod; the camera on it is its own piece, panning (draw below)
    for x1, y1 in [(1398, 752), (1452, 758), (1500, 746)]:
        C.part(line(1446, 592, x1, y1, STEEL_L, 8, stroke_linecap="round"))
    C.part(rect(1428, 584, 36, 12, STEEL, rx=3))
    # the journalist, from behind, in a cap, eye to the viewfinder
    C.part(path("M 1480 606 C 1492 598 1502 604 1510 618", stroke="#2b3350", stroke_width=18, stroke_linecap="round"))
    C.part(circ(1478, 604, 9, "#d9b08c"))
    C.part(rect(1506, 616, 64, 140, "#2b3350", rx=18))
    C.detail(rect(1526, 616, 24, 30, "#1d2238", rx=4), rect(1514, 660, 48, 6, "#1d2238"))
    C.part(circ(1538, 598, 21, "#d9b08c"))
    C.part(path("M 1512 594 A 26 26 0 0 1 1564 594 Z", "#1d2238"))
    C.part(rect(1508, 590, 24, 8, "#1d2238", rx=3))
    s.add(C.svg())
    s.save()
    layer.art(s)
    # the TV camera, panning to follow the fight, its REC light blinking
    cam = Svg("camera.svg", (1390, 528, 132, 58))
    K = Inked(line=4, edge=5)
    K.part(rect(1420, 548, 84, 36, "#2f3544", rx=7))
    K.part(rect(1396, 556, 30, 22, "#20263a", rx=4))
    K.detail(circ(1398, 567, 7, "#101320"), circ(1398, 567, 4, "#9ec0ff"))
    K.part(rect(1494, 540, 22, 14, "#20263a", rx=3))
    K.detail(rect(1498, 543, 14, 8, "#9ec0ff"))
    K.part(rect(1436, 534, 50, 10, "#3b4252", rx=5))
    K.detail(rect(1440, 536, 42, 6, "#555c6e", rx=3))
    K.detail(rect(1470, 560, 26, 8, WHT, rx=2))
    cam.add(K.svg())
    cam.save()
    rec = Svg("rec.svg", (-5, -5, 10, 10))
    rec.add(circ(0, 0, 4, RED), circ(0, 0, 2, "#ff8a7a"))
    rec.save()
    m = layer.mover("fx-pan", 1390, 528, 132, 58, "").motion(th=4, pivot=(1446, 592), dur=7)
    m.fx(cam)
    m.at(rec, "fx-rec", 1509, 548)
    layer.det("seagull eating a fry", 58, 556, 92, 46, 0.87)
    layer.det("journalist", 1392, 528, 184, 180)


# =====================================================================
# Tanks on the far quay, firing up at the monster. Flat, inked like the giants.
# =====================================================================
TANK, TANK_D, TANK_L = "#7b874f", "#434b2a", "#aab47e"
TARGET = (990, 430)   # where the tanks aim, at the monster's belly


def tank(T, x, y, face=1):
    """A small tank: tracks resting on y, centred on x, facing right (face=1) or left (-1), its gun
    raised toward TARGET. Returns the muzzle."""
    f = face
    T.part(rect(x - 27, y - 10, 54, 10, TANK_D, rx=5))
    for i in range(6):
        T.detail(circ(x - 20 + i * 8, y - 5, 2.3, TANK_L))
    T.part(poly([(x - 27 * f, y - 10), (x - 22 * f, y - 17), (x + 21 * f, y - 17), (x + 27 * f, y - 10)], TANK))
    gx, gy = x + 3 * f, y - 22
    a = math.atan2(-(TARGET[1] - gy), TARGET[0] - gx)
    mx, my = gx + 25 * math.cos(a), gy - 25 * math.sin(a)
    T.part(line(gx, gy, mx, my, TANK_D, 3.2))
    T.part(path(f"M {num(x - 13 * f)} {y - 17} L {num(x - 10 * f)} {y - 24} Q {x} {y - 29} {num(x + 10 * f)} {y - 24} "
                f"L {num(x + 14 * f)} {y - 17} Z", TANK))
    T.detail(rect(x - 2.5 - 6 * f, y - 22, 5, 2.6, YEL))
    return (mx + 4 * math.cos(a), my - 4 * math.sin(a))


def draw_tanks(layer):
    """Four tanks patrolling the quay, each at its own pace, firing in turn."""
    flash = Svg("muzzle.svg", (-9, -9, 18, 18))
    pts = []
    for k in range(12):
        rr = 9 if k % 2 == 0 else 3.4
        pts.append((rr * math.cos(math.pi * k / 6), rr * math.sin(math.pi * k / 6)))
    flash.add(poly(pts, YEL_L), circ(0, 0, 3, "#fff6d6"))
    flash.save()
    for i, (x, face, ax, dur) in enumerate([(640, 1, 38, 23), (716, 1, 90, 15), (792, 1, 24, 31), (1262, -1, -70, 19)]):
        T = Inked(line=1.8, edge=1.6)
        mx, my = tank(T, x, 612, face)
        t = Svg(f"tank-{i + 1}.svg", (x - 32, 574, 64, 42))
        t.add(T.svg())
        t.save()
        m = layer.mover("fx-patrol", x - 34, 560, 68, 56, "").motion(ax=ax, dur=dur, delay=-i * 5)
        m.fx(t)
        m.at(flash, "fx-muzzle", mx, my, f"--fire:{2.9 + i * 0.85:.2f}s")
        m.det("tank", x - 30, 578, 60, 38)


# =====================================================================
# A yellow GT coupe of my own design, parked on the pier under the left lamp, lights on.
# =====================================================================
def draw_car(layer):
    """A long-bonnet fastback coupe driving along the pier, right to left, lights on, round again."""
    s = Svg("car.svg", (284, 630, 330, 70))
    C = Inked(line=2.6, edge=3.2)
    body = ("M 300 684 L 294 676 Q 292 666 302 663 L 340 646 Q 352 639 366 639 L 380 639 Q 392 641 400 654 "
            "L 442 658 Q 455 660 456 669 L 456 678 Q 456 684 449 684 Z")
    C.part(path(body, YEL))
    C.detail(path("M 350 656 L 357 645 L 380 644 L 393 655 Z", "#1b2337"))
    C.detail(path("M 318 662 L 346 647 L 346 656 L 322 663 Z", "#1b2337"))
    C.detail(rect(300, 669, 149, 5, RED))
    C.detail(line(347, 658, 347, 682, LINE, 1.3))
    C.detail(circ(374, 675, 6, WHT), circ(374, 675, 2.4, BLU))
    C.detail(circ(450, 666, 3.4, "#fff4c8"), rect(293, 666, 4, 5, RED_D, rx=1))
    C.detail(line(297, 662, 306, 659, LINE, 2.2, stroke_linecap="round"))
    for wx in (324, 428):
        C.detail(path(f"M {wx - 16} 685 A 16 16 0 0 1 {wx + 16} 685 Z", LINE))
        C.part(circ(wx, 685, 12, "#141821"))
        C.detail(circ(wx, 685, 6.5, WHT), circ(wx, 685, 2.6, RED))
    # drawn facing right, shown facing left: the whole car is mirrored about its middle
    s.add(g(poly([(452, 662), (612, 638), (612, 694), (452, 674)], s.lin([(0, "#fff4c8", 0.32), (1, "#fff4c8", 0)], x1=0, y1=0, x2=1, y2=0)),
            C.svg(), transform="translate(898 0) scale(-1 1)"))
    s.save()
    m = layer.mover("fx-cross", 284, 630, 330, 70, "").motion(x0=1780, x1=-420, ay=0, dur=24, delay=6)
    m.fx(s)
    m.det("car", 440, 634, 174, 66)


# =====================================================================
def main():
    sky = Layer("l-sky", 0.02, 0, 0)
    clouds = Layer("l-clouds", 0.05, 0.2, 0)
    far = Layer("l-far", 0.1, 0.1, 4)
    mon = Layer("l-monster", 0.22, 0.6, 24)
    mid = Layer("l-mid", 0.3, 0.25, 7)
    rob = Layer("l-robot", 0.38, 0.8, 20)
    near = Layer("l-near", 0.6, 0.45, 9)
    front = Layer("l-front", 0.9, 0.35, 12)
    close = Layer("l-close", 1.3, 0.5, 14)

    draw_stars()
    light = draw_light()
    sky.art(draw_sky())
    clouds.fx(draw_cloud("cloud-a.svg", 770, 292, 500, 44, [(0, 1, 0), (0.08, 0.4, 1), (0.56, 0.3, 1), (0.16, 0.16, 2)],
                         edge="#e8bd52", edge_op=0.95), "fx-cloud")
    ufo = Svg("ufo.svg", (150, 76, 44, 22))
    U = Inked(line=1.6, edge=1.4)
    U.part(path("M 162 88 A 10 8 0 0 1 182 88 Z", "#9ec0ff"))
    U.part(ell(172, 90, 20, 5, "#5b6d92"))
    U.detail(circ(160, 90, 1.6, YEL), circ(172, 92.5, 1.6, RED), circ(184, 90, 1.6, YEL))
    ufo.add(U.svg())
    ufo.save()
    m = clouds.mover("fx-dart", 150, 74, 44, 26, "").motion(ax=46, ay=-8, dur=14)
    m.fx(ufo)
    m.det("ufo", 150, 76, 44, 22, 0.12)
    clouds.fx(draw_cloud("cloud-b.svg", 96, 76, 380, 36, [(0.06, 0.94, 0), (0.0, 0.42, 1), (0.52, 0.3, 1), (0.1, 0.18, 2)],
                         edge="#5d6178", edge_op=0.75), "fx-cloud", "animation-delay:-20s")
    clouds.fx(draw_cloud("cloud-c.svg", 1296, 226, 290, 32, [(0, 1, 0), (0.42, 0.42, 1), (0.1, 0.24, 1)], edge="#b0965a", edge_op=0.85),
              "fx-cloud", "animation-delay:-35s")

    birds = Svg("birds.svg", (1060, 110, 130, 90))
    for bx, by, k in [(1078, 150, 1.0), (1096, 136, 0.8), (1112, 160, 0.9), (1130, 126, 0.7), (1150, 146, 0.8), (1168, 120, 0.6)]:
        birds.add(path(f"M {num(bx - 7 * k)} {num(by)} Q {num(bx - 3.5 * k)} {num(by - 4.5 * k)} {num(float(bx))} {num(by + 0.5 * k)} "
                       f"Q {num(bx + 3.5 * k)} {num(by - 4.5 * k)} {num(bx + 7 * k)} {num(by)}", stroke="#0c1020", stroke_width=round(1.8 * k, 2),
                       stroke_linecap="round", stroke_linejoin="round"))
    birds.save()
    clouds.fx(birds, "fx-birds")
    far.art(draw_far())
    sl = draw_searchlight()
    for bx, by, a0, a1, dur in [(362, 486, -24, 6, 13), (728, 492, 14, -10, 11), (1318, 480, -8, 22, 15)]:
        far.at(sl, "fx-search", bx - 35, by - 460, f"--a0:{a0}deg;--a1:{a1}deg;--dur:{dur}s")
    far.at(light, "fx-light", 344 - 20, 296 - 20, "animation-delay:-.4s")
    draw_jets(far)
    draw_wheel(far)

    mon.fx(draw_burst(), "fx-burst")
    draw_monster(mon)
    draw_satellite(mon)
    mon.det("monster", 836, 94, 428, 548, 0.98)
    ax, ay = draw_robot(rob)
    rob.at(light, "fx-light", ax - 20, ay - 20, "animation-delay:-.8s")
    for x, y in draw_mid(mid):
        mid.at(light, "fx-light", x - 20, y - 20, f"animation-delay:-{round((x % 7) * 0.3, 1)}s")
    draw_tanks(mid)
    lights, phone = draw_near(near)
    for x, y in lights:
        near.at(light, "fx-light", x - 20, y - 20, f"animation-delay:-{round((x % 5) * 0.4, 1)}s")
    flash = Svg("phone-flash.svg", (-10, -10, 20, 20))
    flash.add(circ(0, 0, 10, flash.rad([(0, "#ffffff", 1), (0.25, "#ffffff", 0.7), (1, "#ffffff", 0)])))
    flash.add(line(-9, 0, 9, 0, "#ffffff", 0.8), line(0, -9, 0, 9, "#ffffff", 0.8))
    flash.save()
    near.at(flash, "fx-phone", phone[0], phone[1])
    front.art(draw_front())
    draw_car(front)
    draw_close(close)
    write_dets(random.Random(12))

    style = "  <style>\n" + "\n".join("    " + st for st in STYLES) + "\n  </style>\n" if STYLES else ""
    html = '<div class="scene" aria-hidden="true">\n' + style + "\n".join(l.html() for l in LAYERS if l.items) + "\n</div>\n"
    with open(os.path.join(OUT, "scene.html"), "w") as f:
        f.write(html)
    total = sum(SIZES.values())
    print(f"{len(SIZES)} SVG files, {total / 1024:.0f} KB, written to {os.path.normpath(OUT)}")
    for name, size in sorted(SIZES.items(), key=lambda kv: -kv[1])[:6]:
        print(f"  {name:18} {size / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
