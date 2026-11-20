/* Fotos dos três carros no showroom (para inspeção visual rápida). */
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve("tools/shots");
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
await page.goto(process.env.SHOT_URL || "http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 45000 });
await new Promise((r) => setTimeout(r, 1200));

await page.evaluate(() => document.querySelector('[data-page="garage"]').click());
await new Promise((r) => setTimeout(r, 900));

for (const car of ["fusca", "uno", "jeep"]) {
  await page.evaluate((c) => {
    const card = document.querySelector('.car-card[data-car="' + c + '"]');
    if (card) card.click();
  }, car);
  await new Promise((r) => setTimeout(r, 1100));
  const stage = await page.$("#showroom-garage");
  if (stage) await stage.screenshot({ path: `${OUT}/carro-${car}.png` });
  else await page.screenshot({ path: `${OUT}/carro-${car}.png` });
  console.log("salvo carro-" + car);
}
console.log("erros:", errs.slice(0, 4));
await browser.close();
