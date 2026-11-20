/* Smoke test: roda o jogo no jsdom com WebGL/canvas falsos e simula cliques. */
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("index.html"), "utf8");

/* injeta stubs entre o three e o jogo */
const marker = "<script>\n(function(){";
const idx = html.indexOf(marker);
if (idx < 0) throw new Error("marcador do jogo não encontrado");
const stub = `
<script>
(function(){
  function mockCtx(){
    const grad = { addColorStop(){} };
    const handler = {
      get(target, prop){
        if(prop in target) return target[prop];
        if(prop === 'canvas') return { width: 300, height: 150 };
        if(prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
        if(prop === 'createPattern') return () => ({});
        if(prop === 'measureText') return () => ({ width: 24 });
        if(prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        if(prop === 'putImageData' || prop === 'drawImage' || prop === 'save' || prop === 'restore') return () => {};
        if(prop === 'setTransform' || prop === 'transform') return () => {};
        return () => {};
      },
      set(target, prop, val){ target[prop] = val; return true; }
    };
    return new Proxy({}, handler);
  }
  window.HTMLCanvasElement.prototype.getContext = function(type){
    if(type === '2d') { if(!this.__ctx) this.__ctx = mockCtx(); return this.__ctx; }
    return null;
  };
  class FakeRenderer {
    constructor(opts){
      this.domElement = (opts && opts.canvas) || document.createElement('canvas');
      this.shadowMap = { enabled:false, type:0 };
      this.info = { render:{ calls:0 }, memory:{} };
      this.capabilities = { isWebGL2:false, getMaxAnisotropy(){ return 4; } };
      this.outputColorSpace = '';
      this.toneMapping = 0;
      this.toneMappingExposure = 1;
      this.renders = 0;
    }
    setPixelRatio(){} setSize(){} setClearColor(){} setScissorTest(){}
    render(){ this.renders++; if(this.renders % 25 === 0) window.__renders = this.renders; }
    getSize(target){ if(target){ target.x = 800; target.y = 600; } return target; }
    getPixelRatio(){ return 1; }
    setAnimationLoop(){} dispose(){}
  }
  window.__fakeRenderer = true;
  window.__patchThree = function(){ if(window.THREE) window.THREE.WebGLRenderer = FakeRenderer; };
  window.__patchThree();
  const origRev = window.THREE && window.THREE.REVISION;
  window.__threeRev = origRev;
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  window.fetch = function(url){
    return Promise.reject(new Error('fetch bloqueado no teste: ' + url));
  };
  let frames = 0;
  const realRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb){
    if(frames++ > 4000) return 0;
    return realRaf.call(window, cb);
  };
  window.__errors = [];
  window.addEventListener('error', (e)=>{ window.__errors.push('window.onerror: ' + (e.message || e.error)); });
  window.addEventListener('unhandledrejection', (e)=>{ window.__errors.push('unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)); });
})();
<\/script>
`;
const patched = html.slice(0, idx) + stub + html.slice(idx);

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => { const m = String(e.message || e); if (/Not implemented: HTMLMediaElement/.test(m)) return; errors.push("jsdomError: " + (e.stack || e.message)); });
vc.on("error", (...args) => errors.push("console.error: " + args.join(" ")));
vc.on("warn", (...args) => { const s = args.join(" "); if (!/simulado|fetch bloqueado|OSM|Audio|WebGL|deprecated/i.test(s)) errors.push("console.warn: " + s); });

const dom = new JSDOM(patched, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost:8080/",
  virtualConsole: vc,
  beforeParse(win) {
    win.performance = win.performance || { now: () => Date.now() };
  }
});

const win = dom.window;
const doc = win.document;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function click(sel) {
  const el = typeof sel === "string" ? doc.querySelector(sel) : sel;
  if (!el) { errors.push("elemento ausente: " + sel); return false; }
  try { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true })); return true; }
  catch (e) { errors.push("click " + sel + ": " + e.message); return false; }
}
function key(k, type) {
  try {
    const ev = new win.KeyboardEvent(type || "keydown", { key: k, bubbles: true, cancelable: true });
    (type === "keyup" ? win : doc).dispatchEvent ? win.dispatchEvent(ev) : null;
    return true;
  } catch (e) { errors.push("key " + k + ": " + e.message); return false; }
}
function change(sel, value) {
  const el = doc.querySelector(sel);
  if (!el) { errors.push("select ausente: " + sel); return; }
  el.value = value;
  el.dispatchEvent(new win.Event("change", { bubbles: true }));
}
function range(sel, value) {
  const el = doc.querySelector(sel);
  if (!el) { errors.push("range ausente: " + sel); return; }
  el.value = value;
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
}

await new Promise((r) => win.addEventListener("load", r));
await wait(600);

console.log("three rev:", win.__threeRev);
console.log("canvas criado:", !!doc.querySelector("#scene"));
console.log("boot concluído:", doc.querySelector("#boot").classList.contains("done"));

/* ---- simula navegação ---- */
for (const page of ["garage", "map", "radio", "settings", "controls", "home"]) {
  click(`.rail-btn[data-page="${page}"]`);
  await wait(60);
}
/* garagem */
click('.car-card[data-car="uno"]');
await wait(40);
click('.car-card[data-car="jeep"]');
await wait(40);
click("#btn-horn-preview");
/* settings */
click("#set-shadows");
click("#set-timelapse");
click("#set-engine");
click("#set-ambient");
click("#set-assist");
click("#set-save");
click("#set-autolight");
change("#set-quality", "balanced");
change("#set-view", "mid");
change("#set-traffic", "low");
change("#set-weather", "rain");
change("#set-weather", "fog");
change("#set-weather", "clear");
change("#set-hour", "21");
change("#set-camera", "first");
range("#set-sfx", 40);
range("#set-music", 30);
range("#set-sens", 80);
await wait(120);
/* radio */
click('#radio-tabs .tab[data-src="piped"]');
const urlInput = doc.querySelector("#radio-url");
if (urlInput) urlInput.value = "https://www.youtube.com/playlist?list=PL1234567890";
click("#radio-connect");
await wait(300);
click("#radio-prev");
click("#radio-next");
range("#radio-volume", 55);
/* mapa */
click("#district-seg button:nth-child(2)");
await wait(500);
click("#bigmap-zoom-in");
click("#bigmap-zoom-out");
click("#btn-route-clear");
const destBtn = doc.querySelector("#dest-list .dest-btn");
if (destBtn) click(destBtn);
await wait(120);
/* dirigir */
click("#btn-play");
await wait(120);
const driveState = {
  hud: doc.querySelector("#hud").classList.contains("active"),
  app: doc.querySelector("#app").classList.contains("hidden")
};
key("w");
await wait(700);
key("d");
await wait(300);
key("w", "keyup");
key("d", "keyup");
key(" ");
await wait(200);
key(" ", "keyup");
key("c");
key("h");
key("l");
key("j");
key("j");
key("f");
key("f");
await wait(200);
click("#btn-camera");
click("#btn-lights");
click("#btn-hazard");
click("#btn-horn");
click("#mini-zoom-in");
click("#mini-zoom-out");
click("#mini-mode");
click("#hud-map");
await wait(150);
click('.rail-btn[data-page="home"]');
click("#btn-play");
await wait(150);
click("#hud-garage");
await wait(120);
click('.car-card[data-car="fusca"]');
click("#btn-drive-selected");
await wait(200);
key("w");
await wait(400);
key("Escape");
await wait(120);
click("#pause-resume");
await wait(120);
key("Escape");
await wait(80);
click("#pause-reset");
await wait(120);
key("w", "keyup");
click("#hud-pause");
await wait(80);
click("#pause-garage");
await wait(120);
click("#pause-menu");
await wait(150);

/* verificações de estado real */
const S = win.SAMPA;
const chk = [];
function check(name, cond, extra) { chk.push((cond ? "OK   " : "FALHA") + " · " + name + (extra !== undefined ? " [" + extra + "]" : "")); }
check("carro selecionado fusca", S.state.car === "fusca", S.state.car);
check("carro existe na cena", !!S.player.model);
check("carro andou", Math.abs(S.state.x) + Math.abs(S.state.z) > 0, Math.round(S.state.x) + "," + Math.round(S.state.z));
check("velocidade/odometro", S.state.odometer >= 0, S.state.odometer.toFixed(3) + " km");
check("marcha definida", typeof S.state.gear === "number", S.state.gear);
check("cidade com ruas", S.state.stats.roads > 0, S.state.stats.roads);
check("cidade com prédios", S.state.stats.buildings > 0, S.state.stats.buildings);
check("base do minimapa gerada", !!S.city.baseCanvas);
check("grafo de navegação", (S.state.navNodes ? S.state.navNodes.size : 0) > 0, S.state.navNodes ? S.state.navNodes.size : 0);
const route = S.findRoute({ x: S.state.x, z: S.state.z }, { x: S.state.x + 300, z: S.state.z + 200 });
check("A* encontrou rota", !!route, route ? route.points.length + " pontos / " + Math.round(route.dist) + " m" : "sem rota");
if (route) check("instruções de guinada", route.instructions.length >= 2, route.instructions.map(i => i.text).join(" | ").slice(0, 90));
check("tráfego instanciado", !!(S.traffic && S.traffic.bodies), S.traffic && S.traffic.list ? S.traffic.list.length : 0);
/* tráfego em movimento, sem NaN, dentro do mundo */
if (S.traffic && S.traffic.bodies && S.traffic.list.length) {
  const before = [];
  const m = new win.THREE.Matrix4();
  for (let i = 0; i < Math.min(8, S.traffic.list.length); i++) {
    S.traffic.bodies.getMatrixAt(i, m);
    before.push([m.elements[12], m.elements[14]]);
  }
  let moved = 0, bad = 0;
  for (let k = 0; k < 90; k++) { S.updateTraffic(0.05); S.updateTrafficLights(0.05); }
  for (let i = 0; i < before.length; i++) {
    S.traffic.bodies.getMatrixAt(i, m);
    const x = m.elements[12], z = m.elements[14];
    if (!isFinite(x) || !isFinite(z)) bad++;
    else if (Math.hypot(x - before[i][0], z - before[i][1]) > 0.4) moved++;
  }
  check("tráfego se move", moved >= 3, moved + "/" + before.length + " carros");
  check("tráfego sem NaN", bad === 0, bad + " inválidos");
}
check("showroom ativo", !!win.document.querySelector("#showroom-hero canvas") || !!win.document.querySelector("#showroom-garage canvas"));
check("hora aplicada", S.state.hour >= 0 && S.state.hour <= 24, S.state.hour.toFixed(1));
check("clima aplicado", !!S.state.settings.weather, S.state.settings.weather);
console.log("\n--- verificações ---");
chk.forEach(c => console.log(c));
console.log("HUD ativo:", driveState.hud, "| app escondido:", driveState.app);
console.log("renders:", win.__renders || 0);

const allErrors = errors.concat(win.__errors || []);
console.log("\n--- erros encontrados: " + allErrors.length + " ---");
for (const e of allErrors.slice(0, 40)) console.log("• " + e);
if (!allErrors.length) console.log("nenhum erro de runtime");
dom.window.close();
process.exit(allErrors.length ? 1 : 0);
