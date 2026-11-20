import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolve } from "node:path";

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 60000 });
await page.evaluate(() => window.SAMPA.startGame());
await new Promise((r) => setTimeout(r, 1200));

const shots = [
  { name: "vista-aerea", h: 260, d: 220, pitch: 1 },
  { name: "vista-media", h: 70, d: 60, pitch: 1 },
  { name: "rua-chao", h: 1.6, d: -6, pitch: 0 }
];
for (const s of shots) {
  await page.evaluate((cfg) => {
    const S = window.SAMPA, st = S.state;
    st.paused = true;
    const cam = S.camera;
    const x = st.x, z = st.z;
    if (cfg.pitch) { cam.position.set(x + cfg.d * 0.35, cfg.h, z + cfg.d); cam.lookAt(x, 0, z); }
    else { cam.position.set(x, cfg.h, z + cfg.d); cam.lookAt(x, 1.1, z - 30); }
    cam.fov = 55; cam.updateProjectionMatrix();
  }, s);
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: resolve("tools/shots/" + s.name + ".png") });
  console.log("salvo", s.name);
}

/* materiais das faixas grandes */
const info = await page.evaluate(() => {
  const S = window.SAMPA, T = window.THREE;
  let root = S.player.model.root; while (root.parent) root = root.parent;
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    out.push({ v: o.geometry.attributes.position.count, color: m.color ? "#" + m.color.getHexString() : "-",
      map: m.map ? (m.map.image && m.map.image.width ? m.map.image.width + "px" : "img") : "sem",
      y: o.geometry.boundingBox ? 0 : 0, bs: !!m.map, transp: !!m.transparent, op: m.opacity });
  });
  return out.filter((x) => x.v > 3000).slice(0, 8);
});
console.log("MATERIAIS GRANDES:", JSON.stringify(info));
await browser.close();
