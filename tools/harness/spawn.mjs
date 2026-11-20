import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
page.on("pageerror", (e) => console.log("ERR", String(e.message).slice(0, 140)));
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 60000 });
const out = await page.evaluate(() => {
  const S = window.SAMPA, st = S.state;
  const before = { x: +st.x.toFixed(1), z: +st.z.toFixed(1), paths: st.roadPaths.length, blockers: !!st.blockers, zones: (st.landmarkZones || []).length };
  const rp = S.nearestRoadPoint(0, 0);
  const forced = S.ensureClearSpawn(true);
  return { before, nearest: rp ? { x: Math.round(rp.x), z: Math.round(rp.z), dist: Math.round(rp.dist) } : null, forced,
    after: { x: +st.x.toFixed(1), z: +st.z.toFixed(1), yaw: +st.yaw.toFixed(2) } };
});
console.log(JSON.stringify(out));
await browser.close();
