import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 45000 });
await new Promise((r) => setTimeout(r, 800));
const out = await page.evaluate(() => {
  const S = window.SAMPA, st = S.state, T = window.THREE;
  const scene = S.city && S.city.scene ? S.city.scene : null;
  const ray = new T.Raycaster(new T.Vector3(st.x, 12, st.z), new T.Vector3(0, -1, 0));
  const hits = [];
  // encontra a cena a partir do player
  let root = S.player.model.root; while (root.parent) root = root.parent;
  ray.intersectObjects(root.children, true).slice(0, 4).forEach((h) => {
    const m = h.object.material;
    hits.push({
      y: +h.point.y.toFixed(3), dist: +h.distance.toFixed(2),
      mat: m ? (m.name || (m.color ? "#" + m.color.getHexString() : "?")) : "?",
      map: m && m.map ? "map" : "sem-map",
      geo: h.object.geometry ? h.object.geometry.type : "?"
    });
  });
  return { hits, fog: root.fog ? root.fog.color.getHexString() : null, exposure: root.children.length };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
