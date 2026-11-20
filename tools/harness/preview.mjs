/* Preview harness: usa @napi-rs/canvas como implementação de canvas dentro do jsdom
   para exportar PNGs reais das telas 2D do jogo (minimapa, mapa, velocímetro, texturas). */
import { JSDOM, VirtualConsole } from "jsdom";
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("index.html"), "utf8");
const marker = "<script>\n(function(){";
const idx = html.indexOf(marker);
if (idx < 0) throw new Error("marcador não encontrado");

const stub = `
<script>
(function(){
  const realCreate = window.__createCanvas;
  window.HTMLCanvasElement.prototype.getContext = function(type){
    if(type !== '2d') return null;
    if(!this.__napiCanvas){
      this.__napiCanvas = realCreate(this.width || 300, this.height || 150);
      const self = this;
      let w = this.width, h = this.height;
      Object.defineProperty(this, 'width', { configurable:true, get(){ return w; }, set(v){ w = Math.max(1, Math.round(v)); self.__napiCanvas.width = w; } });
      Object.defineProperty(this, 'height', { configurable:true, get(){ return h; }, set(v){ h = Math.max(1, Math.round(v)); self.__napiCanvas.height = h; } });
      this.__napiCanvas.width = w; this.__napiCanvas.height = h;
    }
    if(!this.__ctxProxy){
      const nc = this.__napiCanvas.getContext('2d');
      this.__ctxProxy = new Proxy(nc, {
        get(t, prop){
          if(prop === 'drawImage') return function(){ const args = Array.prototype.map.call(arguments, a => (a && a.__napiCanvas) ? a.__napiCanvas : a); return t.drawImage.apply(t, args); };
          if(prop === 'canvas') return t.canvas;
          const v = t[prop];
          return typeof v === 'function' ? v.bind(t) : v;
        },
        set(t, prop, v){ t[prop] = v; return true; }
      });
    }
    return this.__ctxProxy;
  };
  class FakeRenderer {
    constructor(opts){
      this.domElement = (opts && opts.canvas) || document.createElement('canvas');
      this.shadowMap = { enabled:false, type:0 };
      this.info = { render:{ calls:0 }, memory:{} };
      this.capabilities = { isWebGL2:false, getMaxAnisotropy(){ return 4; } };
      this.renders = 0;
    }
    setPixelRatio(){} setSize(){} setClearColor(){} setScissorTest(){}
    render(){ this.renders++; }
    getSize(t){ if(t){ t.x=800; t.y=600; } return t; }
    getPixelRatio(){ return 1; }
    setAnimationLoop(){} dispose(){}
  }
  if(window.THREE) window.THREE.WebGLRenderer = FakeRenderer;
  window.fetch = () => Promise.reject(new Error('offline'));
  window.__errors = [];
  window.addEventListener('error', e => window.__errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', e => window.__errors.push('rejection: ' + (e.reason && e.reason.message)));
})();
<\/script>
`;
const patched = html.slice(0, idx) + stub + html.slice(idx);

const vc = new VirtualConsole();
const errs = [];
vc.on("jsdomError", (e) => { if (!/Not implemented: HTMLMediaElement/.test(String(e.message))) errs.push(String(e.message)); });
vc.on("error", (...a) => errs.push(a.join(" ")));

const dom = new JSDOM(patched, {
  runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost:8080/", virtualConsole: vc,
  beforeParse(win) {
    win.__createCanvas = createCanvas;
    win.devicePixelRatio = 1;
    // força tamanhos de layout, já que jsdom não calcula CSS
    Object.defineProperty(win.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.__cw || 800; } });
    Object.defineProperty(win.HTMLElement.prototype, "clientHeight", { configurable: true, get() { return this.__ch || 600; } });
    Object.defineProperty(win.HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value() { return { left: 0, top: 0, width: this.__cw || 800, height: this.__ch || 600, right: this.__cw || 800, bottom: this.__ch || 600, x: 0, y: 0 }; }
    });
  }
});
const win = dom.window, doc = win.document;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await new Promise((r) => win.addEventListener("load", r));
await wait(800);

mkdirSync("tools/preview", { recursive: true });
function save(canvasEl, name) {
  if (!canvasEl || !canvasEl.__napiCanvas) { console.log("sem canvas:", name); return; }
  writeFileSync(resolve("tools/preview/" + name + ".png"), canvasEl.__napiCanvas.toBuffer("image/png"));
  console.log("salvo", name, canvasEl.__napiCanvas.width + "x" + canvasEl.__napiCanvas.height);
}

const S = win.SAMPA;
console.log("estado:", !!S, "| ruas:", S && S.state.stats.roads, "| prédios:", S && S.state.stats.buildings, "| erros:", errs.length);

/* minimapa do HUD */
const mini = doc.querySelector("#minimap");
mini.__cw = 236; mini.__ch = 150;
S.state.mapScale = 0.95;

/* mapa grande */
const big = doc.querySelector("#bigmap");
big.__cw = 900; big.__ch = 520;

/* velocímetro */
const speedo = doc.querySelector("#speedo");
speedo.__cw = 200; speedo.__ch = 200;

/* rádio */
const viz = doc.querySelector("#radio-viz");
viz.__cw = 560; viz.__ch = 420;

/* traça uma rota para o destino mais próximo */
const d = win.SAMPA.DISTRICTS[S.state.district];
S.setDestination(d.pois[0], { silent: true });
await wait(120);

S.state.mapNorth = false;
S.state.yaw = 0.7;
S.drawMinimap();
save(mini, "minimap");

S.BIGMAP.x = S.state.x; S.BIGMAP.z = S.state.z; S.BIGMAP.scale = 0.42; S.drawBigMap();
save(big, "bigmap");

S.drawSpeedo(88);
{
  const c = doc.querySelector('#speedo');
  const x = c.getContext('2d');
  const d = x.getImageData(0, Math.round(c.height/2), c.width, 1).data;
  let runs = [], cur = 0, st = 0;
  for (let i = 0; i < c.width; i++) { const a = d[i*4+3]; if (a > 20) { if (!cur) { cur = 1; st = i; } } else if (cur) { runs.push([st, i-1]); cur = 0; } }
  console.log('speedo size', c.width, c.height, 'runs', JSON.stringify(runs));
}
save(speedo, "speedometer");

S.state.radio.playing = true; for (let i = 0; i < 120; i++) S.drawRadioViz(0.016);
save(viz, "radio-viz");

/* texturas de fachada */
const facades = S.getFacadeTextures();
facades.forEach((f, i) => {
  const c = f.map.image;
  save(c, "facade-" + i);
});

/* base do mapa */
const base = S.city.baseCanvas;
if (base) save(base, "map-base");

/* desenha as texturas em um painel */
const panel = doc.createElement("canvas");
panel.width = 512; panel.height = 512;
doc.body.appendChild(panel);
const px = panel.getContext("2d");
px.fillStyle = "#101418"; px.fillRect(0, 0, 512, 512);
["asphalt", "sidewalk", "roof", "ground", "grass", "water"].forEach((k, i) => {
  const img = S.TEXCACHE[k].image;
  px.drawImage(img.__napiCanvas || img, (i % 3) * 170 + 4, Math.floor(i / 3) * 170 + 4, 160, 160);
  px.fillStyle = "#d3fb68"; px.font = "12px sans-serif";
  px.fillText(k, (i % 3) * 170 + 8, Math.floor(i / 3) * 170 + 176);
});
save(panel, "surface-textures");

console.log("erros:", errs.slice(0, 6));
dom.window.close();
process.exit(0);
