/* ============================================================
   SAMPA DRIVER · 09 · GPS, rotas (A*), minimapa e mapa grande
   ============================================================ */

function navKey(x, z) { return Math.round(x) + ":" + Math.round(z); }

function subdividePath(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = dist2(a.x, a.z, b.x, b.z);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      out.push({ x: lerp(a.x, b.x, k / n), z: lerp(a.z, b.z, k / n) });
    }
  }
  out.push({ x: pts[pts.length - 1].x, z: pts[pts.length - 1].z });
  return out;
}

function buildNavGraph() {
  const nodes = new Map();
  const grid = new Map();
  const cell = 26;
  const snap = 2;
  const cellKey = (x, z) => Math.floor(x / cell) + ":" + Math.floor(z / cell);
  const getNode = (x, z) => {
    const gx = Math.round(x / snap) * snap, gz = Math.round(z / snap) * snap;
    const k = gx + ":" + gz;
    let n = nodes.get(k);
    if (!n) {
      n = { k, x: gx, z: gz, edges: [], edgeSet: null };
      nodes.set(k, n);
      const ck = cellKey(gx, gz);
      let arr = grid.get(ck);
      if (!arr) { arr = []; grid.set(ck, arr); }
      arr.push(n);
    }
    return n;
  };
  const link = (a, b, cost, name) => {
    if (a === b) return;
    if (!a.edgeSet) a.edgeSet = new Set();
    if (a.edgeSet.has(b.k)) return;
    a.edgeSet.add(b.k);
    a.edges.push({ to: b.k, cost: cost, name: name });
  };

  for (const road of state.roads) {
    if (!ROAD_DRIVABLE[road.type]) continue;
    const pts = subdividePath(road.pts, 16);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = getNode(pts[i].x, pts[i].z);
      const b = getNode(pts[i + 1].x, pts[i + 1].z);
      if (a === b) continue;
      const cost = dist2(a.x, a.z, b.x, b.z);
      const name = road.name || road.type;
      link(a, b, cost, name);
      if (!road.oneway) link(b, a, cost, name);
    }
  }

  /* conecta cruzamentos que o OSM não compartilha como nó */
  const maxLink = 13;
  for (const n of nodes.values()) {
    const ci = Math.floor(n.x / cell), cj = Math.floor(n.z / cell);
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        const arr = grid.get(i + ":" + j);
        if (!arr) continue;
        for (const m of arr) {
          if (m === n) continue;
          const d = dist2(n.x, n.z, m.x, m.z);
          if (d > maxLink) continue;
          link(n, m, d, "");
          link(m, n, d, "");
        }
      }
    }
  }
  state.navNodes = nodes;
  state.navGrid = grid;
  state.navCell = cell;
  return nodes.size;
}

function nearestNavNode(x, z, maxRing) {
  const nodes = state.navNodes;
  if (!nodes || !nodes.size) return null;
  const cell = state.navCell || 70;
  const grid = state.navGrid;
  const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
  let best = null, bestD = Infinity;
  const maxR = maxRing || 4;
  for (let r = 0; r <= maxR; r++) {
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        if (r > 0 && Math.abs(i - ci) !== r && Math.abs(j - cj) !== r) continue;
        const arr = grid.get(i + ":" + j);
        if (!arr) continue;
        for (const n of arr) {
          const d = dist2(x, z, n.x, n.z);
          if (d < bestD) { bestD = d; best = n; }
        }
      }
    }
    if (best && bestD < (r + 1) * cell) break;
  }
  return best;
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(node, priority) {
    const items = this.items;
    items.push({ node, priority });
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (items[p].priority <= items[i].priority) break;
      const tmp = items[p]; items[p] = items[i]; items[i] = tmp;
      i = p;
    }
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < items.length && items[l].priority < items[m].priority) m = l;
        if (r < items.length && items[r].priority < items[m].priority) m = r;
        if (m === i) break;
        const tmp = items[m]; items[m] = items[i]; items[i] = tmp;
        i = m;
      }
    }
    return top;
  }
}

function findRoute(from, to) {
  const nodes = state.navNodes;
  if (!nodes || !nodes.size) return null;
  const start = nearestNavNode(from.x, from.z, 5);
  const goal = nearestNavNode(to.x, to.z, 6);
  if (!start || !goal) return null;
  const h = (n) => Math.hypot(n.x - goal.x, n.z - goal.z);
  const open = new MinHeap();
  open.push(start.k, h(start));
  const gScore = new Map([[start.k, 0]]);
  const came = new Map();
  const visited = new Set();
  let found = false;
  let guard = 0;
  while (open.size && guard++ < 40000) {
    const cur = open.pop();
    if (!cur) break;
    if (visited.has(cur.node)) continue;
    visited.add(cur.node);
    if (cur.node === goal.k) { found = true; break; }
    const node = nodes.get(cur.node);
    if (!node) continue;
    const base = gScore.get(node.k) || 0;
    for (const edge of node.edges) {
      const nb = nodes.get(edge.to);
      if (!nb || visited.has(nb.k)) continue;
      const score = base + edge.cost;
      if (gScore.has(nb.k) && gScore.get(nb.k) <= score) continue;
      gScore.set(nb.k, score);
      came.set(nb.k, { from: node.k, name: edge.name });
      open.push(nb.k, score + h(nb) * 1.02);
    }
  }
  if (!found) return null;
  const keys = [goal.k];
  let cursor = goal.k;
  let guard2 = 0;
  while (cursor !== start.k && guard2++ < 30000) {
    const rec = came.get(cursor);
    if (!rec) return null;
    keys.unshift(rec.from);
    cursor = rec.from;
  }
  const points = [];
  const names = [];
  for (let i = 0; i < keys.length; i++) {
    const n = nodes.get(keys[i]);
    if (!n) continue;
    points.push({ x: n.x, z: n.z });
    if (i > 0) {
      const rec = came.get(keys[i]);
      names.push(rec ? rec.name : "");
    }
  }
  let dist = 0;
  for (let i = 1; i < points.length; i++) dist += dist2(points[i - 1].x, points[i - 1].z, points[i].x, points[i].z);
  const instructions = buildInstructions(points, names);
  return { points, names, dist, instructions, goal: { x: goal.x, z: goal.z } };
}

function buildInstructions(points, names) {
  const out = [];
  if (points.length < 2) return out;
  let run = 0;
  const first = names[0] || "a via";
  out.push({ at: 0, text: "Siga pela " + cleanName(first), turn: 0, street: cleanName(first) });
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    run += dist2(a.x, a.z, b.x, b.z);
    const ax = b.x - a.x, az = b.z - a.z;
    const bx = c.x - b.x, bz = c.z - b.z;
    const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
    const dot = (ax / la) * (bx / lb) + (az / la) * (bz / lb);
    const cross = (ax / la) * (bz / lb) - (az / la) * (bx / lb);
    const angle = Math.atan2(cross, dot);
    if (Math.abs(angle) < 0.36) continue;
    const name = cleanName(names[i] || names[i - 1] || "a via");
    let text;
    if (Math.abs(angle) > 2.35) text = "Faça o retorno";
    else if (Math.abs(angle) > 1.7) text = angle > 0 ? "Curva fechada à direita" : "Curva fechada à esquerda";
    else text = angle > 0 ? "Vire à direita" : "Vire à esquerda";
    out.push({ at: run, text: text, turn: angle, street: name });
  }
  run += dist2(points[points.length - 2].x, points[points.length - 2].z, points[points.length - 1].x, points[points.length - 1].z);
  out.push({ at: run, text: "Você chegou ao destino", turn: 99, street: "" });
  return out;
}
function cleanName(n) {
  if (!n) return "a via";
  if (/^(primary|secondary|tertiary|residential|service|unclassified|living_street|motorway|trunk)$/.test(n)) return "via";
  return n.replace(/^(Rua|Avenida|Av\.|Alameda|Praça|Travessa)\s+/i, (m) => m);
}

/* ---------- destination ---------- */
function poiWorld(poi) {
  const lm = state.landmarks.find((l) => l.name === poi.name);
  if (lm) return { x: lm.x, z: lm.z };
  return geoToWorld(poi.lat, poi.lon, state.origin);
}

function setDestination(poi, opts) {
  if (!poi) return;
  const o = opts || {};
  const wp = poiWorld(poi);
  const route = findRoute({ x: state.x, z: state.z }, wp);
  state.dest = Object.assign({}, poi, { wx: wp.x, wz: wp.z });
  if (route) {
    state.route = route;
    route.points.unshift({ x: state.x, z: state.z });
    route.points.push({ x: wp.x, z: wp.z });
    state.route.instructions = buildInstructions(state.route.points, state.route.names.concat([""]));
  } else {
    state.route = {
      points: [{ x: state.x, z: state.z }, { x: wp.x, z: wp.z }],
      dist: dist2(state.x, state.z, wp.x, wp.z),
      instructions: [
        { at: 0, text: "Siga em direção ao destino", turn: 0, street: poi.name },
        { at: dist2(state.x, state.z, wp.x, wp.z), text: "Você chegou ao destino", turn: 99, street: "" }
      ],
      names: []
    };
  }
  state.routeIdx = 0;
  state.routeMiss = 0;
  buildRouteLine();
  updateGPSHud(true);
  const dist = state.route.dist || 0;
  const label = dist > 1000 ? (dist / 1000).toFixed(1) + " km" : Math.round(dist) + " m";
  const kmEl = $("#route-km"); if (kmEl) kmEl.textContent = label;
  const etaEl = $("#route-eta"); if (etaEl) etaEl.textContent = Math.max(1, Math.round(dist / 9.5)) + " min";
  const rdEl = $("#route-dist"); if (rdEl) rdEl.textContent = label;
  const summary = $("#route-summary");
  if (summary) summary.textContent = "Rota traçada para " + poi.name + ". " + (state.route.instructions.length - 1) + " orientações até o destino.";
  $("#home-dest").textContent = poi.name;
  $("#home-dest-sub").textContent = label + " · " + Math.max(1, Math.round(dist / 9.5)) + " min · GPS ativo";
  $$("#dest-list .dest-btn").forEach((b) => b.classList.toggle("active", b.dataset.name === poi.name));
  if (!o.silent) { toast("GPS: " + poi.name + " · " + label, "ok"); playClick("ok"); }
  saveGame();
}
function clearRoute() {
  state.route = null;
  state.dest = null;
  if (state.routeLine) {
    scene.remove(state.routeLine);
    state.routeLine.geometry.dispose();
    state.routeLine.material.dispose();
    state.routeLine = null;
  }
  if (state.destBeacon) {
    scene.remove(state.destBeacon);
    state.destBeacon = null;
  }
  updateGPSHud(true);
  const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  set("#route-dist", "—"); set("#route-km", "—"); set("#route-eta", "—");
  set("#home-dest", "Nenhum destino");
  set("#home-dest-sub", "Escolha um ponto turístico no mapa para traçar a rota.");
  const summary = $("#route-summary");
  if (summary) summary.textContent = "Nenhuma rota traçada. Escolha um destino acima para o GPS guiar você pela cidade.";
  $$("#dest-list .dest-btn").forEach((b) => b.classList.remove("active"));
}

/* ---------- 3D route ribbon ---------- */
function dashTexture() {
  if (TEXCACHE.dash) return TEXCACHE.dash;
  const c = cv(64, 16), x = c.getContext("2d");
  x.clearRect(0, 0, 64, 16);
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "rgba(121,230,221,.15)");
  g.addColorStop(0.4, "rgba(150,255,240,.95)");
  g.addColorStop(0.75, "rgba(211,251,104,1)");
  g.addColorStop(1, "rgba(121,230,221,.15)");
  x.fillStyle = g;
  x.fillRect(6, 4, 52, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  TEXCACHE.dash = t;
  return t;
}

function buildRouteLine() {
  if (!state.route) return;
  if (state.routeLine) {
    scene.remove(state.routeLine);
    state.routeLine.geometry.dispose();
    state.routeLine.material.dispose();
    state.routeLine = null;
  }
  const path = state.route.points;
  if (!path || path.length < 2) return;
  const batch = newBatch();
  ribbonInto(batch, path, 1.25, 0.3, { uvScale: 5, uvV: 1 });
  const geo = batchToGeometry(batch);
  if (!geo) return;
  const map = dashTexture();
  const mat = new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: 0.9, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  scene.add(mesh);
  state.routeLine = mesh;

  /* destination beacon */
  const last = path[path.length - 1];
  if (state.destBeacon) { scene.remove(state.destBeacon); state.destBeacon = null; }
  const beacon = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x79e6dd, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 26, 12, 1, true), beamMat);
  beam.position.y = 13;
  beacon.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 32), new THREE.MeshBasicMaterial({ color: 0xd3fb68, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.position.set(last.x, 0, last.z);
  scene.add(beacon);
  state.destBeacon = beacon;
}

/* ---------- GPS HUD ---------- */
function updateGPS(dt) {
  if (!state.route) return;
  state.routeMiss += dt;
  const pts = state.route.points;
  if (!pts || pts.length < 2) return;

  /* progress along route (search near last index) */
  let bestIdx = state.routeIdx || 0, bestD = Infinity;
  const from = Math.max(0, (state.routeIdx || 0) - 3);
  const to = Math.min(pts.length - 2, (state.routeIdx || 0) + 40);
  for (let i = from; i <= to; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((state.x - a.x) * dx + (state.z - a.z) * dz) / len2;
    t = clamp(t, 0, 1);
    const px = a.x + dx * t, pz = a.z + dz * t;
    const d = dist2(state.x, state.z, px, pz);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  state.routeIdx = bestIdx;
  state.offRoute = bestD;

  /* recompute when far away */
  if (bestD > 42 && state.routeMiss > 2.6) {
    state.routeMiss = 0;
    const dest = state.dest;
    if (dest) setDestination(dest, { silent: true });
    return;
  }

  let along = 0;
  for (let i = 0; i < bestIdx; i++) along += dist2(pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
  const total = state.route.dist || 0;
  let remaining = 0;
  for (let i = bestIdx; i < pts.length - 1; i++) remaining += dist2(pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);

  const instrs = state.route.instructions || [];
  let next = instrs[instrs.length - 1];
  for (const ins of instrs) {
    if (ins.at > along + 3) { next = ins; break; }
  }
  const distToTurn = Math.max(0, (next.at || 0) - along);
  const remainingLabel = remaining > 1000 ? (remaining / 1000).toFixed(1) + " km" : Math.round(remaining) + " m";
  const turnLabel = next.turn === 99 ? remainingLabel : (distToTurn > 1000 ? (distToTurn / 1000).toFixed(1) + " km" : Math.round(distToTurn) + " m");

  const instrEl = $("#nav-instr");
  if (instrEl) instrEl.textContent = next.turn === 99 ? "Chegando ao destino" : next.text;
  const distEl = $("#nav-distance");
  if (distEl) distEl.textContent = turnLabel;
  const streetEl = $("#nav-street");
  if (streetEl) streetEl.textContent = next.street ? next.street : (state.dest ? state.dest.name : "Passeio livre");
  const arrow = $("#nav-arrow");
  if (arrow) {
    let rot = 0;
    if (next.turn === 0) rot = 0;
    else if (next.turn === 99) rot = 180;
    else rot = clamp(next.turn * (180 / Math.PI), -160, 160);
    arrow.style.transform = "rotate(" + rot + "deg)";
  }
  const bar = $("#nav-progress");
  if (bar) bar.style.width = clamp(total ? (1 - remaining / total) * 100 : 0, 0, 100) + "%";
  const etaEl = $("#nav-eta");
  if (etaEl) etaEl.textContent = "≈ " + Math.max(1, Math.round(remaining / 9.5)) + " min";
  const totEl = $("#nav-total");
  if (totEl) totEl.textContent = remainingLabel + " restantes";

  if (remaining < 22 && state.dest) {
    toast("Você chegou: " + state.dest.name, "ok");
    playClick("ok");
    clearRoute();
  }
}

function updateGPSHud(force) {
  if (!state.route) {
    const instrEl = $("#nav-instr");
    if (instrEl) instrEl.textContent = "Passeio livre";
    const distEl = $("#nav-distance");
    if (distEl) distEl.textContent = "—";
    const streetEl = $("#nav-street");
    if (streetEl) streetEl.textContent = "Escolha um destino no mapa";
    const arrow = $("#nav-arrow");
    if (arrow) arrow.style.transform = "rotate(0deg)";
    const bar = $("#nav-progress");
    if (bar) bar.style.width = "0%";
    const etaEl = $("#nav-eta"); if (etaEl) etaEl.textContent = "—";
    const totEl = $("#nav-total"); if (totEl) totEl.textContent = "—";
  }
  const card = $("#nav-card");
  if (card) card.classList.toggle("active", !!state.route);
}

/* ---------- destination list ---------- */
function refreshDestinations() {
  const list = $("#dest-list");
  if (!list) return;
  const d = DISTRICTS[state.district];
  list.innerHTML = "";
  const items = d.pois.map((poi) => ({ poi, wp: poiWorld(poi) }));
  items.sort((a, b) => dist2(state.x, state.z, a.wp.x, a.wp.z) - dist2(state.x, state.z, b.wp.x, b.wp.z));
  items.forEach(({ poi, wp }) => {
    const btn = document.createElement("button");
    btn.className = "dest-btn";
    btn.dataset.name = poi.name;
    const distance = dist2(state.x, state.z, wp.x, wp.z);
    const label = distance > 1000 ? (distance / 1000).toFixed(1) + " km" : Math.round(distance) + " m";
    btn.innerHTML = '<svg class="ico"><use href="#i-pin"/></svg><span>' + poi.name + "</span><small>" + label + "</small>";
    btn.addEventListener("click", () => setDestination(poi));
    list.appendChild(btn);
  });
  const count = $("#dest-count");
  if (count) count.textContent = String(items.length);
}

/* ---------- map base (offscreen) ---------- */
function renderMapBase() {
  const roads = state.roads || [];
  const buildings = state.buildings || [];
  if (!roads.length) return;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of roads) {
    for (const p of r.pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
  }
  const pad = 90;
  minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
  const w = maxX - minX, h = maxZ - minZ;
  const size = 2048;
  const scale = size / Math.max(w, h);
  const canvas = cv(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#0a1217";
  ctx.fillRect(0, 0, size, size);
  const offX = (size - w * scale) / 2, offZ = (size - h * scale) / 2;
  const px = (x) => (x - minX) * scale + offX;
  const pz = (z) => (z - minZ) * scale + offZ;

  /* parks */
  ctx.fillStyle = "#10251a";
  for (const ring of state.parks || []) {
    ctx.beginPath();
    ring.forEach((p, i) => (i ? ctx.lineTo(px(p.x), pz(p.z)) : ctx.moveTo(px(p.x), pz(p.z))));
    ctx.closePath();
    ctx.fill();
  }
  /* water */
  ctx.fillStyle = "#0d2833";
  for (const ring of state.waters || []) {
    ctx.beginPath();
    ring.forEach((p, i) => (i ? ctx.lineTo(px(p.x), pz(p.z)) : ctx.moveTo(px(p.x), pz(p.z))));
    ctx.closePath();
    ctx.fill();
  }
  /* buildings */
  for (const b of buildings) {
    if (!b.ring) continue;
    ctx.beginPath();
    b.ring.forEach((p, i) => (i ? ctx.lineTo(px(p.x), pz(p.z)) : ctx.moveTo(px(p.x), pz(p.z))));
    ctx.closePath();
    ctx.fillStyle = b.h > 45 ? "#1b2831" : "#18232b";
    ctx.fill();
  }
  /* roads: casing, fill, then a discreet centre line on wide roads */
  const drawRoads = (color, widthScale, minWidth) => {
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const r of roads) {
      if (r.type === "footway") continue;
      if (minWidth && r.width < minWidth) continue;
      ctx.beginPath();
      r.pts.forEach((p, i) => (i ? ctx.lineTo(px(p.x), pz(p.z)) : ctx.moveTo(px(p.x), pz(p.z))));
      ctx.lineWidth = Math.max(1, r.width * scale * widthScale);
      ctx.stroke();
    }
  };
  drawRoads("#1a242c", 1.34);
  drawRoads("#27323a", 1);
  drawRoads("#36434c", 0.46, 11);
  ctx.strokeStyle = "rgba(140,178,188,.20)";
  ctx.lineWidth = 1.1;
  for (const r of roads) {
    if (r.width < 14) continue;
    ctx.beginPath();
    r.pts.forEach((p, i) => (i ? ctx.lineTo(px(p.x), pz(p.z)) : ctx.moveTo(px(p.x), pz(p.z))));
    ctx.stroke();
  }

  CITY.baseCanvas = canvas;
  CITY.baseBounds = { minX, minZ, scale, offX, offZ, size };
}
function worldToBase(x, z) {
  const b = CITY.baseBounds;
  if (!b) return { x: 0, y: 0 };
  return { x: (x - b.minX) * b.scale + b.offX, y: (z - b.minZ) * b.scale + b.offZ };
}

/* ---------- minimap ---------- */
function drawMinimap() {
  const canvas = $("#minimap");
  if (!canvas || !CITY.baseCanvas || !canvas.getContext) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (!cw || !ch) return;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = "#081016";
  ctx.fillRect(0, 0, cw, ch);

  const p = worldToBase(state.x, state.z);
  const ppm = (state.mapScale || 0.62) * (cw / 236);
  const k = ppm / CITY.baseBounds.scale;
  const rot = state.mapNorth ? 0 : state.yaw;

  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ctx.drawImage(CITY.baseCanvas, -p.x, -p.y);
  ctx.restore();

  /* route */
  if (state.route) {
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(rot);
    ctx.scale(k, k);
    ctx.beginPath();
    state.route.points.forEach((pt, i) => {
      const b = worldToBase(pt.x, pt.z);
      if (i) ctx.lineTo(b.x - p.x, b.y - p.y);
      else ctx.moveTo(b.x - p.x, b.y - p.y);
    });
    ctx.strokeStyle = "rgba(121,230,221,.95)";
    ctx.lineWidth = 2.6 / k;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = "rgba(211,251,104,.5)";
    ctx.lineWidth = 6 / k;
    ctx.globalAlpha = 0.28;
    ctx.stroke();
    ctx.restore();
  }

  /* destination pin (screen space) */
  if (state.dest) {
    const b = worldToBase(state.dest.wx, state.dest.wz);
    const rel = { x: b.x - p.x, y: b.y - p.y };
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const sx = cw / 2 + (rel.x * cos - rel.y * sin) * k;
    const sy = ch / 2 + (rel.x * sin + rel.y * cos) * k;
    if (sx > -20 && sx < cw + 20 && sy > -20 && sy < ch + 20) {
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, TAU);
      ctx.fillStyle = "#d3fb68";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, TAU);
      ctx.strokeStyle = "rgba(211,251,104,.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const ang = Math.atan2(sy - ch / 2, sx - cw / 2);
      const rx = cw / 2 + Math.cos(ang) * (cw / 2 - 12);
      const ry = ch / 2 + Math.sin(ang) * (ch / 2 - 12);
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, TAU);
      ctx.fillStyle = "#d3fb68";
      ctx.fill();
    }
  }

  /* player arrow */
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(state.mapNorth ? -state.yaw : 0);
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5.5, 7);
  ctx.lineTo(0, 4);
  ctx.lineTo(-5.5, 7);
  ctx.closePath();
  ctx.fillStyle = "#f2f7f2";
  ctx.shadowColor = "rgba(211,251,104,.85)";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  /* north indicator */
  const comp = $("#mini-compass");
  if (comp) {
    comp.textContent = "N";
    comp.style.transform = state.mapNorth ? "none" : "rotate(" + (-state.yaw) + "rad)";
  }
}

/* ---------- big map ---------- */
const BIGMAP = { x: 0, z: 0, scale: 0.34, dragging: false, lastX: 0, lastY: 0, init: false };
function drawBigMap() {
  const canvas = $("#bigmap");
  if (!canvas || !CITY.baseCanvas || !canvas.getContext) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (!cw || !ch) return;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#081016";
  ctx.fillRect(0, 0, cw, ch);
  if (!BIGMAP.init) { BIGMAP.x = state.x; BIGMAP.z = state.z; BIGMAP.init = true; }
  const b = CITY.baseBounds;
  const k = BIGMAP.scale / b.scale;
  const pc = worldToBase(BIGMAP.x, BIGMAP.z);
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.scale(k, k);
  ctx.drawImage(CITY.baseCanvas, -pc.x, -pc.y);
  ctx.restore();

  const toScreen = (x, z) => {
    const q = worldToBase(x, z);
    return { x: cw / 2 + (q.x - pc.x) * k, y: ch / 2 + (q.y - pc.y) * k };
  };
  /* route */
  if (state.route) {
    ctx.beginPath();
    state.route.points.forEach((pt, i) => {
      const s = toScreen(pt.x, pt.z);
      if (i) ctx.lineTo(s.x, s.y);
      else ctx.moveTo(s.x, s.y);
    });
    ctx.strokeStyle = "rgba(121,230,221,.32)";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = "#79e6dd";
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  /* pois */
  const d = DISTRICTS[state.district];
  d.pois.forEach((poi) => {
    const wp = poiWorld(poi);
    const s = toScreen(wp.x, wp.z);
    if (s.x < -40 || s.x > cw + 40 || s.y < -40 || s.y > ch + 40) return;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5, 0, TAU);
    ctx.fillStyle = state.dest && state.dest.name === poi.name ? "#d3fb68" : "rgba(121,230,221,.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(5,10,14,.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const label = poi.name.split("·")[0].trim();
    ctx.font = "600 10px Manrope, Arial";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(6,12,16,.78)";
    roundRect(ctx, s.x + 9, s.y - 9, tw + 12, 18, 6);
    ctx.fill();
    ctx.fillStyle = "#dce8e6";
    ctx.fillText(label, s.x + 15, s.y + 4);
  });
  /* player */
  const ps = toScreen(state.x, state.z);
  ctx.save();
  ctx.translate(ps.x, ps.y);
  ctx.rotate(-state.yaw);
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6, 8);
  ctx.lineTo(0, 4.5);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fillStyle = "#f2f7f2";
  ctx.shadowColor = "rgba(211,251,104,.9)";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.restore();

  /* scale bar */
  const scaleEl = $("#bigmap-scale");
  if (scaleEl) {
    const metersPer100 = 100 / BIGMAP.scale;
    let label = "100 m";
    let px100 = 100 * BIGMAP.scale;
    if (px100 < 40) { label = "500 m"; px100 = 500 * BIGMAP.scale; }
    if (px100 < 40) { label = "1 km"; px100 = 1000 * BIGMAP.scale; }
    scaleEl.textContent = label;
  }
}
function setupBigMap() {
  const canvas = $("#bigmap");
  if (!canvas) return;
  canvas.addEventListener("pointerdown", (e) => {
    BIGMAP.dragging = true;
    BIGMAP.lastX = e.clientX;
    BIGMAP.lastY = e.clientY;
    BIGMAP.downX = e.clientX;
    BIGMAP.downY = e.clientY;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!BIGMAP.dragging) return;
    const dx = e.clientX - BIGMAP.lastX, dy = e.clientY - BIGMAP.lastY;
    BIGMAP.lastX = e.clientX; BIGMAP.lastY = e.clientY;
    BIGMAP.x -= dx / BIGMAP.scale;
    BIGMAP.z -= dy / BIGMAP.scale;
    drawBigMap();
  });
  window.addEventListener("pointerup", () => { BIGMAP.dragging = false; });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    BIGMAP.scale = clamp(BIGMAP.scale * (e.deltaY > 0 ? 0.9 : 1.1), 0.06, 2.4);
    drawBigMap();
  }, { passive: false });
  canvas.addEventListener("click", (e) => {
    if (Math.abs(e.clientX - (BIGMAP.downX || 0)) > 5 || Math.abs(e.clientY - (BIGMAP.downY || 0)) > 5) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bestD = 40;
    const d = DISTRICTS[state.district];
    d.pois.forEach((poi) => {
      const wp = poiWorld(poi);
      const b = CITY.baseBounds;
      if (!b) return;
      const pc = worldToBase(BIGMAP.x, BIGMAP.z);
      const q = worldToBase(wp.x, wp.z);
      const k = BIGMAP.scale / b.scale;
      const sx = canvas.clientWidth / 2 + (q.x - pc.x) * k;
      const sy = canvas.clientHeight / 2 + (q.y - pc.y) * k;
      const dist = Math.hypot(sx - mx, sy - my);
      if (dist < bestD) { bestD = dist; best = poi; }
    });
    if (best) setDestination(best);
  });
  const zi = $("#bigmap-zoom-in"), zo = $("#bigmap-zoom-out"), ce = $("#bigmap-center");
  if (zi) zi.addEventListener("click", () => { BIGMAP.scale = clamp(BIGMAP.scale * 1.35, 0.06, 2.4); drawBigMap(); });
  if (zo) zo.addEventListener("click", () => { BIGMAP.scale = clamp(BIGMAP.scale / 1.35, 0.06, 2.4); drawBigMap(); });
  if (ce) ce.addEventListener("click", () => { BIGMAP.x = state.x; BIGMAP.z = state.z; drawBigMap(); });
}
