import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 60000 });
const out = await page.evaluate(() => {
  const S = window.SAMPA, T = window.THREE;
  const asphalt = S.TEXCACHE.asphalt;
  const found = [];
  S.scene.traverse((o) => {
    if (!o.isMesh || !o.material || o.material.map !== asphalt) return;
    const pos = o.geometry.attributes.position;
    o.geometry.computeBoundingSphere();
    const bs = o.geometry.boundingSphere;
    let nan = 0;
    for (let i = 0; i < Math.min(pos.array.length, 3000); i++) if (!Number.isFinite(pos.array[i])) nan++;
    let vis = true, p = o;
    while (p) { if (!p.visible) vis = false; p = p.parent; }
    found.push({
      verts: pos.count, nan, vis, frustumCulled: o.frustumCulled,
      bs: bs ? [Math.round(bs.center.x), Math.round(bs.center.y * 100) / 100, Math.round(bs.center.z), Math.round(bs.radius)] : null,
      firstY: [pos.getY(0), pos.getY(1), pos.getY(2)],
      geoGroups: o.geometry.groups ? o.geometry.groups.length : 0,
      drawRange: o.geometry.drawRange ? o.geometry.drawRange.count : -1,
      matSide: o.material.side, matOpacity: o.material.opacity, matVis: o.material.visible,
      parentY: o.parent ? o.parent.position.y : null
    });
  });
  return found;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
