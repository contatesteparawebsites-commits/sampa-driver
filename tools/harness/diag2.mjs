import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 180)));
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 60000 });
await new Promise((r) => setTimeout(r, 900));

/* ---- 1. navegação ---- */
const nav = await page.evaluate(() => {
  const out = [];
  const pages = ["home", "garage", "map", "radio", "settings", "controls"];
  for (const p of pages) {
    const btn = document.querySelector('.rail-btn[data-page="' + p + '"]');
    if (!btn) { out.push({ p, err: "sem botão" }); continue; }
    btn.click();
    const sec = document.querySelector("#page-" + p);
    out.push({ p, ativo: !!(sec && sec.classList.contains("active")), visivel: sec ? getComputedStyle(sec).display : "?" });
  }
  return out;
});
console.log("NAV:", JSON.stringify(nav));

const links = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("[data-page]").forEach((el) => {
    if (el.classList.contains("rail-btn")) return;
    out.push({ tag: el.tagName, txt: (el.textContent || "").trim().slice(0, 22), page: el.dataset.page, id: el.id });
  });
  return out;
});
console.log("LINKS data-page:", JSON.stringify(links));

/* ---- 2. cena: ruas, chão, calçadas ---- */
const scene = await page.evaluate(() => {
  const S = window.SAMPA, T = window.THREE;
  let root = S.player.model.root; while (root.parent) root = root.parent;
  const names = { asphalt: 0, sidewalk: 0, roof: 0, ground: 0, other: 0 };
  const big = [];
  T.TEXCACHE = S.TEXCACHE;
  const asphaltTex = S.TEXCACHE.asphalt, walkTex = S.TEXCACHE.sidewalk, groundTex = S.TEXCACHE.ground, roofTex = S.TEXCACHE.roof;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    const map = m && m.map;
    if (map === asphaltTex) names.asphalt++;
    else if (map === walkTex) names.sidewalk++;
    else if (map === roofTex) names.roof++;
    else if (map === groundTex) names.ground++;
    else names.other++;
    o.geometry.computeBoundingBox && o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (bb) {
      const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
      const area = sx * sz;
      if (area > 20000) big.push({ area: Math.round(area), y: +bb.min.y.toFixed(2), ymax: +bb.max.y.toFixed(2), color: m && m.color ? "#" + m.color.getHexString() : "?", map: !!map, geo: o.geometry.type, verts: o.geometry.attributes.position.count });
    }
  });
  return { names, big: big.sort((a, b) => b.area - a.area).slice(0, 8), roadPaths: S.state.roadPaths.length,
    firstRoad: S.state.roadPaths[0] ? S.state.roadPaths[0].slice(0, 3) : null,
    firstRoadPts: S.state.roadPaths[0] ? S.state.roadPaths[0].length : 0,
    canvasSize: S.city.baseSize, bounds: S.city.baseBounds };
});
console.log("CENA:", JSON.stringify(scene, null, 1));
console.log("ERROS:", errs.slice(0, 3));
await browser.close();
