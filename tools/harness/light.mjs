import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 560 });
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 60000 });
await page.evaluate(() => window.SAMPA.startGame());
await new Promise((r) => setTimeout(r, 800));

const probe = () => page.evaluate(() => {
  const S = window.SAMPA, T = window.THREE, st = S.state;
  st.paused = true;
  const cam = S.camera;
  cam.position.set(st.x + 60, 90, st.z + 120); cam.lookAt(st.x, 0, st.z);
  cam.fov = 55; cam.updateProjectionMatrix();
  const info = { roof: null, wall: null, lights: [] };
  S.scene.traverse((o) => {
    if (o.isLight) info.lights.push({ type: o.type, i: +(o.intensity || 0).toFixed(2) });
    if (o.isMesh && o.material && o.material.map === S.TEXCACHE.roof && !info.roof) {
      info.roof = { color: "#" + o.material.color.getHexString(), hasNormal: !!o.geometry.attributes.normal,
        n0: o.geometry.attributes.normal ? [o.geometry.attributes.normal.getX(0), o.geometry.attributes.normal.getY(0), o.geometry.attributes.normal.getZ(0)] : null,
        side: o.material.side, shadowSide: o.material.shadowSide, verts: o.geometry.attributes.position.count };
    }
  });
  return info;
});
console.log("INFO", JSON.stringify(await probe()));
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "tools/shots/luz-normal.png" });

await page.evaluate(() => {
  const S = window.SAMPA;
  S.renderer.shadowMap.enabled = false;
  S.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } if (o.material) o.material.needsUpdate = true; });
});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: "tools/shots/luz-sem-sombra.png" });
console.log("salvos");
await browser.close();
