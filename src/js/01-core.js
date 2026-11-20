/* ============================================================
   SAMPA DRIVER · 01 · core
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.prototype.slice.call(root.querySelectorAll(sel));
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const pad2 = (n) => String(n).padStart(2, "0");
const round = (n, d = 0) => Number(n.toFixed(d));

/* ---------- geometry helpers ---------- */
const M_PER_DEG_LAT = 111320;
const mPerDegLon = (lat) => 111320 * Math.cos(lat * DEG);

/* shortcut for three materials */
const MAT = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, opts || {}));
const PHYS = (color, opts) => new THREE.MeshPhysicalMaterial(Object.assign({
  color, roughness: 0.42, metalness: 0.35, clearcoat: 0.85, clearcoatRoughness: 0.16
}, opts || {}));

/* ---------- São Paulo ---------- */
const DISTRICTS = {
  paulista: {
    id: "paulista", name: "Avenida Paulista", short: "Paulista",
    lat: -23.5614, lon: -46.6559, radius: 1150, seedHeading: -0.42,
    blurb: "O coração financeiro e cultural da cidade.",
    pois: [
      { name: "MASP · Museu de Arte", lat: -23.56141, lon: -46.65578, icon: "museum" },
      { name: "Parque Trianon", lat: -23.56214, lon: -46.65760 },
      { name: "FIESP · Av. Paulista", lat: -23.56224, lon: -46.65313 },
      { name: "Conjunto Nacional", lat: -23.55754, lon: -46.66030 },
      { name: "Praça do Ciclista", lat: -23.55486, lon: -46.66150 },
      { name: "Rua Augusta", lat: -23.55460, lon: -46.66000 },
      { name: "Rua Oscar Freire", lat: -23.56460, lon: -46.66910 },
      { name: "Parque Ibirapuera", lat: -23.58740, lon: -46.65760 },
      { name: "Estação Consolação", lat: -23.55930, lon: -46.66190 },
      { name: "Museu da Imagem e do Som", lat: -23.55900, lon: -46.65900 },
    ]
  },
  centro: {
    id: "centro", name: "Centro Histórico", short: "Centro",
    lat: -23.55052, lon: -46.63331, radius: 1000, seedHeading: 0.9,
    blurb: "Onde São Paulo nasceu, entre praças e edifícios históricos.",
    pois: [
      { name: "Praça da Sé", lat: -23.55076, lon: -46.63411 },
      { name: "Catedral da Sé", lat: -23.55037, lon: -46.63411, icon: "catedral" },
      { name: "Pátio do Colégio", lat: -23.54787, lon: -46.63364 },
      { name: "Mercado Municipal", lat: -23.54183, lon: -46.62939 },
      { name: "Theatro Municipal", lat: -23.54536, lon: -46.63858 },
      { name: "Edifício Copan", lat: -23.54653, lon: -46.64464, icon: "copan" },
      { name: "Farol Santander", lat: -23.54560, lon: -46.63490 },
      { name: "Mosteiro de São Bento", lat: -23.54512, lon: -46.63389 },
      { name: "Praça da República", lat: -23.54400, lon: -46.64280 },
      { name: "Estação da Luz", lat: -23.53510, lon: -46.63560 },
    ]
  },
  ibirapuera: {
    id: "ibirapuera", name: "Ibirapuera", short: "Ibirapuera",
    lat: -23.58740, lon: -46.65760, radius: 1150, seedHeading: 2.3,
    blurb: "O parque mais conhecido da cidade, com museus e pista de corrida.",
    pois: [
      { name: "Portão 10 · Ibirapuera", lat: -23.58740, lon: -46.65760 },
      { name: "Oca do Ibirapuera", lat: -23.58750, lon: -46.65720, icon: "oca" },
      { name: "Obelisco de São Paulo", lat: -23.58480, lon: -46.65950 },
      { name: "Museu Afro Brasil", lat: -23.58700, lon: -46.65810 },
      { name: "Lago do Ibirapuera", lat: -23.58550, lon: -46.65620 },
      { name: "Auditório Ibirapuera", lat: -23.58510, lon: -46.65680 },
      { name: "Rua Pedro de Toledo", lat: -23.59470, lon: -46.64180 },
      { name: "Avenida República do Líbano", lat: -23.59010, lon: -46.65860 },
    ]
  },
  pinheiros: {
    id: "pinheiros", name: "Pinheiros / Faria Lima", short: "Pinheiros",
    lat: -23.56650, lon: -46.69000, radius: 1100, seedHeading: 1.7,
    blurb: "Bares, escritórios e o vai-e-vem da Faria Lima.",
    pois: [
      { name: "Largo da Batata", lat: -23.56690, lon: -46.68920 },
      { name: "Beco do Batman", lat: -23.55480, lon: -46.69050 },
      { name: "Rua dos Pinheiros", lat: -23.56690, lon: -46.68450 },
      { name: "Avenida Faria Lima", lat: -23.57800, lon: -46.68900 },
      { name: "Instituto Tomie Ohtake", lat: -23.57270, lon: -46.68760 },
      { name: "Estação Fradique Coutinho", lat: -23.56660, lon: -46.69060 },
      { name: "Rua Teodoro Sampaio", lat: -23.56000, lon: -46.68500 },
      { name: "Ponte Cidade Universitária", lat: -23.57200, lon: -46.71100 },
    ]
  }
};

const CAR_LIST = ["fusca", "uno", "jeep"];

const CARS = {
  fusca: {
    id: "fusca",
    name: "Fusca Noturno",
    model: "VW Fusca 1300 · 1974",
    kind: "clássico nacional",
    color: 0x1b2f52,
    css: "#2c4a78",
    accent: "#7fa6dd",
    desc: "O clássico azul-escuro. Boxer 1.3 refrigerado a ar, quatro marchas e aquele ronco de besouro que todo mundo reconhece de longe.",
    maxKmh: 128, accel: 7.6, brake: 15, handbrake: 20, grip: 1.06, mass: 890,
    engine: "1.3 BOXER", driveTag: "TRASEIRA", gearCount: 4, power: 46,
    bars: { speed: 52, accel: 58, grip: 68, weight: 34 },
    sound: { style: "boxer", idle: 620, redline: 4200, hp: 380, hp2: 190, horn: [392, 494], loud: 0.62 }
  },
  uno: {
    id: "uno",
    name: "Uno Escada",
    model: "Fiat Uno 1.0 · escada no teto",
    kind: "guerreiro do asfalto",
    color: 0xecece1,
    css: "#e7e6dc",
    accent: "#bfc4b8",
    desc: "Branco, econômico e com uma escada amarrada no teto desde 1998. Motor 1.0 FIRE, leve, esperto e pronto para qualquer mudança.",
    maxKmh: 152, accel: 9.2, brake: 16, handbrake: 22, grip: 1.14, mass: 920,
    engine: "1.0 FIRE", driveTag: "DIANTEIRA", gearCount: 5, power: 60,
    bars: { speed: 68, accel: 76, grip: 74, weight: 42 },
    sound: { style: "fire", idle: 760, redline: 5200, hp: 300, hp2: 220, horn: [420, 520], loud: 0.66 }
  },
  jeep: {
    id: "jeep",
    name: "Jipe Verde",
    model: "Jipe 4×4 · trilha urbana",
    kind: "aventura 4x4",
    color: 0x2f5d3a,
    css: "#3f7a4b",
    accent: "#8fc39a",
    desc: "Verde floresta, tração nas quatro, pneus cravados e barra de faróis no teto. Feito para subir calçada, encarar chuva e dominar a cidade.",
    maxKmh: 138, accel: 6.6, brake: 13, handbrake: 17, grip: 0.98, mass: 1480,
    engine: "2.0 4×4", driveTag: "4×4", gearCount: 5, power: 118,
    bars: { speed: 58, accel: 62, grip: 60, weight: 82 },
    sound: { style: "jeep", idle: 540, redline: 3800, hp: 210, hp2: 140, horn: [300, 372], loud: 0.78 }
  }
};

const DEFAULTS = {
  quality: "high", shadows: true, view: "far", traffic: "mid",
  weather: "clear", timelapse: true, hour: 16, autolight: true,
  engine: true, sfx: 0.65, music: 0.72, ambient: true,
  assist: true, camera: "third", sens: 1, save: true, district: "paulista"
};

const state = {
  /* session */
  booted: false, menu: true, playing: false, paused: false, photo: false,
  district: "paulista",
  car: "fusca",
  camera: "third",
  camZoom: 1,
  camOrbit: 0, camHeight: 0,
  /* vehicle */
  x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, steer: 0,
  gear: 1, rpm: 900, throttle: 0, brakeInput: 0, handbrake: false,
  odometer: 0, condition: 100, topSpeed: 0,
  lights: false, hazard: false, drifting: false,
  /* world */
  roads: [], buildings: [], parks: [], waters: [], roadPaths: [],
  navNodes: new Map(), navEdges: [], navGrid: new Map(),
  blockers: null, roadGrid: null,
  traffic: [], landmarks: [],
  hostLabels: [],
  stats: { roads: 0, buildings: 0 },
  osmReady: false, osmOnline: false, osmLoading: false,
  /* gps */
  dest: null, route: null, routeLine: null, nextInstr: null, routeProgress: 0,
  /* radio */
  radio: { source: "youtube", queue: [], index: 0, playing: false, title: "", sub: "", type: "", mode: "", ready: false, status: "idle", url: "", volume: 0.72 },
  /* audio */
  audioReady: false, muted: false,
  /* input */
  keys: Object.create(null),
  pointer: { dragging: false, lastX: 0, lastY: 0, moved: 0 },
  engineOn: false,
  /* maps */
  mapScale: 0.95, mapNorth: false, mapCenter: null,
  settings: Object.assign({}, DEFAULTS),
  lastSave: 0, savedAt: 0,
  hour: 16,
  weatherName: "",
  fps: 60
};

/* radio initial queue fix (kept simple, avoids exotic syntax in old parsers) */
state.radio.queue = [];

const SAVE_KEY = "sampa-driver-v3";

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(text, kind) {
  const el = $("#toast");
  if (!el) return;
  $("#toast-text").textContent = text;
  el.className = "toast show" + (kind ? " " + kind : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast" + (kind ? " " + kind : ""); }, 3000);
}

/* ---------- canvas textures ---------- */
function cv(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
function tex(canvas, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat, repeat);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noiseFill(ctx, w, h, amount, alpha) {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * w, y = Math.random() * h, s = Math.random() * 2 + 0.5;
    ctx.fillStyle = "rgba(" + (Math.random() > 0.5 ? 255 : 0) + "," + (Math.random() > 0.5 ? 255 : 0) + "," + (Math.random() > 0.5 ? 255 : 0) + "," + (Math.random() * alpha) + ")";
    ctx.fillRect(x, y, s, s);
  }
}
function softCircleTexture(size, color, hardness) {
  const c = cv(size, size), x = c.getContext("2d");
  const g = x.createRadialGradient(size / 2, size / 2, size * 0.02, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(hardness || 0.45, color.replace(/[\d.]+\)$/, "0.28)"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/* ---------- storage ---------- */
function saveGame(force) {
  if (!state.settings.save && !force) return;
  try {
    const data = {
      v: 3,
      car: state.car,
      district: state.district,
      settings: state.settings,
      odometer: state.odometer,
      topSpeed: state.topSpeed,
      pos: { x: state.x, z: state.z, yaw: state.yaw },
      radio: { source: state.radio.source, url: state.radio.url || "" },
      savedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.savedAt = Date.now();
  } catch (e) { /* storage may be blocked */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data) return;
    if (CARS[data.car]) state.car = data.car;
    if (data.settings) state.settings = Object.assign({}, DEFAULTS, data.settings);
    if (DISTRICTS[data.settings && data.settings.district]) state.district = data.settings.district;
    if (DISTRICTS[data.district]) state.district = data.district;
    if (Number.isFinite(data.odometer)) state.odometer = data.odometer;
    if (Number.isFinite(data.topSpeed)) state.topSpeed = data.topSpeed;
    if (data.pos && Number.isFinite(data.pos.x)) state.savedPos = data.pos;
    if (data.radio && data.radio.url) { state.radio.url = data.radio.url; state.radio.source = data.radio.source || "youtube"; }
  } catch (e) { /* ignore */ }
}
function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  state.odometer = 0; state.topSpeed = 0; state.savedPos = null;
}

/* ---------- colour helpers ---------- */
function hexCss(hex) { return "#" + hex.toString(16).padStart(6, "0"); }
function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t)));
}

/* ---------- geo / nav basics shared across modules ---------- */
function geoToWorld(lat, lon, origin) {
  const o = origin || state.origin;
  return { x: (lon - o.lon) * mPerDegLon(o.lat), z: -(lat - o.lat) * M_PER_DEG_LAT };
}
function worldToGeo(x, z, origin) {
  const o = origin || state.origin;
  return { lat: o.lat - z / M_PER_DEG_LAT, lon: o.lon + x / mPerDegLon(o.lat) };
}
function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

/* spatial hash for blockers (buildings) */
function buildBlockers(items, cellSize) {
  const cs = cellSize || 24;
  const grid = new Map();
  const key = (i, j) => i + ":" + j;
  for (const b of items) {
    const i0 = Math.floor(b.minX / cs), i1 = Math.floor(b.maxX / cs);
    const j0 = Math.floor(b.minZ / cs), j1 = Math.floor(b.maxZ / cs);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        let arr = grid.get(k);
        if (!arr) { arr = []; grid.set(k, arr); }
        arr.push(b);
      }
    }
  }
  return { grid, cs, key };
}
function blockersNear(blockers, x, z, r) {
  const out = [];
  if (!blockers) return out;
  const cs = blockers.cs;
  const i0 = Math.floor((x - r) / cs), i1 = Math.floor((x + r) / cs);
  const j0 = Math.floor((z - r) / cs), j1 = Math.floor((z + r) / cs);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const arr = blockers.grid.get(blockers.key(i, j));
      if (arr) for (const b of arr) if (out.indexOf(b) < 0) out.push(b);
    }
  }
  return out;
}

/* roads spatial grid for off-road detection */
function buildRoadGrid(paths) {
  const cs = 30;
  const grid = new Map();
  const key = (i, j) => i + ":" + j;
  const push = (i, j, seg) => {
    const k = key(i, j);
    let arr = grid.get(k);
    if (!arr) { arr = []; grid.set(k, arr); }
    arr.push(seg);
  };
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const seg = { ax: a.x, az: a.z, bx: b.x, bz: b.z, w: b.w || a.w || 8 };
      const i0 = Math.floor(Math.min(a.x, b.x) / cs) - 1, i1 = Math.floor(Math.max(a.x, b.x) / cs) + 1;
      const j0 = Math.floor(Math.min(a.z, b.z) / cs) - 1, j1 = Math.floor(Math.max(a.z, b.z) / cs) + 1;
      for (let x = i0; x <= i1; x++) for (let z = j0; z <= j1; z++) push(x, z, seg);
    }
  }
  return { grid, cs, key };
}
function nearestRoadInfo(x, z) {
  const g = state.roadGrid;
  if (!g) return { d: Infinity, width: 0, on: false };
  let best = Infinity, width = 0;
  const i0 = Math.floor(x / g.cs), j0 = Math.floor(z / g.cs);
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const arr = g.grid.get(g.key(i0 + di, j0 + dj));
      if (!arr) continue;
      for (const s of arr) {
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        const len2 = dx * dx + dz * dz || 1;
        let t = ((x - s.ax) * dx + (z - s.az) * dz) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = s.ax + dx * t, pz = s.az + dz * t;
        const d = Math.hypot(x - px, z - pz);
        if (d < best) { best = d; width = s.w; }
      }
    }
  }
  return { d: best, width, on: best < width * 0.55 + 1.6 };
}
