/* Diagnóstico de direção: geometria dos carros, spawn e resposta ao acelerador. */
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("index.html"), "utf8");
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
const vc = new VirtualConsole();
const soft = [];
vc.on("jsdomError", (e) => { const m = String(e.message || e); if (/Not implemented: HTMLMediaElement/.test(m)) return; soft.push("jsdomError: " + m.split("\n")[0]); });
vc.on("error", (...a) => soft.push("console.error: " + a.join(" ")));
vc.on("warn", (...a) => { const s = a.join(" "); if (!/simulado|fetch bloqueado|OSM|Audio|WebGL|deprecated/i.test(s)) soft.push("warn: " + s); });

const dom = new JSDOM(patched, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost:8080/", virtualConsole: vc });
const win = dom.window, doc = win.document, THREE = win.THREE;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await new Promise((r) => win.addEventListener("load", r));
await wait(700);
const S = win.SAMPA;
const fmt = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString();

console.log("=== geometria dos carros ===");
for (const key of ["fusca", "uno", "jeep"]) {
  S.state.car = key;
  const model = S.buildVehicle(key);
  const g = model.root;
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  let nan = 0, verts = 0, meshes = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
    if (!pos) return;
    verts += pos.count;
    for (let i = 0; i < pos.array.length; i++) if (!Number.isFinite(pos.array[i])) nan++;
  });
  console.log(`${key}: tam ${fmt(size.x)}x${fmt(size.y)}x${fmt(size.z)} m | y ${fmt(box.min.y)}→${fmt(box.max.y)} | malhas ${meshes} | vtx ${verts} | NaN ${nan}`);
}

console.log("\n=== spawn ===");
S.selectCar("fusca", { silent: true });
S.startGame();
await wait(300);
const st = S.state, pl = S.player;
console.log(`player em x=${fmt(st.x)} z=${fmt(st.z)} y=${fmt(pl.model.root.position.y)} vel=${fmt(st.speed)}`);
const blockers = [];
if (st.blockers && st.blockers.grid) for (const arr of st.blockers.grid.values()) for (const b of arr) blockers.push(b);
let inside = 0, nearest = Infinity, nearestB = null;
for (const b of blockers) {
  const dx = Math.max(b.minX - st.x, 0, st.x - b.maxX);
  const dz = Math.max(b.minZ - st.z, 0, st.z - b.maxZ);
  const d = Math.hypot(dx, dz);
  if (d === 0) inside++;
  if (d < nearest) { nearest = d; nearestB = b; }
}
console.log(`dentro de prédio: ${inside} | prédio mais próximo a ${fmt(nearest)} m (altura ${nearestB ? fmt(nearestB.h) : "-"})`);

console.log("\n=== acelerando 3s ===");
function keydown(k) { doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); }
function keyup(k) { doc.dispatchEvent(new win.KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true })); }
const t0 = { x: st.x, z: st.z };
keydown("w");
const samples = [];
for (let i = 0; i < 12; i++) { await wait(250); samples.push([fmt(st.speed), fmt(st.x, 1), fmt(st.z, 1), fmt(st.heading !== undefined ? st.heading : st.yaw, 2)]); }
keyup("w");
console.log("t | vel | x | z | yaw");
samples.forEach((s, i) => console.log(`${((i + 1) * 0.25).toFixed(2)}s | ${s.join(" | ")}`));
console.log(`deslocamento total: ${fmt(Math.hypot(st.x - t0.x, st.z - t0.z))} m`);

console.log("\n=== erros ===", soft.slice(0, 6));
dom.window.close();
process.exit(0);
