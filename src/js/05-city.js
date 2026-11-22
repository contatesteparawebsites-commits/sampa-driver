/* ============================================================
   SAMPA DRIVER · 05 · cidade 3D a partir do OpenStreetMap
   ============================================================ */

const ROAD_WIDTH = {
  motorway: 20, motorway_link: 10, trunk: 18, trunk_link: 9,
  primary: 16, primary_link: 8, secondary: 13, secondary_link: 7,
  tertiary: 11, tertiary_link: 6.5, unclassified: 9, residential: 8,
  living_street: 7, service: 5.5, pedestrian: 6, footway: 2.6,
  cycleway: 2.8, path: 2.2, steps: 2.4, track: 4
};
const ROAD_DRIVABLE = {
  motorway: 1, trunk: 1, primary: 1, secondary: 1, tertiary: 1,
  unclassified: 1, residential: 1, living_street: 1, service: 1
};
const ROAD_COLOR = {
  motorway: 0x868c90, trunk: 0x888e92, primary: 0x8a9094, secondary: 0x8c9296,
  tertiary: 0x8e9498, residential: 0x90969a, unclassified: 0x8e9498,
  living_street: 0x92989c, service: 0x91979b, pedestrian: 0x9a9a91, footway: 0xa2a29a
};

let CITY = {
  wallMats: [], roofMat: null, sidewalkMat: null, groundMat: null,
  roadMats: {}, visible: false, baseCanvas: null, baseSize: 0, baseBounds: null,
  lampCount: 0, treeCount: 0
};

function districtOrigin(d) {
  return { lat: d.lat, lon: d.lon };
}

/* ---------- ribbon geometry ---------- */
function offsetPathPoints(path, dist) {
  const out = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
    let dx = next.x - prev.x, dz = next.z - prev.z;
    let len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const nx = -dz, nz = dx;
    /* miter scale */
    let scale = 1;
    if (i > 0 && i < path.length - 1) {
      const pdx = path[i].x - prev.x, pdz = path[i].z - prev.z;
      const ndx = next.x - path[i].x, ndz = next.z - path[i].z;
      const pl = Math.hypot(pdx, pdz) || 1, nl = Math.hypot(ndx, ndz) || 1;
      const dot = (pdx / pl) * (ndx / nl) + (pdz / pl) * (ndz / nl);
      scale = clamp(1 / Math.max(0.35, (1 + dot) / 2 + 0.35), 0.72, 2.6);
    }
    out.push({ x: path[i].x + nx * dist * scale, z: path[i].z + nz * dist * scale, nx, nz, scale, w: path[i].w });
  }
  return out;
}

function ribbonInto(out, path, width, y, opts) {
  if (!path || path.length < 2) return;
  const o = opts || {};
  const left = [], right = [], cum = [0];
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
    let dx = next.x - prev.x, dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const nx = -dz, nz = dx;
    let scale = 1;
    if (i > 0 && i < path.length - 1) {
      const pdx = path[i].x - prev.x, pdz = path[i].z - prev.z;
      const ndx = next.x - path[i].x, ndz = next.z - path[i].z;
      const pl = Math.hypot(pdx, pdz) || 1, nl = Math.hypot(ndx, ndz) || 1;
      const dot = (pdx / pl) * (ndx / nl) + (pdz / pl) * (ndz / nl);
      scale = clamp(1 / Math.max(0.3, (1 + dot) / 2 + 0.3), 0.7, 2.4);
    }
    const hw = width / 2;
    left.push({ x: path[i].x + nx * hw * scale, z: path[i].z + nz * hw * scale });
    right.push({ x: path[i].x - nx * hw * scale, z: path[i].z - nz * hw * scale });
  }
  let run = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const segLen = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
    run += segLen;
    const u0 = (run - segLen) / (o.uvScale || 7), u1 = run / (o.uvScale || 7);
    const v1 = (o.uvV !== undefined ? o.uvV : width / (o.uvScale || 7));
    const a = left[i], b = right[i], c = right[i + 1], d = left[i + 1];
    const ya = y + (path[i].y || 0), yc = i + 1 < path.length ? y + (path[i + 1].y || 0) : y;
    /* tri 1 */
    out.pos.push(a.x, ya, a.z, b.x, ya, b.z, c.x, yc, c.z);
    out.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    out.uv.push(u0, 0, u0, v1, u1, v1);
    /* tri 2 */
    out.pos.push(a.x, ya, a.z, c.x, yc, c.z, d.x, yc, d.z);
    out.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    out.uv.push(u0, 0, u1, v1, u1, 0);
  }
}

function newBatch() { return { pos: [], nor: [], uv: [] }; }
function batchToGeometry(b) {
  if (!b.pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
  if (b.uv.length === b.pos.length / 3 * 2) g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
  g.computeBoundingSphere();
  return g;
}

/* ---------- building walls with real UVs ---------- */
function pushWall(out, ax, az, bx, bz, h, uStart, uvScale, baseY) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.4) return 0;
  let nx = -dz / len, nz = dx / len;
  const y0 = baseY || 0;
  const u0 = uStart / uvScale, u1 = (uStart + len) / uvScale, v1 = (h + y0) / (uvScale * 0.94);
  out.pos.push(
    ax, y0, az, bx, y0, bz, bx, y0 + h, bz,
    ax, y0, az, bx, y0 + h, bz, ax, y0 + h, az
  );
  out.nor.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
  out.uv.push(u0, 0, u1, 0, u1, v1, u0, 0, u1, v1, u0, v1);
  return len;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

function pushRoof(out, ring, y, uvScale) {
  const contour = ring.map((p) => new THREE.Vector2(p.x, p.z));
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { return; }
  for (const t of tris) {
    let a = ring[t[0]], b = ring[t[1]], c = ring[t[2]];
    if (!a || !b || !c) continue;
    /* garante winding anti-horário visto de cima (senão a laje é iluminada por baixo) */
    const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    if (cross > 0) { const tmp = b; b = c; c = tmp; }
    out.pos.push(a.x, y, a.z, b.x, y, b.z, c.x, y, c.z);
    out.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    out.uv.push(a.x / (uvScale || 8), a.z / (uvScale || 8), b.x / (uvScale || 8), b.z / (uvScale || 8), c.x / (uvScale || 8), c.z / (uvScale || 8));
  }
}

/* ---------- materials ---------- */
let FACADE_TEX = null;
function getFacadeTextures() {
  if (!FACADE_TEX) FACADE_TEX = makeFacadeTextures();
  return FACADE_TEX;
}

function makeBuildingMaterials() {
  const f = getFacadeTextures();
  CITY.wallMats = f.map((entry, i) => {
    const m = new THREE.MeshStandardMaterial({
      map: entry.map,
      emissiveMap: entry.emissive,
      emissive: new THREE.Color(0xffe0a8),
      emissiveIntensity: 0.05,
      roughness: i === 2 ? 0.42 : 0.86,
      metalness: i === 2 ? 0.35 : 0.03,
      side: THREE.DoubleSide
    });
    WORLD.windowMats.push(m);
    return m;
  });
  CITY.roofMat = new THREE.MeshStandardMaterial({ map: TEXCACHE.roof, color: 0x9d9e98, roughness: 0.96, side: THREE.DoubleSide });
  CITY.sidewalkMat = new THREE.MeshStandardMaterial({ map: TEXCACHE.sidewalk, color: 0xa8aaa4, roughness: 0.95, side: THREE.DoubleSide });
  WORLD.asphaltMats = [];
}

function asphaltMaterial(type) {
  const key = type || "residential";
  if (CITY.roadMats[key]) return CITY.roadMats[key];
  const m = new THREE.MeshStandardMaterial({
    map: TEXCACHE.asphalt,
    color: ROAD_COLOR[key] || 0x3a3f43,
    roughness: state.settings.weather === "rain" ? 0.4 : 0.9,
    metalness: state.settings.weather === "rain" ? 0.25 : 0.03,
    side: THREE.DoubleSide
  });
  m.map.repeat.set(1, 1);
  CITY.roadMats[key] = m;
  WORLD.asphaltMats.push(m);
  return m;
}

/* ---------- clear ---------- */

/* ------------------------------------------------------------
   spawn seguro: nunca nascer dentro de um prédio
   ------------------------------------------------------------ */
function nearestRoadPoint(x, z) {
  const paths = state.roadPaths || [];
  let best = null, bestD = Infinity, bestI = 0, bestPath = null;
  for (let k = 0; k < paths.length; k++) {
    const path = paths[k];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const dx = p.x - x, dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; bestI = i; bestPath = path; }
    }
  }
  if (!best) return null;
  const a = bestPath[Math.max(0, bestI - 1)], b = bestPath[Math.min(bestPath.length - 1, bestI + 1)];
  const yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
  return { x: best.x, z: best.z, yaw, dist: Math.sqrt(bestD) };
}

function pickSpawnPoint() {
  const zones = state.landmarkZones || [];
  const paths = state.roadPaths || [];
  let best = null, bestScore = -Infinity;
  for (let k = 0; k < paths.length; k += 1) {
    const path = paths[k];
    for (let i = 0; i < path.length; i += Math.max(1, Math.floor(path.length / 8))) {
      const p = path[i];
      const d0 = Math.hypot(p.x, p.z);
      if (d0 < 70 || d0 > 320) continue;
      let clear = Infinity;
      for (const z of zones) clear = Math.min(clear, Math.hypot(p.x - z.x, p.z - z.z) - (z.r || 40));
      if (blockersNear(state.blockers, p.x, p.z, 2.8).length) continue;
      const score = Math.min(clear, 90) - Math.abs(d0 - 140) * 0.25;
      if (score > bestScore) {
        const a2 = path[Math.max(0, i - 1)], b2 = path[Math.min(path.length - 1, i + 1)];
        const yaw = Math.atan2(-(b2.x - a2.x), -(b2.z - a2.z));
        bestScore = score;
        best = { x: p.x, z: p.z, yaw };
      }
    }
  }
  return best;
}

function ensureClearSpawn(force) {
  if (!state.blockers) return false;
  const blocked = blockersNear(state.blockers, state.x, state.z, 2.6).length > 0;
  const here = nearestRoadPoint(state.x, state.z);
  /* longe do asfalto (praça, dentro de prédio, meio do mato) também conta como spawn inválido */
  const offRoad = !here || here.dist > 7;
  if (!force && !blocked && !offRoad) return false;
  const rp = (force || offRoad ? pickSpawnPoint() : null) || nearestRoadPoint(state.x, state.z);
  if (!rp) return false;
  if (!force && !offRoad && rp.dist > 900) return false;
  state.x = rp.x;
  state.z = rp.z;
  if (force && Number.isFinite(rp.yaw)) state.yaw = rp.yaw;
  state.vx = 0; state.vz = 0; state.speed = 0;
  if (typeof PLAYER !== "undefined" && PLAYER && PLAYER.model) {
    PLAYER.model.root.position.set(state.x, 0, state.z);
    PLAYER.model.root.rotation.y = state.yaw;
  }
  return true;
}

function clearCity() {
  if (!cityRoot) return;
  const dispose = (obj) => {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isSprite && o.material) o.material.dispose();
    });
  };
  while (cityRoot.children.length) {
    const c = cityRoot.children.pop();
    dispose(c);
    cityRoot.remove(c);
  }
  while (propRoot.children.length) {
    const c = propRoot.children.pop();
    dispose(c);
    propRoot.remove(c);
  }
  state.landmarks = [];
  state.hostLabels = [];
  CITY.visible = false;
  CITY.roadMats = {};
  WORLD.windowMats = [];
}

/* ---------- main build ---------- */
function buildCityFromOSM(elements, district) {
  clearCity();
  makeBuildingMaterials();
  const origin = state.origin;
  const wallBatches = [newBatch(), newBatch(), newBatch(), newBatch()];
  const roofBatch = newBatch();
  const roadBatches = {};
  const markBatch = newBatch();
  const walkBatch = newBatch();
  const parks = [];
  const waters = [];
  const roads = [];
  const buildings = [];
  const blockers = [];
  const ways = [];
  const seen = new Set();

  for (const el of elements || []) {
    if (!el.geometry || el.geometry.length < 2 || !el.tags) continue;
    const t = el.tags;
    if (t.highway) ways.push({ kind: "road", tags: t, pts: el.geometry });
    else if (t.building || t["building:part"]) ways.push({ kind: "building", tags: t, pts: el.geometry });
    else if (t.leisure === "park" || t.leisure === "garden" || t.leisure === "playground" ||
      t.landuse === "grass" || t.landuse === "forest" || t.landuse === "cemetery" ||
      t.leisure === "pitch" || t.landuse === "recreation_ground" || t.natural === "wood") ways.push({ kind: "park", tags: t, pts: el.geometry });
    else if (t.natural === "water" || t.waterway === "riverbank" || t.landuse === "reservoir") ways.push({ kind: "water", tags: t, pts: el.geometry });
  }

  /* ----- roads ----- */
  const intersections = new Map();
  const addIntersection = (key, x, z, wayId, width) => {
    let rec = intersections.get(key);
    if (!rec) { rec = { x, z, ways: new Set(), width: 0 }; intersections.set(key, rec); }
    rec.ways.add(wayId);
    rec.width = Math.max(rec.width, width);
  };

  let roadCount = 0;
  for (const w of ways) {
    if (w.kind !== "road") continue;
    const type = w.tags.highway;
    if (!ROAD_DRIVABLE[type] && type !== "pedestrian" && type !== "footway" && type !== "cycleway") continue;
    const path = [];
    for (const g of w.pts) {
      const p = geoToWorld(g.lat, g.lon, origin);
      if (path.length && dist2(path[path.length - 1].x, path[path.length - 1].z, p.x, p.z) < 0.6) continue;
      path.push(p);
    }
    if (path.length < 2) continue;
    const width = ROAD_WIDTH[type] || 7;
    /* clip to radius-ish so the map edge stays tidy */
    const d0 = Math.hypot(path[0].x, path[0].z);
    if (d0 > district.radius * 1.9) continue;
    const rec = { pts: path, width, type, name: w.tags.name || "", oneway: w.tags.oneway === "yes" || w.tags.oneway === "1" ? 1 : 0 };
    roads.push(rec);
    if (ROAD_DRIVABLE[type]) roadCount++;
    const batch = roadBatches[type] || (roadBatches[type] = newBatch());
    ribbonInto(batch, path, width, 0.04, { uvScale: 6 });
    /* sidewalks */
    if (width >= 6.5 && ROAD_DRIVABLE[type]) {
      const off = width / 2 + 1.75;
      ribbonInto(walkBatch, offsetPathPoints(path, off), 3.4, 0.15, { uvScale: 3.4 });
      ribbonInto(walkBatch, offsetPathPoints(path, -off), 3.4, 0.15, { uvScale: 3.4 });
    }
    /* centre line for wide roads */
    if (width >= 10 && ROAD_DRIVABLE[type]) {
      ribbonInto(markBatch, path, 0.16, 0.062, { uvScale: 1, uvV: 1 });
      if (width >= 15) {
        ribbonInto(markBatch, offsetPathPoints(path, 0.42), 0.12, 0.062, { uvScale: 1, uvV: 1 });
        ribbonInto(markBatch, offsetPathPoints(path, -0.42), 0.12, 0.062, { uvScale: 1, uvV: 1 });
      }
    }
    /* intersection detection */
    for (const p of path) addIntersection(Math.round(p.x * 4) + ":" + Math.round(p.z * 4), p.x, p.z, w.tags.highway + w.pts[0].lat, width);
  }

  /* ----- zebra crossings at busy intersections ----- */
  let zebra = 0;
  for (const rec of intersections.values()) {
    if (zebra > 130) break;
    if (rec.ways.size < 3 || rec.width < 9) continue;
    for (const r of roads) {
      if (r.width < 8) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const t = ((rec.x - a.x) * dx + (rec.z - a.z) * dz) / (len * len);
        if (t < 0 || t > 1) continue;
        const px = a.x + dx * t, pz = a.z + dz * t;
        if (Math.hypot(px - rec.x, pz - rec.z) > 1.2) continue;
        const ux = dx / len, uz = dz / len;
        const nx = -uz, nz = ux;
        const start = 6.5;
        for (const side of [-1, 1]) {
          for (let k = 0; k < 6; k++) {
            const along = side * (start + k * 1.2);
            const cx = rec.x + ux * along, cz = rec.z + uz * along;
            const half = r.width * 0.36;
            const q = [
              cx + nx * half - ux * 0.28, cz + nz * half - uz * 0.28,
              cx - nx * half - ux * 0.28, cz - nz * half - uz * 0.28,
              cx - nx * half + ux * 0.28, cz - nz * half + uz * 0.28,
              cx + nx * half + ux * 0.28, cz + nz * half + uz * 0.28
            ];
            markBatch.pos.push(q[0], 0.066, q[1], q[2], 0.066, q[3], q[4], 0.066, q[5]);
            markBatch.pos.push(q[0], 0.066, q[1], q[4], 0.066, q[5], q[6], 0.066, q[7]);
            for (let n = 0; n < 6; n++) markBatch.nor.push(0, 1, 0);
            markBatch.uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
          }
        }
        zebra++;
        break;
      }
      if (zebra > 130) break;
    }
  }

  /* ----- parks & water ----- */
  for (const w of ways) {
    if (w.kind !== "park" && w.kind !== "water") continue;
    const ring = [];
    for (const g of w.pts) {
      const p = geoToWorld(g.lat, g.lon, origin);
      if (ring.length && dist2(ring[ring.length - 1].x, ring[ring.length - 1].z, p.x, p.z) < 0.5) continue;
      ring.push(p);
    }
    if (ring.length < 4) continue;
    if (dist2(ring[0].x, ring[0].z, ring[ring.length - 1].x, ring[ring.length - 1].z) < 1.5) ring.pop();
    const area = Math.abs(ringArea(ring));
    if (area < 60) continue;
    (w.kind === "park" ? parks : waters).push(ring);
  }

  /* ----- buildings ----- */
  const excl = state.landmarkZones || [];
  let buildingCount = 0;
  for (const w of ways) {
    if (w.kind !== "building") continue;
    if (buildingCount > 4200) break;
    const ring = [];
    for (const g of w.pts) {
      const p = geoToWorld(g.lat, g.lon, origin);
      if (ring.length && dist2(ring[ring.length - 1].x, ring[ring.length - 1].z, p.x, p.z) < 0.4) continue;
      ring.push(p);
    }
    if (ring.length > 2 && dist2(ring[0].x, ring[0].z, ring[ring.length - 1].x, ring[ring.length - 1].z) < 1) ring.pop();
    if (ring.length < 4 || ring.length > 120) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of ring) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const bw = maxX - minX, bd = maxZ - minZ;
    const area = Math.abs(ringArea(ring));
    if (area < 18 || bw > 320 || bd > 320) continue;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    let skip = false;
    for (const z of excl) {
      if (dist2(cx, cz, z.x, z.z) < z.r) { skip = true; break; }
    }
    if (skip) continue;

    const tags = w.tags;
    let h = parseFloat(tags.height);
    if (!Number.isFinite(h)) {
      const lv = parseInt(tags["building:levels"], 10);
      const base = Number.isFinite(lv) ? lv * 3.15 : 0;
      const dc = Math.hypot(cx, cz);
      const downtown = clamp(1 - dc / (district.radius * 1.15), 0, 1);
      h = base || (5 + Math.pow(downtown, 1.6) * rnd(6, 58) + rnd(0, 9));
    }
    h = clamp(h, 3.2, 190);
    if (tags["building:part"] === "roof") h = Math.max(2.5, h * 0.4);

    let style = 0;
    const type = tags.building;
    if (h > 42) style = 2;
    else if (type === "commercial" || type === "retail" || type === "office" || type === "hotel") style = 3;
    else if (type === "apartments" || type === "residential") style = Math.random() > 0.45 ? 0 : 1;
    else if (type === "house" || type === "detached") style = Math.random() > 0.5 ? 1 : 3;
    else style = Math.floor(rnd(0, 4));
    if (h > 90) h = 90 + (h - 90) * 0.55;

    /* keep walls CCW for nicer normals (materials are double sided anyway) */
    if (ringArea(ring) < 0) ring.reverse();
    const batch = wallBatches[style];
    let u = 0;
    const uvScale = h > 40 ? 3.6 : 3.2;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      u += pushWall(batch, a.x, a.z, b.x, b.z, h, u, uvScale, 0);
    }
    pushRoof(roofBatch, ring, h, 7);
    /* a subtle base plinth */
    if (h < 30 && Math.random() > 0.6) {
      const ringB = ring.map((p) => ({ x: p.x + (p.x - cx) * 0.02, z: p.z + (p.z - cz) * 0.02 }));
      for (let i = 0; i < ringB.length; i++) {
        const a = ringB[i], b = ringB[(i + 1) % ringB.length];
        pushWall(wallBatches[1], a.x, a.z, b.x, b.z, 2.4 + rnd(0, 1.2), u, 3.2, 0);
      }
    }
    blockers.push({ minX, maxX, minZ, maxZ, h: h, cx: cx, cz: cz });
    buildings.push({ ring, minX, maxX, minZ, maxZ, h: h, cx: cx, cz: cz, style });
    buildingCount++;
  }

  /* ----- meshes ----- */
  const root = cityRoot;
  for (let i = 0; i < wallBatches.length; i++) {
    const g = batchToGeometry(wallBatches[i]);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, CITY.wallMats[i]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
  }
  const roofG = batchToGeometry(roofBatch);
  if (roofG) {
    const roofMesh = new THREE.Mesh(roofG, CITY.roofMat);
    roofMesh.castShadow = true; roofMesh.receiveShadow = true;
    root.add(roofMesh);
  }
  /* todas as faixas de asfalto são planos horizontais: normal para cima garante luz do sol */
  /* UV plana em coordenadas de mundo: sem isso o piso inteiro amostra um único texel (preto) */
  const planarUV = (g, scale) => {
    if (!g || !g.attributes.position) return g;
    const p = g.attributes.position;
    const arr = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      arr[i * 2] = p.getX(i) / scale;
      arr[i * 2 + 1] = p.getZ(i) / scale;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(arr, 2));
    return g;
  };
  const normalsUp = (g) => {
    if (!g || !g.attributes.normal) return g;
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    n.needsUpdate = true;
    return g;
  };
  for (const type in roadBatches) {
    const g = planarUV(normalsUp(batchToGeometry(roadBatches[type])), 9);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, asphaltMaterial(type));
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  const walkG = planarUV(normalsUp(batchToGeometry(walkBatch)), 7);
  if (walkG) {
    const wm = new THREE.Mesh(walkG, CITY.sidewalkMat);
    wm.receiveShadow = true;
    root.add(wm);
  }
  const markG = planarUV(normalsUp(batchToGeometry(markBatch)), 9);
  if (markG) {
    const mm = new THREE.Mesh(markG, new THREE.MeshStandardMaterial({
      color: 0xe8e6d6, roughness: 0.8, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }));
    root.add(mm);
  }

  /* ----- green & blue areas ----- */
  const parkMat = new THREE.MeshStandardMaterial({ map: TEXCACHE.grass, color: 0xa8bfa0, roughness: 1 });
  const waterMat = new THREE.MeshStandardMaterial({ map: TEXCACHE.water, color: 0x8fb3bd, roughness: 0.18, metalness: 0.55, transparent: true, opacity: 0.94 });
  for (const ring of parks) {
    const g = new THREE.BufferGeometry();
    const pos = [], nor = [], uv = [];
    const contour = ring.map((p) => new THREE.Vector2(p.x, p.z));
    let tris = [];
    try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
    for (const t of tris) {
      const a = ring[t[0]], b = ring[t[1]], c = ring[t[2]];
      if (!a || !b || !c) continue;
      pos.push(a.x, 0.07, a.z, b.x, 0.07, b.z, c.x, 0.07, c.z);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      uv.push(a.x / 14, a.z / 14, b.x / 14, b.z / 14, c.x / 14, c.z / 14);
    }
    if (!pos.length) continue;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, parkMat);
    m.receiveShadow = true;
    root.add(m);
  }
  for (const ring of waters) {
    const g = new THREE.BufferGeometry();
    const pos = [], nor = [], uv = [];
    const contour = ring.map((p) => new THREE.Vector2(p.x, p.z));
    let tris = [];
    try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
    for (const t of tris) {
      const a = ring[t[0]], b = ring[t[1]], c = ring[t[2]];
      if (!a || !b || !c) continue;
      pos.push(a.x, 0.05, a.z, b.x, 0.05, b.z, c.x, 0.05, c.z);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      uv.push(a.x / 30, a.z / 30, b.x / 30, b.z / 30, c.x / 30, c.z / 30);
    }
    if (!pos.length) continue;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, waterMat);
    m.receiveShadow = true;
    root.add(m);
  }

  /* ----- publish state ----- */
  state.roads = roads;
  state.roadPaths = roads.filter((r) => ROAD_DRIVABLE[r.type]).map((r) => r.pts.map((p) => ({ x: p.x, z: p.z, w: r.width })));
  ensureClearSpawn(false);
  state.buildings = buildings;
  state.parks = parks;
  state.waters = waters;
  state.stats.roads = roadCount;
  state.stats.buildings = buildingCount;
  state.blockers = buildBlockers(blockers, 26);
  state.roadGrid = buildRoadGrid(state.roadPaths);
  state.landmarkZones = excl;
  CITY.visible = true;

  buildProps();
  buildTrafficLights(intersections);
  buildTraffic(state.settings.traffic);
  buildDistantSkyline();
  buildLandmarks(district);
  placePlayer(roads);
  /* só agora os blockers existem: garante spawn em asfalto livre, fora de praças e marcos */
  ensureClearSpawn(true);
  if (typeof buildNavGraph === "function") buildNavGraph();
  if (typeof renderMapBase === "function") renderMapBase();
  return { roads: roadCount, buildings: buildingCount };
}

/* ---------- props: trees, lamps, parked cars ---------- */
function buildProps() {
  const root = propRoot;
  const treeCount = WORLD.quality === "low" ? 350 : 1400;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.6, 6);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkMat = MAT(0x4a3c2c, { roughness: 1 });
  const crownMats = [
    MAT(0x375c34, { roughness: 1, flatShading: true }),
    MAT(0x476b39, { roughness: 1, flatShading: true }),
    MAT(0x2f5333, { roughness: 1, flatShading: true })
  ];
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crowns = crownMats.map((m) => new THREE.InstancedMesh(crownGeo, m, treeCount));
  const counts = [0, 0, 0];
  let n = 0;
  const dummy = new THREE.Object3D();
  const tryTree = (x, z, scale) => {
    if (n >= treeCount) return;
    if (blockersNear(state.blockers, x, z, 4).length) return;
    dummy.position.set(x, 1.3 * scale, z);
    dummy.scale.set(scale * 0.9, scale, scale * 0.9);
    dummy.rotation.y = rnd(TAU);
    dummy.updateMatrix();
    trunks.setMatrixAt(n, dummy.matrix);
    const ci = n % 3;
    dummy.position.set(x, 3.3 * scale + rnd(-0.3, 0.5), z);
    const s = rnd(1.9, 3.4) * scale;
    dummy.scale.set(s, s * rnd(0.8, 1.15), s);
    dummy.updateMatrix();
    crowns[ci].setMatrixAt(counts[ci]++, dummy.matrix);
    n++;
  };
  for (const road of state.roads) {
    if (n >= treeCount) break;
    if (!ROAD_DRIVABLE[road.type]) continue;
    const step = road.width > 12 ? 3 : 2;
    for (let i = 1; i < road.pts.length - 1; i += step) {
      if (n >= treeCount) break;
      if (Math.random() > 0.42) continue;
      const a = road.pts[i - 1], b = road.pts[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const side = Math.random() > 0.5 ? 1 : -1;
      const off = road.width / 2 + 3.6 + rnd(0, 1.6);
      tryTree(road.pts[i].x + nx * off * side, road.pts[i].z + nz * off * side, rnd(0.8, 1.35));
    }
  }
  /* park trees */
  for (const ring of state.parks) {
    if (n >= treeCount) break;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of ring) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const tries = clamp(Math.floor(((maxX - minX) * (maxZ - minZ)) / 260), 4, 90);
    for (let i = 0; i < tries && n < treeCount; i++) {
      const x = rnd(minX, maxX), z = rnd(minZ, maxZ);
      if (!pointInRing(x, z, ring)) continue;
      tryTree(x, z, rnd(1.0, 1.7));
    }
  }
  trunks.count = n;
  trunks.instanceMatrix.needsUpdate = true;
  root.add(trunks);
  crowns.forEach((c, i) => {
    c.count = counts[i];
    c.instanceMatrix.needsUpdate = true;
    c.castShadow = WORLD.quality !== "low";
    root.add(c);
  });
  CITY.treeCount = n;

  /* street lamps */
  const lampPositions = [];
  for (const road of state.roads) {
    if (!ROAD_DRIVABLE[road.type] || road.width < 8) continue;
    let acc = 0;
    for (let i = 1; i < road.pts.length - 1; i++) {
      const a = road.pts[i - 1], b = road.pts[i];
      acc += dist2(a.x, a.z, b.x, b.z);
      if (acc < 42) continue;
      acc = 0;
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const side = lampPositions.length % 2 ? 1 : -1;
      const off = road.width / 2 + 1.2;
      lampPositions.push({ x: b.x + nx * off * side, z: b.z + nz * off * side, r: Math.atan2(dx, dz) });
      if (lampPositions.length > 460) break;
    }
    if (lampPositions.length > 460) break;
  }
  if (lampPositions.length) {
    const poleGeo = new THREE.CylinderGeometry(0.075, 0.11, 6.4, 6);
    const armGeo = new THREE.BoxGeometry(0.08, 0.08, 1.5);
    const headGeo = new THREE.BoxGeometry(0.42, 0.16, 0.7);
    const poleMat = MAT(0x3a4245, { roughness: 0.55, metalness: 0.5 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x2a3134, emissive: 0xffd9a0, emissiveIntensity: 0.4, roughness: 0.5 });
    WORLD.lampBulbMat = headMat;
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
    const arms = new THREE.InstancedMesh(armGeo, poleMat, lampPositions.length);
    const heads = new THREE.InstancedMesh(headGeo, headMat, lampPositions.length);
    lampPositions.forEach((p, i) => {
      dummy.position.set(p.x, 3.2, p.z); dummy.rotation.set(0, p.r, 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 6.24, p.z); dummy.rotation.set(0, p.r, 0);
      dummy.updateMatrix(); arms.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x + Math.sin(p.r + Math.PI / 2) * 0.6, 6.16, p.z + Math.cos(p.r + Math.PI / 2) * 0.6);
      dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    poles.castShadow = false;
    root.add(poles); root.add(arms); root.add(heads);

    /* glow sprites via Points */
    const gpos = new Float32Array(lampPositions.length * 3);
    lampPositions.forEach((p, i) => { gpos[i * 3] = p.x; gpos[i * 3 + 1] = 6.1; gpos[i * 3 + 2] = p.z; });
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.BufferAttribute(gpos, 3));
    const glowMat = new THREE.PointsMaterial({
      map: TEXCACHE.glow, color: 0xffd9a0, size: 3.6, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Points(gg, glowMat);
    root.add(glow);
    WORLD.lampGlow = glow;
    CITY.lampCount = lampPositions.length;
  }

  /* parked cars */
  const parked = [];
  for (const road of state.roads) {
    if (!ROAD_DRIVABLE[road.type] || road.width < 8) continue;
    if (Math.random() > 0.55) continue;
    for (let i = 1; i < road.pts.length - 1; i += 2) {
      if (Math.random() > 0.16) continue;
      const a = road.pts[i - 1], b = road.pts[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const side = Math.random() > 0.5 ? 1 : -1;
      const off = road.width / 2 - 1.4;
      const x = road.pts[i].x + nx * off * side, z = road.pts[i].z + nz * off * side;
      if (blockersNear(state.blockers, x, z, 3).length) continue;
      parked.push({ x, z, r: Math.atan2(dx, dz) });
      if (parked.length > 110) break;
    }
    if (parked.length > 110) break;
  }
  if (parked.length) {
    const geo = simpleCarGeometry();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.2, vertexColors: false });
    const inst = new THREE.InstancedMesh(geo, mat, parked.length);
    const colors = [0x2b2f33, 0x8d9394, 0xb9b9b2, 0x5c6a70, 0x7a3a34, 0x2f4653, 0x9a9782, 0x3f5a4a];
    const col = new THREE.Color();
    parked.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, p.r, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      col.setHex(colors[i % colors.length]);
      if (inst.setColorAt) inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = false;
    inst.receiveShadow = true;
    root.add(inst);
  }
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, zi = ring[i].z, xj = ring[j].x, zj = ring[j].z;
    const intersect = (zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/* ---------- spawn ---------- */
function placePlayer(roads) {
  const drivable = roads.filter((r) => ROAD_DRIVABLE[r.type]);
  if (!drivable.length) { state.x = 0; state.z = 0; return; }
  let best = null, bestD = Infinity;
  const saved = state.savedPos;
  for (const road of drivable) {
    for (let i = 0; i < road.pts.length - 1; i++) {
      const a = road.pts[i], b = road.pts[i + 1];
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const target = saved || { x: 0, z: 0 };
      const d = dist2(mx, mz, target.x, target.z);
      if (d < bestD) {
        bestD = d;
        const dx = b.x - a.x, dz = b.z - a.z;
        best = { x: mx, z: mz, yaw: Math.atan2(-dx, -dz) };
      }
    }
  }
  if (best) {
    state.x = best.x; state.z = best.z;
    state.yaw = Number.isFinite(state.savedYaw) ? state.savedYaw : best.yaw;
  }
  state.savedPos = null;
}

/* ---------- fallback procedural city ---------- */
function buildFallbackCity(district) {
  clearCity();
  makeBuildingMaterials();
  const roadBatches = {};
  const main = newBatch();
  const walkBatch = newBatch();
  const markBatch = newBatch();
  const wallBatches = [newBatch(), newBatch(), newBatch(), newBatch()];
  const roofBatch = newBatch();
  const roads = [], buildings = [], blockers = [], parks = [];
  const spacing = 92;
  const extent = 9;

  /* avenues (subdivididas em pontos para tráfego e navegação) */
  const linePath = (ax, az, bx, bz) => {
    const pts = [];
    const n = Math.max(2, Math.round(dist2(ax, az, bx, bz) / 28));
    for (let k = 0; k <= n; k++) pts.push({ x: lerp(ax, bx, k / n), z: lerp(az, bz, k / n) });
    return pts;
  };
  for (let i = -extent; i <= extent; i++) {
    const v = i * spacing;
    const vertical = linePath(v, -extent * spacing, v, extent * spacing);
    const horizontal = linePath(-extent * spacing, v, extent * spacing, v);
    const wide = i % 3 === 0;
    const width = wide ? 17 : 9;
    for (const path of [vertical, horizontal]) {
      roads.push({ pts: path, width, type: wide ? "primary" : "residential", name: wide ? "Avenida" : "Rua", oneway: 0 });
      const b = roadBatches[wide ? "primary" : "residential"] || (roadBatches[wide ? "primary" : "residential"] = newBatch());
      ribbonInto(b, path, width, 0.04, { uvScale: 6 });
      ribbonInto(walkBatch, offsetPathPoints(path, width / 2 + 1.75), 3.4, 0.15, { uvScale: 3.4 });
      ribbonInto(walkBatch, offsetPathPoints(path, -(width / 2 + 1.75)), 3.4, 0.15, { uvScale: 3.4 });
      if (wide) ribbonInto(markBatch, path, 0.16, 0.062, { uvScale: 1, uvV: 1 });
    }
  }
  /* blocks */
  for (let i = -extent; i < extent; i++) {
    for (let j = -extent; j < extent; j++) {
      const bx = i * spacing + spacing / 2, bz = j * spacing + spacing / 2;
      if (Math.hypot(bx, bz) > extent * spacing * 0.98) continue;
      const dcenter = Math.hypot(bx, bz);
      const tall = clamp(1 - dcenter / (extent * spacing), 0, 1);
      const n = rndInt(2, 4);
      for (let k = 0; k < n; k++) {
        const w = rnd(14, 34), d = rnd(14, 34);
        const x = bx + rnd(-spacing * 0.34, spacing * 0.34);
        const z = bz + rnd(-spacing * 0.34, spacing * 0.34);
        if (Math.abs(x) < 9 || Math.abs(z) < 9) continue;
        const h = clamp(6 + Math.pow(tall, 1.5) * rnd(4, 70) + rnd(0, 10), 6, 110);
        const style = h > 45 ? 2 : Math.floor(rnd(0, 4));
        const ring = [
          { x: x - w / 2, z: z - d / 2 }, { x: x + w / 2, z: z - d / 2 },
          { x: x + w / 2, z: z + d / 2 }, { x: x - w / 2, z: z + d / 2 }
        ];
        let u = 0;
        for (let q = 0; q < 4; q++) u += pushWall(wallBatches[style], ring[q].x, ring[q].z, ring[(q + 1) % 4].x, ring[(q + 1) % 4].z, h, u, 3.2, 0);
        pushRoof(roofBatch, ring, h, 7);
        blockers.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: h, cx: x, cz: z });
        buildings.push({ ring, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: h, cx: x, cz: z, style });
      }
    }
  }
  /* a park */
  const parkRing = [
    { x: -spacing * 2.2, z: spacing * 1.4 }, { x: -spacing * 0.6, z: spacing * 1.4 },
    { x: -spacing * 0.6, z: spacing * 2.6 }, { x: -spacing * 2.2, z: spacing * 2.6 }
  ];
  parks.push(parkRing);

  for (let i = 0; i < wallBatches.length; i++) {
    const g = batchToGeometry(wallBatches[i]);
    if (!g) continue;
    const m = new THREE.Mesh(g, CITY.wallMats[i]);
    m.castShadow = true; m.receiveShadow = true;
    cityRoot.add(m);
  }
  const roofG = batchToGeometry(roofBatch);
  if (roofG) {
    const rm = new THREE.Mesh(roofG, CITY.roofMat);
    rm.castShadow = true; rm.receiveShadow = true;
    cityRoot.add(rm);
  }
  for (const type in roadBatches) {
    const g = batchToGeometry(roadBatches[type]);
    if (!g) continue;
    const m = new THREE.Mesh(g, asphaltMaterial(type));
    m.receiveShadow = true;
    cityRoot.add(m);
  }
  const wg = batchToGeometry(walkBatch);
  if (wg) { const m = new THREE.Mesh(wg, CITY.sidewalkMat); m.receiveShadow = true; cityRoot.add(m); }
  const mg = batchToGeometry(markBatch);
  if (mg) cityRoot.add(new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ color: 0xe8e6d6, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide })));

  /* park ground */
  {
    const pos = [], nor = [], uv = [];
    for (let i = 1; i < parkRing.length - 1; i++) {
      const a = parkRing[0], b = parkRing[i], c = parkRing[i + 1];
      pos.push(a.x, 0.08, a.z, b.x, 0.08, b.z, c.x, 0.08, c.z);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      uv.push(a.x / 14, a.z / 14, b.x / 14, b.z / 14, c.x / 14, c.z / 14);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: TEXCACHE.grass, color: 0x9fb896, roughness: 1 }));
    m.receiveShadow = true;
    cityRoot.add(m);
  }

  state.roads = roads;
  state.roadPaths = roads.map((r) => r.pts.map((p) => ({ x: p.x, z: p.z, w: r.width })));
  state.buildings = buildings;
  state.parks = parks;
  state.waters = [];
  state.stats = { roads: roads.length, buildings: buildings.length };
  state.blockers = buildBlockers(blockers, 26);
  state.roadGrid = buildRoadGrid(state.roadPaths);
  state.osmOnline = false;
  CITY.visible = true;

  buildProps();
  buildTraffic(state.settings.traffic);
  buildDistantSkyline();
  buildLandmarks(district, true);
  placePlayer(roads);
  /* só agora os blockers existem: garante spawn em asfalto livre, fora de praças e marcos */
  ensureClearSpawn(true);
  if (typeof buildNavGraph === "function") buildNavGraph();
  if (typeof renderMapBase === "function") renderMapBase();
  return { roads: roads.length, buildings: buildings.length };
}
