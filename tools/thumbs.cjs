// Makes a 960x600 cover image next to each game, from its title screen.
// Usage: node tools/thumbs.cjs kids/mozi/games/new-game.html [more.html ...]
// Needs Playwright with Chromium (preinstalled in Claude's workspace). Not used by the site build.

let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/npm-tools/node_modules/playwright"); }
const path = require("path");

(async () => {
  const files = process.argv.slice(2);
  if (!files.length) { console.log("Usage: node tools/thumbs.cjs <game.html> ..."); process.exit(1); }
  const browser = await playwright.chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const f of files) {
    const abs = path.resolve(f);
    const out = abs.replace(/\.html$/i, ".jpg");
    const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
    await page.goto("file://" + abs, { waitUntil: "load", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(6000);
    await page
      .screenshot({ path: out, type: "jpeg", quality: 80, timeout: 120000 })
      .then(() => console.log("wrote", path.relative(process.cwd(), out)))
      .catch((e) => console.log("failed", f, e.message.split("\n")[0]));
    await page.close();
  }
  await browser.close();
})();
