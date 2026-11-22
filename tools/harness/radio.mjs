/* Verifica a rádio sintetizada: estações, áudio realmente saindo (RMS) e print da página. */
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on("pageerror", (e) => console.log("ERR", String(e.message).slice(0, 160)));
await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.SAMPA && document.querySelector("#boot.done"), { timeout: 60000 });

const out = {};
out.stations = await page.$$eval("#radio-stations .station b", (els) => els.map((e) => e.textContent));
await page.click('.rail-btn[data-page="radio"]');
await new Promise((r) => setTimeout(r, 300));
await page.click("#radio-stations .station:nth-child(3)");
await new Promise((r) => setTimeout(r, 2600));

out.afterClick = await page.evaluate(() => {
  const S = window.SAMPA, st = S.state.radio;
  return {
    stationIndex: st.station, playing: st.playing,
    title: document.querySelector("#radio-title")?.textContent,
    sub: document.querySelector("#radio-sub")?.textContent,
    status: document.querySelector("#radio-status")?.textContent?.trim(),
    activeCards: document.querySelectorAll("#radio-stations .station.active").length
  };
});

/* RMS real do analisador da rádio */
out.rms = await page.evaluate(async () => {
  const S = window.SAMPA;
  const an = S.radioAnalyser;
  if (!an) return "sem analyser";
  const buf = new Float32Array(an.fftSize);
  let sum = 0, n = 0;
  for (let i = 0; i < 12; i++) {
    an.getFloatTimeDomainData(buf);
    for (let j = 0; j < buf.length; j++) sum += Math.abs(buf[j]);
    n += buf.length;
    await new Promise((r) => setTimeout(r, 90));
  }
  return +(sum / n).toFixed(4);
});

await page.screenshot({ path: "tools/shots/radio.png" });

/* motor: acelera e mede o nível de áudio do engine + rpm */
await page.evaluate(() => window.SAMPA.startGame());
await new Promise((r) => setTimeout(r, 900));
await page.evaluate(() => window.SAMPA.startDrive && window.SAMPA.startDrive());
await new Promise((r) => setTimeout(r, 600));
const eng = [];
for (let i = 0; i < 7; i++) {
  await page.keyboard.down("w");
  await new Promise((r) => setTimeout(r, 450));
  eng.push(await page.evaluate(() => {
    const S = window.SAMPA, e = S.engineAudio;
    return {
      rpm: Math.round(S.state.rpm || 0), kmh: Math.round((S.state.speed || 0) * 3.6),
      gain: e ? +e.gain.gain.value.toFixed(4) : null,
      cutoff: e ? Math.round(e.filter.frequency.value) : null,
      ctx: S.audioCtx ? S.audioCtx.state : null
    };
  }));
}
await page.keyboard.up("w");
out.engine = eng;
await page.screenshot({ path: "tools/shots/dirigindo.png" });

console.log(JSON.stringify(out, null, 1));
await browser.close();
