/* Screenshot real do jogo no Chromium headless (SwiftShader) + diagnóstico. */
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve("tools/shots");
mkdirSync(OUT, { recursive: true });
const URL = process.env.SHOT_URL || "http://127.0.0.1:8080/index.html";

const exe = await chromium.executablePath();
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: [
    ...chromium.args,
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1440,900"
  ]
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(m.type() + ": " + m.text().slice(0, 300)); });
page.on("pageerror", (e) => logs.push("pageerror: " + (e.stack || e.message).slice(0, 600)));
page.on("requestfailed", (r) => logs.push("requestfailed: " + r.url().slice(0, 120) + " " + (r.failure() && r.failure().errorText)));

const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

const booted = await page
  .waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 45000 })
  .then(() => true)
  .catch(() => false);
console.log("boot em", ((Date.now() - t0) / 1000).toFixed(1) + "s:", booted);

const snap = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("salvo", name); };
await new Promise((r) => setTimeout(r, 1800));
await snap("01-home");

const info = async (label) => {
  const s = await page.evaluate(() => {
    const S = window.SAMPA;
    if (!S) return null;
    const st = S.state;
    return {
      menu: st.menu, playing: st.playing, paused: st.paused,
      car: st.car, x: +st.x.toFixed(1), z: +st.z.toFixed(1), speed: +st.speed.toFixed(2),
      yaw: +st.yaw.toFixed(2), fps: st.fps, hour: st.hour, weather: st.settings.weather,
      roads: st.roadPaths ? st.roadPaths.length : 0,
      nav: st.navNodes ? st.navNodes.size : 0,
      playerY: S.player && S.player.model ? +S.player.model.root.position.y.toFixed(2) : null,
      hudActive: !!document.querySelector("#hud.active"),
      appHidden: !!document.querySelector("#app.hidden")
    };
  });
  console.log(label, JSON.stringify(s));
  return s;
};
await info("estado inicial ->");

/* entra no jogo */
await page.click("#btn-play");
await new Promise((r) => setTimeout(r, 1200));
await info("após jogar  ->");
await snap("02-hud");

/* acelera com teclado */
await page.keyboard.down("w");
await new Promise((r) => setTimeout(r, 2500));
await page.keyboard.up("w");
const after = await info("após W 2,5s ->");
await snap("03-dirigindo");

/* terceira pessoa / primeira pessoa */
await page.keyboard.press("c");
await new Promise((r) => setTimeout(r, 700));
await snap("04-camera-1a");
await page.keyboard.press("c");
await new Promise((r) => setTimeout(r, 500));

/* mapa */
await page.keyboard.press("m");
await new Promise((r) => setTimeout(r, 1200));
await snap("05-mapa");
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 600));

/* garagem */
const garage = await page.evaluate(() => {
  const b = document.querySelector('[data-page="garage"]');
  if (b) b.click();
  return !!b;
});
await new Promise((r) => setTimeout(r, 1500));
await snap("06-garagem");

/* ficha do carro no showroom */
await page.evaluate(() => { const c = document.querySelector('.car-card[data-car="jeep"]'); if (c) c.click(); });
await new Promise((r) => setTimeout(r, 1200));
await snap("07-garagem-jeep");

console.log("\n=== logs ===");
console.log(logs.slice(0, 12).join("\n") || "nenhum");
console.log("\nvelocidade final:", after && after.speed);
await browser.close();
