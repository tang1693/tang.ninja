// tang.ninja home: the hero's layers move at different rates (depth), the nav slides in
// once the page covers the hero, the paper filter, and the citation bars growing into view.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // On phones the layers stay put: the scene is small there, and eight moving layers cost a lot of memory.
  const still = window.matchMedia("(max-width: 640px)");
  const nav = document.getElementById("nav");
  const hero = document.querySelector(".hero");
  const sheet = document.querySelector(".sheet");
  const layers = [...document.querySelectorAll(".hero [data-depth]")].map((el) => ({ el, d: parseFloat(el.dataset.depth) }));
  // Detection boxes show one at a time: the object under the pointer (the smallest, when several
  // overlap). Each object has an invisible anchor in its own layer or moving group; the boxes live in
  // the top hud layer and are placed over the anchor, so nothing in the picture can cover them.
  const anchors = [...document.querySelectorAll(".hero .anchor")];
  const boxes = new Map([...document.querySelectorAll(".hero .det-more")].map((b) => [b.style.getPropertyValue("--i"), b]));
  const hud = document.querySelector(".hero .layer.hud");
  let hit = null;
  function pick() {
    let best = null, bestArea = Infinity;
    if (mx >= 0) {
      for (const a of anchors) {
        const r = a.getBoundingClientRect();
        if (mx < r.left - 6 || mx > r.right + 6 || my < r.top - 6 || my > r.bottom + 6) continue;
        const area = r.width * r.height;
        if (area < bestArea) { bestArea = area; best = { a, r }; }
      }
    }
    const id = best ? best.a.style.getPropertyValue("--i") : null;
    if (hit !== null && hit !== id) boxes.get(hit).classList.remove("is-hit");
    if (best && hud) {
      const b = boxes.get(id), h = hud.getBoundingClientRect();
      b.style.left = (best.r.left - h.left).toFixed(1) + "px";
      b.style.top = (best.r.top - h.top).toFixed(1) + "px";
      b.style.width = best.r.width.toFixed(1) + "px";
      b.style.height = best.r.height.toFixed(1) + "px";
      b.classList.add("is-hit");
    }
    hit = id;
  }

  let px = 0, py = 0, cx = 0, cy = 0, raf = 0, covered = false, mx = -1, my = -1;
  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function frame() {
    raf = 0;
    const top = sheet ? sheet.getBoundingClientRect().top : Infinity;
    if (nav) nav.classList.toggle("is-shown", top <= 52);
    // Once the page fully covers the hero, stop drawing it.
    const nowCovered = top < -40;
    if (nowCovered !== covered) {
      covered = nowCovered;
      hero.classList.toggle("is-covered", covered);
    }
    if (covered || reduce || still.matches) return;

    const sy = Math.max(0, window.scrollY);
    cx += (px - cx) * 0.08;
    cy += (py - cy) * 0.08;
    for (const { el, d } of layers) {
      const x = -cx * d * 40;
      const y = -cy * d * 26 - sy * d * 0.85;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
    pick();
    // while an object is under the pointer keep following it, since most of them move
    if (hit !== null || Math.abs(px - cx) > 0.002 || Math.abs(py - cy) > 0.002) request();
  }

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  if (!reduce) {
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || covered) return;
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      mx = e.clientX;
      my = e.clientY;
      request();
    }, { passive: true });
    hero.addEventListener("pointerleave", () => {
      mx = my = -1;
      pick();
    });
  }
  request();

  // The clock on the tower keeps the visitor's own time
  const hands = ["h", "m", "s"].map((k) => document.querySelector(".hero .clock-" + k));
  if (hands.every(Boolean)) {
    const tick = () => {
      const d = new Date();
      const sec = d.getSeconds(), min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
      hands[0].style.rotate = (hr * 30).toFixed(1) + "deg";
      hands[1].style.rotate = (min * 6).toFixed(1) + "deg";
      hands[2].style.rotate = sec * 6 + "deg";
    };
    tick();
    setInterval(tick, 1000);
  }

  // Papers: show one research area at a time
  const buttons = [...document.querySelectorAll(".filter button")];
  const pubs = [...document.querySelectorAll(".pub")];
  const groups = [...document.querySelectorAll(".year-group")];
  function setFilter(f) {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.filter === f));
    for (const p of pubs) p.hidden = f !== "all" && p.dataset.area !== f;
    for (const g of groups) g.hidden = !g.querySelector(".pub:not([hidden])");
  }
  for (const b of buttons) b.addEventListener("click", () => setFilter(b.dataset.filter));
  for (const a of document.querySelectorAll(".area[data-filter]")) {
    a.addEventListener("click", () => setFilter(a.dataset.filter));
  }

  // Citation bars grow when they scroll into view
  const bars = document.querySelector(".bars");
  if (bars && !reduce && "IntersectionObserver" in window) {
    bars.classList.add("is-waiting");
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        bars.classList.remove("is-waiting");
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(bars);
  }
})();
