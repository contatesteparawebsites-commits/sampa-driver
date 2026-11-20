/* ============================================================
   SAMPA DRIVER · 06 · marcos, tráfego, horizonte, carregamento OSM
   ============================================================ */

/* ---------- floating labels ---------- */
function labelSprite(text, sub, color) {
  const w = 512, h = 128;
  const c = cv(w, h), x = c.getContext("2d");
  x.clearRect(0, 0, w, h);
  x.fillStyle = "rgba(8,14,19,.72)";
  roundRect(x, 6, 18, w - 12, 92, 18);
  x.fill();
  x.strokeStyle = color || "rgba(211,251,104,.55)";
  x.lineWidth = 3;
  roundRect(x, 6, 18, w - 12, 92, 18);
  x.stroke();
  x.fillStyle = "#f2f7f2";
  x.font = "700 40px Manrope, Arial";
  x.textAlign = "left";
  x.fillText(text.length > 26 ? text.slice(0, 25) + "…" : text, 30, 62);
  if (sub) {
    x.fillStyle = color || "#d3fb68";
    x.font = "500 22px 'DM Mono', monospace";
    x.fillText(sub, 30, 92);
  }
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: true, opacity: 0.95 }));
  m.scale.set(30, 7.5, 1);
  return m;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- landmark builders ---------- */
function lmMaterial(color, opts) { return MAT(color, opts); }

function buildMASP(group, x, z, rot) {
  const red = new THREE.MeshStandardMaterial({ color: 0xa8342c, roughness: 0.62, metalness: 0.06 });
  const conc = MAT(0xd6d3c8, { roughness: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8fb3bd, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.42 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(84, 0.7, 34), conc);
  plaza.position.y = 0.34; plaza.receiveShadow = true; g.add(plaza);
  /* four red columns */
  for (const cx of [-27, 27]) {
    for (const cz of [-9, 9]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(3.4, 26, 3.4), red);
      col.position.set(cx, 13.4, cz); col.castShadow = true; g.add(col);
    }
  }
  /* two beams */
  for (const cz of [-9, 9]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(62, 3.4, 5.2), red);
    beam.position.set(0, 27.4, cz); beam.castShadow = true; g.add(beam);
  }
  /* suspended block */
  const block = new THREE.Mesh(new THREE.BoxGeometry(64, 12, 19), conc);
  block.position.set(0, 19.4, 0); block.castShadow = true; g.add(block);
  const glassBox = new THREE.Mesh(new THREE.BoxGeometry(63, 8, 18.4), glass);
  glassBox.position.set(0, 19.4, 0); g.add(glassBox);
  /* red side stairs */
  for (const s of [-1, 1]) {
    const stair = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 20), red);
    stair.position.set(s * 30, 1.9, 0); stair.castShadow = true; g.add(stair);
  }
  /* entrance canopy */
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(40, 0.6, 12), red);
  canopy.position.set(0, 6.2, 17); g.add(canopy);
  for (const s of [-18, 0, 18]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 8), MAT(0x8e8f88));
    p.position.set(s, 3.1, 22); g.add(p);
  }
  group.add(g);
  return { x, z, r: 46 };
}

function buildCatedral(group, x, z, rot) {
  const stone = MAT(0xd8d3c2, { roughness: 0.9 });
  const dark = MAT(0x5c5445, { roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const nave = new THREE.Mesh(new THREE.BoxGeometry(30, 26, 56), stone);
  nave.position.set(0, 13, 6); nave.castShadow = true; nave.receiveShadow = true; g.add(nave);
  for (const s of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 50, 12), stone);
    tower.position.set(s * 17, 25, -22); tower.castShadow = true; g.add(tower);
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 0.6), MAT(0x2b3a42, { roughness: 0.5, metalness: 0.2 }));
      w.position.set(s * 17, 34, -27.9); g.add(w);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(8.4, 9, 4), dark);
    cap.position.set(s * 17, 54, -22); cap.rotation.y = Math.PI / 4; g.add(cap);
  }
  /* dome */
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 8, 16), stone);
  drum.position.set(0, 29, 6); g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 12, 0, TAU, 0, Math.PI / 2), MAT(0x8a9a93, { roughness: 0.6, metalness: 0.35 }));
  dome.position.set(0, 33, 6); dome.castShadow = true; g.add(dome);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 7, 10), stone);
  lantern.position.set(0, 45, 6); g.add(lantern);
  /* facade windows */
  for (const s of [-1, 1]) {
    const rose = new THREE.Mesh(new THREE.CircleGeometry(3.2, 18), new THREE.MeshStandardMaterial({ color: 0x2f4550, emissive: 0x66a0b0, emissiveIntensity: 0.3 }));
    rose.position.set(s * 17, 30, -28.1); g.add(rose);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(7, 10, 0.8), dark);
  door.position.set(0, 5, -22.4); g.add(door);
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 12, 8), stone);
    col.position.set(i * 4.4, 6, -23.4); g.add(col);
  }
  group.add(g);
  return { x, z, r: 40 };
}

function buildCopan(group, x, z, rot) {
  const mat = new THREE.MeshStandardMaterial({
    map: getFacadeTextures()[3].map, emissiveMap: getFacadeTextures()[3].emissive,
    emissive: new THREE.Color(0xffe0a8), emissiveIntensity: 0.05, roughness: 0.85, color: 0xd9d5c8
  });
  WORLD.windowMats.push(mat);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const offset = Math.sin(t * Math.PI * 1.7) * 11;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(13, 108, 24), mat);
    slab.position.set(-42 + i * 14, 54, offset);
    slab.rotation.y = Math.cos(t * Math.PI * 1.7) * 0.22;
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(112, 12, 30), MAT(0xc9c5b8, { roughness: 0.9 }));
  base.position.set(0, 6, 0); base.castShadow = true; g.add(base);
  group.add(g);
  return { x, z, r: 62 };
}

function buildOca(group, x, z, rot) {
  const white = MAT(0xe4e2d8, { roughness: 0.8 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(19, 24, 14, 0, TAU, 0, Math.PI / 2), white);
  dome.position.y = 0.4; dome.scale.set(1, 0.92, 1.15); dome.castShadow = true; dome.receiveShadow = true;
  g.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(19, 0.5, 6, 30), MAT(0xb9b8b0));
  ring.rotation.x = Math.PI / 2; ring.position.y = 1.4; g.add(ring);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 5), MAT(0xc9c7bd));
  ramp.position.set(0, 1.2, 22); ramp.rotation.x = 0.07; g.add(ramp);
  g.rotation.y = rot;
  group.add(g);
  return { x, z, r: 30 };
}

function buildObelisco(group, x, z, rot) {
  const white = MAT(0xe6e3d6, { roughness: 0.85 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 9), MAT(0xc9c6b8));
  base.position.y = 1.2; g.add(base);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.9, 24, 4), white);
  shaft.position.y = 14; shaft.rotation.y = Math.PI / 4; shaft.castShadow = true; g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.4, 4), white);
  tip.position.y = 27.2; tip.rotation.y = Math.PI / 4; g.add(tip);
  group.add(g);
  return { x, z, r: 12 };
}

function buildTheatre(group, x, z, rot) {
  const stone = MAT(0xcbb9a0, { roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const body = new THREE.Mesh(new THREE.BoxGeometry(46, 26, 34), stone);
  body.position.y = 13; body.castShadow = true; g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 10, 0, TAU, 0, Math.PI / 2), MAT(0x6a8a7c, { roughness: 0.5, metalness: 0.5 }));
  dome.position.y = 28; g.add(dome);
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 12, 10), MAT(0xe0d6c6));
    col.position.set(i * 7, 6, -17.4); g.add(col);
  }
  const stair = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 8), MAT(0xb9aa96));
  stair.position.set(0, 1.6, -21); g.add(stair);
  group.add(g);
  return { x, z, r: 34 };
}

function buildTower(group, x, z, h, color) {
  const mat = new THREE.MeshStandardMaterial({
    map: getFacadeTextures()[2].map, emissiveMap: getFacadeTextures()[2].emissive,
    emissive: new THREE.Color(0xcfe8ff), emissiveIntensity: 0.05, roughness: 0.4, metalness: 0.4, color: color || 0xa9bdc4
  });
  WORLD.windowMats.push(mat);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(24, h, 20), mat);
  tower.position.y = h / 2; tower.castShadow = true; tower.receiveShadow = true; g.add(tower);
  const top = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 14), MAT(0x8d9a9d, { roughness: 0.6, metalness: 0.4 }));
  top.position.y = h + 3; g.add(top);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 22, 6), MAT(0xb0b8b8, { metalness: 0.8, roughness: 0.4 }));
  antenna.position.y = h + 17; g.add(antenna);
  group.add(g);
  return { x, z, r: 20 };
}

function buildLandmarks(district, fallback) {
  const group = new THREE.Group();
  group.name = "landmarks";
  cityRoot.add(group);
  const zones = [];
  const pois = district.pois;
  for (const poi of pois) {
    let p = geoToWorld(poi.lat, poi.lon, state.origin);
    if (fallback && Math.hypot(p.x, p.z) > 700) {
      p = { x: Math.cos(pois.indexOf(poi) * 1.1) * 130, z: Math.sin(pois.indexOf(poi) * 1.1) * 130 };
    }
    const name = poi.name;
    let zone = null;
    if (poi.icon === "museum" || /MASP/i.test(name)) zone = buildMASP(group, p.x, p.z, district.seedHeading);
    else if (poi.icon === "catedral" || /Catedral/i.test(name)) zone = buildCatedral(group, p.x, p.z, district.seedHeading + 0.4);
    else if (poi.icon === "copan" || /Copan/i.test(name)) zone = buildCopan(group, p.x, p.z, district.seedHeading + 1.2);
    else if (poi.icon === "oca" || /Oca/i.test(name)) zone = buildOca(group, p.x, p.z, district.seedHeading);
    else if (/Obelisco/i.test(name)) zone = buildObelisco(group, p.x, p.z, 0);
    else if (/Theatro Municipal/i.test(name)) zone = buildTheatre(group, p.x, p.z, district.seedHeading);
    else if (/Farol Santander/i.test(name)) zone = buildTower(group, p.x, p.z, 128, 0xb9c8cc);
    else if (/Edifício Itália|Conjunto Nacional/i.test(name)) zone = buildTower(group, p.x, p.z, 96, 0xb2bfc2);
    if (zone) zones.push(zone);

    /* label floating above the point */
    const label = labelSprite(name.split("·")[0].trim(), zone ? "MARCO · SÃO PAULO" : "PONTO DE INTERESSE");
    label.position.set(p.x, zone ? 40 : 16, p.z);
    group.add(label);
    state.hostLabels.push({ sprite: label, x: p.x, z: p.z, base: zone ? 40 : 16 });
    state.landmarks.push({ name, x: p.x, z: p.z, poi: poi, zone: zone });
  }

  /* a couple of decorative towers for skyline density around the district */
  const extra = fallback ? 3 : 4;
  for (let i = 0; i < extra; i++) {
    const a = rnd(TAU), r = rnd(300, 620);
    const ex = Math.cos(a) * r, ez = Math.sin(a) * r;
    if (blockersNear(state.blockers, ex, ez, 26).length) continue;
    buildTower(group, ex, ez, rnd(55, 110), 0xa9b8bd);
  }

  state.landmarkZones = zones;
  return zones;
}

/* ---------- distant skyline ---------- */
function buildDistantSkyline() {
  if (!cityRoot) return;
  const old = cityRoot.getObjectByName("skyline");
  if (old) {
    old.geometry.dispose();
    cityRoot.remove(old);
  }
  const count = WORLD.quality === "low" ? 180 : 460;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x5b6a72, roughness: 0.9, metalness: 0.05, fog: true });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = rnd(TAU);
    const r = rnd(1250, 2900);
    const h = rnd(20, 150) * (r > 2200 ? 1.15 : 1);
    dummy.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    dummy.rotation.set(0, rnd(TAU), 0);
    dummy.scale.set(rnd(22, 60), h, rnd(22, 60));
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    col.setHex(mixHex(0x5b6a72, 0x8fa2a8, rnd(0.2, 0.75)));
    if (inst.setColorAt) inst.setColorAt(i, col);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.name = "skyline";
  inst.castShadow = false;
  inst.receiveShadow = false;
  cityRoot.add(inst);
}

/* ---------- traffic lights ---------- */
let trafficLights = null;
function buildTrafficLights(intersections) {
  if (trafficLights) {
    if (trafficLights.poles) { trafficLights.poles.geometry.dispose(); propRoot.remove(trafficLights.poles); }
    if (trafficLights.bulbs) { trafficLights.bulbs.geometry.dispose(); propRoot.remove(trafficLights.bulbs); }
    trafficLights = null;
  }
  if (!intersections) return;
  const spots = [];
  for (const rec of intersections.values()) {
    if (rec.ways.size < 3 || rec.width < 10) continue;
    spots.push(rec);
    if (spots.length >= 34) break;
  }
  if (!spots.length) return;
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.13, 4.6, 6);
  const poleMat = MAT(0x2b3235, { roughness: 0.6, metalness: 0.4 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
  const bulbGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, spots.length * 3);
  const dummy = new THREE.Object3D();
  const colors = [];
  spots.forEach((s, i) => {
    const x = s.x + s.width * 0.34, z = s.z + 1;
    dummy.position.set(x, 2.3, z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 3; k++) {
      const idx = i * 3 + k;
      dummy.position.set(x, 4.0 - k * 0.42, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bulbs.setMatrixAt(idx, dummy.matrix);
      colors.push(new THREE.Color(0x1c1c1c));
    }
  });
  poles.instanceMatrix.needsUpdate = true;
  bulbs.instanceMatrix.needsUpdate = true;
  colors.forEach((c, i) => bulbs.setColorAt(i, c));
  if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
  propRoot.add(poles);
  propRoot.add(bulbs);
  trafficLights = { poles, bulbs, colors, count: spots.length, timer: 0, phase: 0 };
}
function updateTrafficLights(dt) {
  if (!trafficLights) return;
  trafficLights.timer += dt;
  const cycle = 12;
  if (trafficLights.timer > cycle) {
    trafficLights.timer = 0;
    trafficLights.phase = (trafficLights.phase + 1) % 2;
  }
  const t = trafficLights.timer;
  const state_ = (t < 6 ? 1 : 0) | (t >= 7 ? 2 : 0) | (t >= 6 && t < 7 ? 4 : 0);
  const key = trafficLights.phase * 8 + state_;
  if (key === trafficLights.colorKey) return;
  trafficLights.colorKey = key;
  const bulbs = trafficLights.bulbs;
  if (!bulbs.instanceColor) return;
  const red = state_ & 1, green = state_ & 2, amber = state_ & 4;
  const cRed = _tlcRed, cGreen = _tlcGreen, cAmber = _tlcAmber, cOff = _tlcOff;
  cRed.setHex(0xff3b2f); cGreen.setHex(0x22c55e); cAmber.setHex(0xffb020); cOff.setHex(0x141a16);
  const darkRed = _tlcDark;
  for (let i = 0; i < trafficLights.count; i++) {
    const p = trafficLights.phase;
    bulbs.setColorAt(i * 3 + 0, p === 0 ? (red ? cRed : darkRed) : (green ? cGreen : cOff));
    bulbs.setColorAt(i * 3 + 1, amber ? cAmber : cOff);
    bulbs.setColorAt(i * 3 + 2, p === 0 ? (green ? cGreen : cOff) : (red ? cRed : darkRed));
  }
  bulbs.instanceColor.needsUpdate = true;
}

/* ---------- moving traffic ---------- */
let TRAFFIC = { bodies: null, wheels: null, list: [], colors: null };
const _trafficDummy = new THREE.Object3D();
const _tlcRed = new THREE.Color(), _tlcGreen = new THREE.Color(), _tlcAmber = new THREE.Color(),
  _tlcOff = new THREE.Color(), _tlcDark = new THREE.Color(0x2a1614);
function buildTraffic(level) {
  if (TRAFFIC.bodies) {
    propRoot.remove(TRAFFIC.bodies);
    if (TRAFFIC.bodies.geometry) TRAFFIC.bodies.geometry.dispose();
    if (TRAFFIC.bodies.material) TRAFFIC.bodies.material.dispose();
    TRAFFIC.bodies = null;
  }
  TRAFFIC.list = [];
  const count = level === "high" ? 110 : level === "low" ? 30 : 62;
  const paths = state.roadPaths.filter((p) => p.length > 3 && p.length < 220);
  if (!paths.length) return;
  const geo = simpleCarGeometry();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.25 });
  const bodies = new THREE.InstancedMesh(geo, bodyMat, count);
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bodies.castShadow = false;
  bodies.receiveShadow = false;
  const palette = [0x24282b, 0x8e9494, 0xb8b7ae, 0x50595e, 0x6e3730, 0x2d4552, 0x9c8f6f, 0x3a5344, 0x7d8a90, 0xd8d5c9];
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const path = paths[(Math.random() * paths.length) | 0];
    const idx = Math.min(path.length - 2, rndInt(0, path.length - 2));
    TRAFFIC.list.push({
      path, idx, t: rnd(0, 1), speed: rnd(4.5, 11.5),
      dir: Math.random() > 0.5 ? 1 : -1
    });
    col.setHex(palette[i % palette.length]);
    if (bodies.setColorAt) bodies.setColorAt(i, col);
  }
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  propRoot.add(bodies);
  TRAFFIC.bodies = bodies;
  TRAFFIC.colors = palette;
  updateTraffic(0.016);
}
function updateTraffic(dt) {
  if (!TRAFFIC.bodies) return;
  const dummy = _trafficDummy;
  const list = TRAFFIC.list;
  for (let i = 0; i < list.length; i++) {
    const car = list[i];
    const path = car.path;
    if (!path || path.length < 2) continue;
    let a = path[car.idx], b = path[car.idx + 1];
    if (!a || !b) continue;
    if (car.dir < 0) { const sw = a; a = b; b = sw; }
    const dx = b.x - a.x, dz = b.z - a.z;
    const segLen = Math.max(2, Math.hypot(dx, dz));
    car.t += (dt * car.speed) / segLen;
    if (car.t >= 1) {
      car.t -= 1;
      car.idx += car.dir;
      if (car.idx < 0) car.idx = path.length - 2;
      if (car.idx > path.length - 2) car.idx = 0;
      car.t = clamp(car.t, 0, 0.98);
    }
    dummy.position.set(a.x + dx * car.t, 0, a.z + dz * car.t);
    dummy.rotation.set(0, Math.atan2(-dx, -dz), 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    TRAFFIC.bodies.setMatrixAt(i, dummy.matrix);
  }
  TRAFFIC.bodies.instanceMatrix.needsUpdate = true;
}
/* ---------- OSM ---------- */
const OSM_CACHE = {};

function districtLandmarkZones(d) {
  const zones = [];
  for (const poi of d.pois) {
    const p = geoToWorld(poi.lat, poi.lon, { lat: d.lat, lon: d.lon });
    if (poi.icon === "museum" || /MASP/i.test(poi.name)) zones.push({ x: p.x, z: p.z, r: 52 });
    else if (poi.icon === "catedral" || /Catedral/i.test(poi.name)) zones.push({ x: p.x, z: p.z, r: 40 });
    else if (poi.icon === "copan" || /Copan/i.test(poi.name)) zones.push({ x: p.x, z: p.z, r: 62 });
    else if (poi.icon === "oca" || /Oca/i.test(poi.name)) zones.push({ x: p.x, z: p.z, r: 34 });
  }
  return zones;
}

function overpassQuery(lat, lon, rRoad, rBuild) {
  const around = (r) => "(around:" + Math.round(r) + "," + lat + "," + lon + ")";
  return [
    "[out:json][timeout:50];",
    "(",
    'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian)$"]' + around(rRoad) + ";",
    'way["building"]' + around(rBuild) + ";",
    'way["leisure"~"^(park|garden|playground|pitch)$"]' + around(rBuild) + ";",
    'way["landuse"~"^(grass|forest|cemetery|recreation_ground|reservoir)$"]' + around(rBuild) + ";",
    'way["natural"~"^(water|wood)$"]' + around(rBuild) + ";",
    ");",
    "out geom;"
  ].join("");
}

const OVERPASS_HOSTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter"
];

async function fetchOSM(d, attempt) {
  const key = d.id + ":" + attempt;
  if (OSM_CACHE[key]) return OSM_CACHE[key];
  const scale = attempt === 0 ? 1 : attempt === 1 ? 0.72 : 0.5;
  const rRoad = d.radius * scale * 1.18;
  const rBuild = d.radius * scale * 0.86;
  const query = overpassQuery(d.lat, d.lon, rRoad, rBuild);
  const host = OVERPASS_HOSTS[Math.min(attempt, OVERPASS_HOSTS.length - 1)];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(host, {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("HTTP " + res.status + " em " + host);
    const data = await res.json();
    if (!data.elements || data.elements.length < 40) throw new Error("dados insuficientes");
    OSM_CACHE[key] = data;
    return data;
  } catch (err) {
    clearTimeout(timer);
    console.warn("[OSM]", err.message || err);
    return null;
  }
}

/* Builds a district: instant procedural fallback + real OSM data when available. */
async function loadCity(districtId, opts) {
  const o = opts || {};
  const d = DISTRICTS[districtId] || DISTRICTS.paulista;
  state.district = d.id;
  state.settings.district = d.id;
  state.origin = districtOrigin(d);
  state.landmarkZones = districtLandmarkZones(d);
  state.osmReady = false;
  state.osmOnline = false;

  const loader = $("#map-loader");
  const loaderText = $("#map-loader-text");
  if (loader && o.showLoader) {
    loader.classList.add("show");
    if (loaderText) loaderText.textContent = "Buscando ruas reais no OpenStreetMap…";
  }
  setNetBadge("loading");

  if (o.instantFallback) buildFallbackCity(d);

  let data = null;
  const attempts = o.fast ? 1 : 3;
  for (let attempt = 0; attempt < attempts && !data; attempt++) {
    if (loaderText && attempt > 0) loaderText.textContent = "Tentando outro servidor do OpenStreetMap…";
    data = await fetchOSM(d, attempt);
  }

  let built = false;
  if (data && data.elements) {
    try {
      if (state.playing) state.savedPos = { x: state.x, z: state.z };
      buildCityFromOSM(data.elements, d);
      state.osmOnline = true;
      state.osmReady = true;
      built = true;
    } catch (err) {
      console.warn("[cidade] falha ao montar OSM:", err);
      if (!o.instantFallback || !CITY.visible) buildFallbackCity(d);
    }
  }
  if (!built) {
    if (o.instantFallback) {
      /* fallback already on screen (built by boot) */
      state.osmReady = true;
    } else {
      buildFallbackCity(d);
      state.osmReady = true;
    }
  }

  if (loader) loader.classList.remove("show");
  setNetBadge(state.osmOnline ? "ok" : "bad");
  updateCityUI();
  if (typeof renderMapBase === "function") renderMapBase();
  if (typeof refreshDestinations === "function") refreshDestinations();
  return { ok: built, district: d.id };
}

function setNetBadge(mode) {
  const el = $("#topbar-net");
  if (el) {
    el.className = "chip chip-net" + (mode === "ok" ? " ok" : mode === "bad" ? " bad" : "");
    const txt = el.querySelector("span");
    if (txt) txt.textContent = mode === "ok" ? "OSM · ONLINE" : mode === "bad" ? "OSM · OFFLINE" : "OSM · CONECTANDO";
  }
  const boot = $("#boot-net");
  if (boot) {
    boot.className = mode === "ok" ? "ok" : mode === "bad" ? "bad" : "";
    boot.textContent = mode === "ok" ? "REDE · OSM ONLINE" : mode === "bad" ? "REDE · MODO LOCAL" : "REDE · CONECTANDO";
  }
}

function updateCityUI() {
  const d = DISTRICTS[state.district];
  const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  set("#stat-roads", state.stats.roads ? state.stats.roads.toLocaleString("pt-BR") : "—");
  set("#stat-buildings", state.stats.buildings ? state.stats.buildings.toLocaleString("pt-BR") : "—");
  set("#stat-district", d.short);
  set("#topbar-district", d.name.toUpperCase() + " · SÃO PAULO, BR");
  set("#hud-district", d.short.toUpperCase());
  set("#home-region", d.short);
  set("#pause-district", d.short);
  const seg = $("#district-seg");
  if (seg) {
    $$("button", seg).forEach((b) => b.classList.toggle("active", b.dataset.district === d.id));
  }
}

