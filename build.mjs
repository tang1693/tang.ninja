// Builds the whole site into dist/. Cloudflare (Workers Builds) runs this on every push:
//   build command:   node build.mjs
//   deploy command:  npx wrangler deploy      (wrangler.jsonc: dist/ as static assets + dist/_worker.js)
// No packages to install. Works on Node 18 and later.
//
// dist/index.html           -> https://tang.ninja            (Yang's research page, from home/)
// dist/<kid>/index.html     -> https://<kid>.tang.ninja      (dist/_worker.js maps the subdomain to the folder)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "dist");
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const year = String(new Date().getFullYear());

// Each kid's page has its own theme: shared/themes/<theme>.css plus these fonts.
const THEMES = {
  hazard: {
    color: "#141412",
    fonts: "family=Big+Shoulders+Stencil+Display:wght@800;900&family=Chakra+Petch:wght@400;600;700",
  },
  comic: {
    color: "#36d3bf",
    fonts: "family=Bangers&family=Figtree:wght@400..800",
  },
  dossier: {
    color: "#383b2a",
    fonts: "family=Stardos+Stencil:wght@700&family=Courier+Prime:wght@400;700",
  },
};
const FONTS = "https://fonts.googleapis.com/css2?";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const readJSON = (p, fallback) => (fs.existsSync(path.join(ROOT, p)) ? JSON.parse(read(p)) : fallback);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

function slugify(name) {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  return "game-" + crypto.createHash("sha1").update(name).digest("hex").slice(0, 8);
}

function gameInfo(html, fileBase) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const lang = (html.match(/<html[^>]*\blang=["']?([a-zA-Z-]+)/i) || [])[1] || "en";
  return {
    title: title ? title.replace(/\s+/g, " ").trim().replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'") : fileBase,
    lang: lang.toLowerCase(),
  };
}

// The day a file was first committed, when git history is available; otherwise unknown.
function firstCommitDate(file) {
  try {
    const out = execFileSync("git", ["log", "--diff-filter=A", "--follow", "--format=%cs", "--", file], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.split("\n").pop() || "";
  } catch {
    return "";
  }
}

const LANG_LABEL = { zh: "中文", ja: "日本語", ko: "한국어", es: "Español", fr: "Français", de: "Deutsch", ru: "Русский" };
const langLabel = (lang) => (lang.startsWith("en") ? "" : LANG_LABEL[lang.split("-")[0]] || lang);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const prettyDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : "";
};

// ---------- collect ----------

const site = readJSON("site.json");
const domain = site.domain;

const kids = site.kids.map((kid) => {
  const theme = THEMES[kid.theme] ? kid.theme : "hazard";
  const dir = path.join(ROOT, "kids", kid.id, "games");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".html")) : [];
  const meta = readJSON(path.join("kids", kid.id, "games.json"), []);
  const metaByFile = new Map(meta.map((m, i) => [m.file, { ...m, order: i }]));

  const used = new Set();
  const games = files.map((file) => {
    const base = file.slice(0, -5);
    const m = metaByFile.get(file) || {};
    const info = gameInfo(fs.readFileSync(path.join(dir, file), "utf8"), base);
    let slug = m.slug || slugify(base);
    while (used.has(slug)) slug += "-2";
    used.add(slug);
    const imgExt = IMAGE_EXTS.find((e) => fs.existsSync(path.join(dir, base + e)));
    return {
      file,
      slug,
      title: m.title || info.title,
      blurb: m.blurb || "",
      lang: (m.lang || info.lang).toLowerCase(),
      added: m.added || firstCommitDate(path.join("kids", kid.id, "games", file)),
      image: imgExt ? { src: path.join(dir, base + imgExt), name: slug + imgExt } : null,
      // Games not yet listed in games.json are the newest ones, so they go first.
      order: m.order ?? -1,
    };
  });
  games.sort((a, b) => a.order - b.order || (b.added || "").localeCompare(a.added || "") || a.title.localeCompare(b.title));
  return { ...kid, theme, url: `https://${kid.id}.${domain}`, games, cover: games.find((g) => g.image) };
});

// ---------- each kid's page ----------

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const countText = (n) => (n === 1 ? "1 game" : `${n} games`);
const kidTpl = read("templates/kid.html");

for (const kid of kids) {
  const kdir = path.join(OUT, kid.id);
  fs.mkdirSync(path.join(kdir, "games"), { recursive: true });
  fs.mkdirSync(path.join(kdir, "thumbs"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "shared", "kid.css"), path.join(kdir, "kid.css"));
  fs.copyFileSync(path.join(ROOT, "shared", "themes", kid.theme + ".css"), path.join(kdir, "theme.css"));
  fs.copyFileSync(path.join(ROOT, "shared", "favicon.svg"), path.join(kdir, "favicon.svg"));

  const items = kid.games.map((g) => {
    fs.copyFileSync(path.join(ROOT, "kids", kid.id, "games", g.file), path.join(kdir, "games", g.slug + ".html"));
    if (g.image) fs.copyFileSync(g.image.src, path.join(kdir, "thumbs", g.image.name));
    const href = `games/${esc(g.slug)}`;
    const shot = g.image
      ? `<img src="thumbs/${esc(g.image.name)}" alt="" width="960" height="600" loading="lazy" decoding="async">`
      : "";
    const meta = [
      `<span class="k-new">New</span>`,
      g.added ? `<time datetime="${esc(g.added)}">${prettyDate(g.added)}</time>` : "",
      langLabel(g.lang) ? `<span class="k-lang">${esc(langLabel(g.lang))}</span>` : "",
    ].join("");
    return `        <li class="k-item"${g.added ? ` data-added="${esc(g.added)}"` : ""}>
          <a class="k-shot" href="${href}" tabindex="-1" aria-hidden="true">${shot}</a>
          <div class="k-body">
            <h2 class="k-title">${esc(g.title)}</h2>
            ${g.blurb ? `<p class="k-blurb">${esc(g.blurb)}</p>` : ""}
            <p class="k-meta">${meta}</p>
            <a class="k-play" href="${href}" aria-label="Play ${esc(g.title)}">Play</a>
          </div>
        </li>`;
  });

  const siblings = kids
    .filter((k) => k.id !== kid.id)
    .map((k) => `<a href="${k.url}">${esc(k.name)}</a>`)
    .join("");

  fs.writeFileSync(
    path.join(kdir, "index.html"),
    fill(kidTpl, {
      id: kid.id,
      name: esc(kid.name),
      theme: kid.theme,
      theme_color: THEMES[kid.theme].color,
      fonts: FONTS + THEMES[kid.theme].fonts.replace(/&/g, "&amp;") + "&amp;display=swap",
      count_text: countText(kid.games.length),
      og_image: kid.cover ? `<meta property="og:image" content="${kid.url}/thumbs/${esc(kid.cover.image.name)}">` : "",
      items: items.join("\n") || `        <li class="k-item"><p>No games yet.</p></li>`,
      siblings,
    })
  );
}

// ---------- home page ----------

// The home page does not link to the kids' pages: work and family stay apart (the user's choice).
let home = read("home/index.html");
// The hero illustration's markup, written by tools/hero.py next to its SVG layers.
const scene = read("home/hero/scene.html").trim().replace(/\n/g, "\n    ");
home = home.replace(/<!-- SCENE:.*?-->/, () => scene);
fs.writeFileSync(path.join(OUT, "index.html"), fill(home, { year }));
fs.copyFileSync(path.join(ROOT, "shared", "home.css"), path.join(OUT, "home.css"));
fs.copyFileSync(path.join(ROOT, "shared", "favicon.svg"), path.join(OUT, "favicon.svg"));

// Copy anything else in home/ (home.js, the hero illustration in hero/, photos) as-is.
for (const f of fs.readdirSync(path.join(ROOT, "home"))) {
  if (f === "index.html") continue;
  fs.cpSync(path.join(ROOT, "home", f), path.join(OUT, f), { recursive: true });
}
fs.rmSync(path.join(OUT, "hero", "scene.html"), { force: true });

// ---------- subdomain routing ----------

// The worker is deployed as code, not served as a file (wrangler.jsonc points at it).
fs.writeFileSync(path.join(OUT, ".assetsignore"), "_worker.js\n");
fs.writeFileSync(
  path.join(OUT, "_worker.js"),
  `// Generated by build.mjs. Sends <kid>.${domain} to the /<kid>/ folder of this site.
const DOMAIN = ${JSON.stringify(domain)};
const KIDS = ${JSON.stringify(kids.map((k) => k.id))};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const sub = url.hostname.endsWith("." + DOMAIN) ? url.hostname.slice(0, -DOMAIN.length - 1) : "";

    if (sub === "www") {
      return Response.redirect("https://" + DOMAIN + url.pathname + url.search, 301);
    }
    if (!KIDS.includes(sub)) return env.ASSETS.fetch(request);

    const inner = new URL(url);
    inner.pathname = "/" + sub + url.pathname;
    const res = await env.ASSETS.fetch(new Request(inner, request));

    // Keep redirects on the subdomain (e.g. /games/x.html -> /games/x).
    const loc = res.headers.get("Location");
    if (loc) {
      const to = new URL(loc, inner);
      const prefix = "/" + sub;
      if (to.pathname === prefix || to.pathname.startsWith(prefix + "/")) {
        const headers = new Headers(res.headers);
        headers.set("Location", (to.pathname.slice(prefix.length) || "/") + to.search);
        return new Response(res.body, { status: res.status, headers });
      }
    }
    return res;
  },
};
`
);

const total = kids.reduce((s, k) => s + k.games.length, 0);
console.log(`Built ${total} games for ${kids.length} kids into dist/`);
for (const k of kids) console.log(`  ${k.id}.${domain} (${k.theme}): ${k.games.map((g) => g.slug).join(", ") || "(none)"}`);
