import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on("pageerror", (e) => console.log("ERR", String(e.message).slice(0, 120)));
const t0 = Date.now();
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 60000 });
console.log("boot ms:", Date.now() - t0);
console.log("etapas:", JSON.stringify(await page.evaluate(() => window.SAMPA.state.bootTimes)));
await page.evaluate(() => window.SAMPA.startGame());
await new Promise((r) => setTimeout(r, 4000));
const p = await page.evaluate(() => {
  const S = window.SAMPA, r = S.renderer, st = S.state;
  let meshes = 0, inst = 0, lights = 0, verts = 0;
  S.scene.traverse((o) => {
    if (o.isInstancedMesh) { inst++; return; }
    if (o.isMesh) { meshes++; if (o.geometry.attributes.position) verts += o.geometry.attributes.position.count; }
    if (o.isLight) lights++;
  });
  return {
    fps: st.fps, calls: r.info.render.calls, tris: r.info.render.triangles,
    meshes, inst, lights, verts: Math.round(verts / 1000) + "k",
    geoms: r.info.memory.geometries, tex: r.info.memory.textures,
    pixelRatio: r.getPixelRatio(), shadows: r.shadowMap.enabled, quality: S.state.settings.quality,
    buildings: st.stats ? st.stats.buildings : 0
  };
});
console.log(JSON.stringify(p));
await browser.close();
