/* Por que o carro não acelera? Inspeciona teclado, eixos e física no navegador. */
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
page.on("pageerror", (e) => console.log("pageerror:", String(e.message).slice(0, 160)));
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 45000 });
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => { try { window.SAMPA.setQuality("low"); } catch (e) {} });
await page.evaluate(() => window.SAMPA.startGame());
await new Promise((r) => setTimeout(r, 900));

const probe = () => page.evaluate(() => {
  const st = window.SAMPA.state;
  const keys = Object.keys(st.keys).filter((k) => st.keys[k]);
  return {
    keys, throttle: +(st.throttle ?? -1).toFixed(2), brake: +(st.brake ?? -1).toFixed(2),
    speed: +(st.speed ?? 0).toFixed(2), vx: +(st.vx ?? 0).toFixed(2), vz: +(st.vz ?? 0).toFixed(2),
    x: +st.x.toFixed(2), z: +st.z.toFixed(2), gear: st.gear, rpm: Math.round(st.rpm || 0),
    playing: st.playing, paused: st.paused, menu: st.menu, hand: !!st.handbrake,
    active: document.activeElement ? document.activeElement.tagName + "#" + (document.activeElement.id || "") : "?"
  };
});
console.log("antes   ", JSON.stringify(await probe()));
await page.keyboard.down("w");
await new Promise((r) => setTimeout(r, 400));
console.log("W 0,4s  ", JSON.stringify(await probe()));
for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 900));
console.log("W 4,0s  ", JSON.stringify(await probe()));
await page.keyboard.up("w");
await browser.close();
