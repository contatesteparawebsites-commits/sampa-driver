/* ============================================================
   SAMPA DRIVER · 03 · veículos 3D (Fusca, Uno escada, Jipe)
   ============================================================ */

/* side profile → extruded car body. points are [z, y] with front at -z */
function extrudeProfile(points, width, bevel) {
  const shape = new THREE.Shape();
  points.forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
  shape.closePath();
  /* o bevel cresce para os dois lados, então o depth recebe só o miolo */
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.3, width - bevel * 2), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 3, steps: 1, curveSegments: 4
  });
  geo.rotateY(-Math.PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.computeVertexNormals();
  return geo;
}

function plateTexture(text) {
  const c = cv(256, 80), x = c.getContext("2d");
  x.fillStyle = "#eef1ec"; x.fillRect(0, 0, 256, 80);
  x.fillStyle = "#17559b"; x.fillRect(0, 0, 34, 80);
  x.fillStyle = "#eef1ec"; x.font = "bold 20px monospace"; x.save();
  x.translate(17, 44); x.rotate(-Math.PI / 2); x.fillText("SP", 0, 0); x.restore();
  x.strokeStyle = "#1a2530"; x.lineWidth = 3; x.strokeRect(36, 4, 216, 72);
  x.fillStyle = "#131c24"; x.font = "bold 40px monospace"; x.textAlign = "center";
  x.fillText(text, 146, 54);
  return tex(c);
}

function tireTexture(dark) {
  const c = cv(128, 128), x = c.getContext("2d");
  x.fillStyle = dark ? "#101314" : "#141718";
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = "#0a0c0d";
  for (let i = 0; i < 128; i += 16) {
    x.fillRect(i, 0, 9, 128);
    x.fillStyle = "#181d1e";
    x.fillRect(i + 3, 0, 3, 128);
    x.fillStyle = "#0a0c0d";
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

let TIRE_TEX = null, TIRE_TEX_OFF = null;

function makeWheel(radius, width, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  if (!TIRE_TEX) { TIRE_TEX = tireTexture(false); TIRE_TEX_OFF = tireTexture(true); }
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1c2021, roughness: 0.95, metalness: 0.02,
    map: o.offroad ? TIRE_TEX_OFF : TIRE_TEX, bumpMap: o.offroad ? TIRE_TEX_OFF : TIRE_TEX, bumpScale: 0.06
  });
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 22, 1), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  spin.add(tire);
  const rimMat = o.rimMat || new THREE.MeshPhysicalMaterial({ color: 0xb9c3c4, roughness: 0.26, metalness: 0.92, clearcoat: 0.5 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.01, 18), rimMat);
  rim.rotation.z = Math.PI / 2;
  spin.add(rim);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.32, width * 1.06, 14), rimMat);
  cap.rotation.z = Math.PI / 2;
  spin.add(cap);
  if (o.whitewall) {
    const ww = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.74, radius * 0.13, 6, 20),
      new THREE.MeshStandardMaterial({ color: 0xe8e6d8, roughness: 0.9 }));
    ww.rotation.y = Math.PI / 2;
    ww.position.x = width * 0.49;
    spin.add(ww);
    const ww2 = ww.clone(); ww2.position.x = -width * 0.49; spin.add(ww2);
  }
  if (o.offroad) {
    const bead = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, 0.035, 5, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2f30, roughness: 0.9 }));
    bead.rotation.y = Math.PI / 2; bead.position.x = width * 0.42; spin.add(bead);
  }
  g.userData.spin = spin;
  g.userData.radius = radius;
  return g;
}

function addMesh(parent, geo, mat, pos, rot, scale) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function basicMat(color, emissive, intensity) {
  return new THREE.MeshStandardMaterial({
    color: emissive || 0x111111,
    emissive: emissive || 0x000000,
    emissiveIntensity: intensity || 0,
    roughness: 0.45
  });
}

/* soft blob shadow texture shared by every vehicle */
let BLOB_TEX = null;
function blobShadow(size) {
  if (!BLOB_TEX) BLOB_TEX = softCircleTexture(128, "rgba(0,0,0,0.72)", 0.55);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.5, size * 2.7),
    new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, depthWrite: false, opacity: 0.55 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.075;
  m.renderOrder = 2;
  return m;
}

/* ------------------------------------------------------------
   FUSCA
   ------------------------------------------------------------ */
function buildFusca() {
  const spec = CARS.fusca;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = PHYS(spec.color, { roughness: 0.42, metalness: 0.4, clearcoat: 0.75, clearcoatRoughness: 0.16 });
  const paintDark = PHYS(mixHex(spec.color, 0x000000, 0.25), { roughness: 0.35, metalness: 0.5 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xd6dcda, roughness: 0.16, metalness: 1, clearcoat: 1 });
  const dark = MAT(0x14191b, { roughness: 0.75 });
  const rubber = MAT(0x14181a, { roughness: 0.98 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8fb6c4, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55, clearcoat: 1 });
  const glassDark = glass.clone(); glassDark.opacity = 0.45; glassDark.color.setHex(0x6d94a2);
  const headMat = basicMat(0xfff4d6, 0xffe9b8, 0.25);
  const tailMat = basicMat(0x8c1f1a, 0xd0231b, 0.15);
  const amberMat = basicMat(0x8a4a12, 0xff8a1f, 0.15);

  /* lower body silhouette */
  const bodyGeo = extrudeProfile([
    [-1.98, 0.30], [-2.02, 0.52], [-1.94, 0.70], [-1.62, 0.86], [-1.20, 0.94],
    [-0.86, 1.02], [-0.72, 1.14], [0.60, 1.16], [0.86, 1.06], [1.34, 0.98],
    [1.72, 0.88], [1.94, 0.70], [2.00, 0.50], [1.96, 0.30], [1.60, 0.24], [-1.60, 0.24]
  ], 1.34, 0.15);
  addMesh(body, bodyGeo, paint, [0, 0, 0]);

  /* teto levemente abaulado (sem bolha) */
  const roof = addMesh(body, new THREE.SphereGeometry(1, 26, 14), paint, [0, 1.06, -0.04], null, [0.655, 0.3, 1.0]);
  roof.renderOrder = 0;

  /* windshield + rear glass */
  addMesh(body, new THREE.PlaneGeometry(0.86, 0.3), glass, [0, 1.19, -0.54], [-0.72, 0, 0]);
  addMesh(body, new THREE.PlaneGeometry(0.74, 0.26), glassDark, [0, 1.19, 0.54], [0.66, 0, 0]);
  addMesh(body, new THREE.PlaneGeometry(0.78, 0.28), glass, [-0.652, 1.2, -0.2], [0, Math.PI / 2, 0]);
  addMesh(body, new THREE.PlaneGeometry(0.78, 0.28), glass, [0.652, 1.2, -0.2], [0, -Math.PI / 2, 0]);
  addMesh(body, new THREE.PlaneGeometry(0.6, 0.26), glassDark, [-0.648, 1.18, 0.42], [0, Math.PI / 2, 0]);
  addMesh(body, new THREE.PlaneGeometry(0.6, 0.26), glassDark, [0.648, 1.18, 0.42], [0, -Math.PI / 2, 0]);

  /* fenders (arches over each wheel) */
  const fenderGeo = new THREE.TorusGeometry(0.46, 0.115, 8, 18, Math.PI);
  for (const z of [-1.2, 1.2]) {
    for (const x of [-0.8, 0.8]) {
      const f = addMesh(body, fenderGeo, paintDark, [x, 0.52, z], [0, Math.PI / 2, 0]);
      f.scale.set(1, 1, 0.82);
    }
  }
  /* running boards */
  addMesh(body, new THREE.BoxGeometry(0.17, 0.055, 1.72), chrome, [-0.79, 0.40, 0]);
  addMesh(body, new THREE.BoxGeometry(0.17, 0.055, 1.72), chrome, [0.79, 0.40, 0]);

  /* bumpers */
  const bumperGeo = new THREE.BoxGeometry(1.44, 0.1, 0.16);
  for (const z of [-2.02, 2.0]) {
    addMesh(body, bumperGeo, chrome, [0, 0.56, z]);
    addMesh(body, new THREE.BoxGeometry(0.12, 0.1, 0.12), chrome, [-0.7, 0.56, z]);
    addMesh(body, new THREE.BoxGeometry(0.12, 0.1, 0.12), chrome, [0.7, 0.56, z]);
  }
  /* over-riders */
  for (const x of [-0.34, 0.34]) addMesh(body, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), chrome, [x, 0.7, -2.06], [Math.PI / 2, 0, 0]);

  /* headlights */
  const headGeo = new THREE.SphereGeometry(0.15, 16, 12);
  for (const x of [-0.5, 0.5]) {
    const lens = addMesh(body, headGeo, headMat, [x, 0.9, -1.79], null, [1, 1, 0.55]);
    lens.userData.headlight = true;
    addMesh(body, new THREE.TorusGeometry(0.155, 0.028, 6, 18), chrome, [x, 0.9, -1.85]);
    /* chrome eyebrow */
    addMesh(body, new THREE.TorusGeometry(0.2, 0.025, 5, 16, Math.PI), chrome, [x, 0.93, -1.8], [0, 0, Math.PI]);
  }
  /* tail lights */
  for (const x of [-0.56, 0.56]) {
    const t = addMesh(body, new THREE.SphereGeometry(0.075, 12, 10), tailMat, [x, 0.86, 1.86], null, [1, 1.15, 0.6]);
    t.userData.tail = true;
    addMesh(body, new THREE.TorusGeometry(0.078, 0.016, 5, 14), chrome, [x, 0.86, 1.88]);
  }
  for (const x of [-0.5, 0.5]) addMesh(body, new THREE.BoxGeometry(0.1, 0.05, 0.04), amberMat, [x, 0.66, -2.05]);

  /* hood + engine vents */
  addMesh(body, new THREE.BoxGeometry(0.94, 0.02, 0.9), paintDark, [0, 0.98, -1.32]);
  for (let i = 0; i < 5; i++) addMesh(body, new THREE.BoxGeometry(0.72, 0.022, 0.035), dark, [0, 1.0, 1.14 + i * 0.075]);
  addMesh(body, new THREE.BoxGeometry(0.34, 0.02, 0.22), dark, [0, 0.99, 1.62]);

  /* mirrors, handles, wipers */
  for (const x of [-0.86, 0.86]) {
    addMesh(body, new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6), chrome, [x, 1.16, -0.62], [0, 0, Math.PI / 2]);
    addMesh(body, new THREE.SphereGeometry(0.055, 10, 8), chrome, [x * 1.14, 1.2, -0.62], null, [0.6, 1, 1.2]);
  }
  for (const x of [-0.7, 0.7]) addMesh(body, new THREE.BoxGeometry(0.02, 0.03, 0.11), chrome, [x, 0.98, -0.05]);
  addMesh(body, new THREE.BoxGeometry(0.5, 0.012, 0.02), dark, [-0.3, 1.13, -0.72], [0.3, 0, 0]);
  addMesh(body, new THREE.BoxGeometry(0.5, 0.012, 0.02), dark, [0.3, 1.13, -0.72], [0.3, 0, 0]);

  /* plates */
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture("BES-1974"), roughness: 0.6 });
  addMesh(body, new THREE.PlaneGeometry(0.4, 0.13), plateMat, [-0.52, 0.78, -2.08]);
  addMesh(body, new THREE.PlaneGeometry(0.4, 0.13), plateMat, [-0.52, 0.78, 2.06], [0, Math.PI, 0]);

  /* underbody */
  addMesh(body, new THREE.BoxGeometry(1.2, 0.12, 3.2), dark, [0, 0.24, 0]);

  /* wheels */
  const wheels = [];
  for (const z of [-1.2, 1.2]) {
    for (const x of [-0.72, 0.72]) {
      const steer = z < 0;
      const holder = new THREE.Group();
      holder.position.set(x * 1.03, 0.44, z);
      const w = makeWheel(0.36, 0.24, { whitewall: true });
      holder.add(w);
      body.add(holder);
      wheels.push({ holder, wheel: w, front: steer, radius: 0.36 });
    }
  }

  /* interior */
  const interior = new THREE.Group();
  interior.visible = false;
  const seatMat = MAT(0x2b2118, { roughness: 0.95 });
  addMesh(interior, new THREE.BoxGeometry(0.42, 0.16, 0.42), seatMat, [-0.34, 0.72, 0.16]);
  addMesh(interior, new THREE.BoxGeometry(0.42, 0.5, 0.14), seatMat, [-0.34, 0.92, 0.4], [-0.12, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(0.42, 0.14, 0.4), seatMat, [0.34, 0.72, 0.16]);
  addMesh(interior, new THREE.BoxGeometry(0.42, 0.46, 0.13), seatMat, [0.34, 0.9, 0.4], [-0.1, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(1.0, 0.14, 0.34), MAT(0x1d2731, { roughness: 0.6 }), [0, 0.96, -0.62]);
  const sw = new THREE.Group();
  sw.position.set(-0.34, 1.0, -0.44);
  sw.rotation.x = -0.32;
  addMesh(sw, new THREE.TorusGeometry(0.16, 0.026, 6, 20), MAT(0x101314, { roughness: 0.6 }));
  addMesh(sw, new THREE.BoxGeometry(0.3, 0.02, 0.03), MAT(0x101314, { roughness: 0.6 }));
  addMesh(sw, new THREE.BoxGeometry(0.03, 0.16, 0.03), MAT(0x101314, { roughness: 0.6 }), [0, 0.0, 0]);
  addMesh(sw, new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), dark, [0, 0, 0.1], [Math.PI / 2, 0, 0]);
  interior.add(sw);
  addMesh(interior, new THREE.BoxGeometry(0.2, 0.02, 0.05), MAT(0x323b3e), [0, 1.24, -0.62]);
  addMesh(interior, new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), dark, [0, 1.3, -0.63], [Math.PI / 2, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(0.26, 0.1, 0.02), MAT(0x0b0f12), [0, 1.2, -0.6], [-0.3, 0, 0]);
  body.add(interior);

  /* lights */
  const lights = [];
  for (const x of [-0.5, 0.5]) {
    const sp = new THREE.SpotLight(0xfff2d0, 0, 95, 0.42, 0.55, 1.1);
    sp.position.set(x, 0.9, -1.9);
    sp.target.position.set(x * 1.6, 0.1, -26);
    body.add(sp); body.add(sp.target);
    lights.push(sp);
  }

  const shadow = blobShadow(1.1);
  root.add(shadow);

  return {
    root, body, wheels, lights, interior, steerWheel: sw, glassParts: [glass, glassDark],
    eye: new THREE.Vector3(-0.34, 1.24, -0.32), seatZ: 0.16,
    mats: { headMat, tailMat, amberMat, paint },
    shadow, isFirst: false
  };
}

/* ------------------------------------------------------------
   UNO COM ESCADA
   ------------------------------------------------------------ */
function buildUno() {
  const spec = CARS.uno;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = PHYS(spec.color, { roughness: 0.36, metalness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.2 });
  const dark = MAT(0x1a1e20, { roughness: 0.78 });
  const plastic = MAT(0x22262a, { roughness: 0.9 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xc3cacb, roughness: 0.24, metalness: 0.95 });
  const alu = new THREE.MeshPhysicalMaterial({ color: 0xb6bfc0, roughness: 0.32, metalness: 0.9, clearcoat: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fc3cc, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.32 });
  const headMat = basicMat(0xfff6e0, 0xffeab4, 0.2);
  const tailMat = basicMat(0x7d1a17, 0xd62a20, 0.12);
  const amberMat = basicMat(0x8a4a12, 0xff9026, 0.14);

  const bodyGeo = extrudeProfile([
    [-1.94, 0.30], [-1.99, 0.52], [-1.94, 0.74], [-1.62, 0.84], [-1.16, 0.88],
    [-0.98, 0.92], [-0.66, 1.24], [-0.5, 1.42], [0.42, 1.44], [0.72, 1.36],
    [0.96, 1.1], [1.2, 0.94], [1.72, 0.9], [1.92, 0.74], [1.98, 0.5], [1.94, 0.3],
    [1.6, 0.22], [-1.6, 0.22]
  ], 1.5, 0.09);
  addMesh(body, bodyGeo, paint, [0, 0, 0]);

  /* greenhouse pillars / roof */
  addMesh(body, new THREE.BoxGeometry(1.44, 0.05, 1.14), paint, [0, 1.42, -0.06]);
  /* windows */
  addMesh(body, new THREE.PlaneGeometry(1.24, 0.5), glass, [0, 1.18, -0.7], [-0.72, 0, 0]);
  addMesh(body, new THREE.PlaneGeometry(1.2, 0.44), glass, [0, 1.2, 0.62], [0.85, 0, 0]);
  for (const x of [-0.735, 0.735]) {
    addMesh(body, new THREE.PlaneGeometry(1.0, 0.36), glass, [x, 1.19, -0.04], [0, Math.PI / 2, 0]);
  }
  /* black trim */
  const archGeo = new THREE.TorusGeometry(0.44, 0.05, 5, 16, Math.PI);
  for (const z of [-1.16, 1.18]) {
    for (const x of [-0.76, 0.76]) addMesh(body, archGeo, plastic, [x, 0.5, z], [0, Math.PI / 2, 0]);
  }
  /* bumpers */
  addMesh(body, new THREE.BoxGeometry(1.66, 0.26, 0.2), plastic, [0, 0.56, -1.88]);
  addMesh(body, new THREE.BoxGeometry(1.66, 0.26, 0.2), plastic, [0, 0.56, 1.88]);
  addMesh(body, new THREE.BoxGeometry(1.6, 0.1, 0.06), dark, [0, 0.38, -1.96]);
  addMesh(body, new THREE.BoxGeometry(1.6, 0.1, 0.06), dark, [0, 0.38, 1.96]);
  /* side strips */
  addMesh(body, new THREE.BoxGeometry(0.02, 0.07, 2.9), dark, [-0.76, 0.72, 0]);
  addMesh(body, new THREE.BoxGeometry(0.02, 0.07, 2.9), dark, [0.76, 0.72, 0]);
  /* headlights */
  for (const x of [-0.5, 0.5]) {
    const h = addMesh(body, new THREE.BoxGeometry(0.44, 0.17, 0.06), headMat, [x, 0.82, -1.93], [0.1, 0, 0]);
    h.userData.headlight = true;
    addMesh(body, new THREE.BoxGeometry(0.46, 0.03, 0.07), plastic, [x, 0.73, -1.94]);
  }
  addMesh(body, new THREE.BoxGeometry(0.9, 0.06, 0.04), dark, [0, 0.9, -1.96]);
  /* tail lights */
  for (const x of [-0.62, 0.62]) {
    const t = addMesh(body, new THREE.BoxGeometry(0.26, 0.32, 0.06), tailMat, [x, 0.82, 1.94]);
    t.userData.tail = true;
    addMesh(body, new THREE.BoxGeometry(0.26, 0.09, 0.07), amberMat, [x, 0.6, 1.94]);
  }
  /* mirrors + handles */
  for (const x of [-0.82, 0.82]) {
    addMesh(body, new THREE.BoxGeometry(0.09, 0.09, 0.05), plastic, [x, 1.06, -0.66]);
    addMesh(body, new THREE.BoxGeometry(0.02, 0.03, 0.13), chrome, [x * 0.93, 0.95, -0.12]);
  }
  /* wipers */
  addMesh(body, new THREE.BoxGeometry(0.44, 0.012, 0.02), dark, [-0.3, 1.06, -0.86], [0.5, 0, 0]);
  addMesh(body, new THREE.BoxGeometry(0.38, 0.012, 0.02), dark, [0.3, 1.06, -0.86], [0.5, 0, 0]);
  /* plate */
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture("ESC-1998"), roughness: 0.6 });
  addMesh(body, new THREE.PlaneGeometry(0.42, 0.13), plateMat, [-0.4, 0.62, -1.99]);
  addMesh(body, new THREE.PlaneGeometry(0.42, 0.13), plateMat, [-0.4, 0.62, 1.99], [0, Math.PI, 0]);

  /* roof rack + ladder */
  const rackY = 1.5;
  for (const x of [-0.55, 0.55]) addMesh(body, new THREE.BoxGeometry(0.05, 0.05, 1.5), alu, [x, rackY, -0.1]);
  for (const z of [-0.62, 0.35]) {
    addMesh(body, new THREE.BoxGeometry(1.14, 0.04, 0.05), alu, [0, rackY, z]);
    addMesh(body, new THREE.BoxGeometry(0.05, 0.1, 0.05), alu, [-0.55, rackY - 0.06, z]);
    addMesh(body, new THREE.BoxGeometry(0.05, 0.1, 0.05), alu, [0.55, rackY - 0.06, z]);
  }
  const ladder = new THREE.Group();
  ladder.position.set(0, rackY + 0.12, 0.24);
  ladder.rotation.x = -0.035;
  const railGeo = new THREE.BoxGeometry(0.05, 0.07, 2.5);
  addMesh(ladder, railGeo, alu, [-0.42, 0, 0]);
  addMesh(ladder, railGeo, alu, [0.42, 0, 0]);
  for (let i = 0; i < 9; i++) {
    const z = -1.14 + i * 0.285;
    addMesh(ladder, new THREE.BoxGeometry(0.88, 0.036, 0.05), alu, [0, 0.012, z]);
    if (i === 0 || i === 8) addMesh(ladder, new THREE.BoxGeometry(0.06, 0.05, 0.05), alu, [0, 0.03, z]);
  }
  /* rubber straps */
  for (const z of [-0.78, 0.72]) {
    addMesh(ladder, new THREE.BoxGeometry(0.98, 0.02, 0.055), MAT(0x0f1214, { roughness: 0.95 }), [0, 0.055, z]);
    addMesh(ladder, new THREE.BoxGeometry(0.06, 0.09, 0.06), chrome, [0.44, -0.02, z]);
  }
  body.add(ladder);

  /* wheels */
  const wheels = [];
  for (const z of [-1.16, 1.18]) {
    for (const x of [-0.74, 0.74]) {
      const steer = z < 0;
      const holder = new THREE.Group();
      holder.position.set(x * 1.02, 0.43, z);
      const w = makeWheel(0.35, 0.22, {});
      holder.add(w);
      body.add(holder);
      wheels.push({ holder, wheel: w, front: steer, radius: 0.35 });
    }
  }

  /* interior */
  const interior = new THREE.Group();
  interior.visible = false;
  const seatMat = MAT(0x2f3336, { roughness: 0.94 });
  addMesh(interior, new THREE.BoxGeometry(0.42, 0.15, 0.42), seatMat, [-0.32, 0.72, 0.1]);
  addMesh(interior, new THREE.BoxGeometry(0.42, 0.56, 0.13), seatMat, [-0.32, 0.96, 0.34], [-0.14, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(0.42, 0.13, 0.4), seatMat, [0.32, 0.72, 0.1]);
  addMesh(interior, new THREE.BoxGeometry(0.42, 0.5, 0.12), seatMat, [0.32, 0.93, 0.34], [-0.12, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(1.08, 0.16, 0.42), MAT(0x1f2529, { roughness: 0.72 }), [0, 0.98, -0.6]);
  const sw = new THREE.Group();
  sw.position.set(-0.32, 1.02, -0.44);
  sw.rotation.x = -0.3;
  addMesh(sw, new THREE.TorusGeometry(0.155, 0.024, 6, 20), MAT(0x14181a, { roughness: 0.6 }));
  addMesh(sw, new THREE.BoxGeometry(0.29, 0.02, 0.03), MAT(0x14181a, { roughness: 0.6 }));
  addMesh(sw, new THREE.BoxGeometry(0.03, 0.15, 0.03), MAT(0x14181a, { roughness: 0.6 }));
  addMesh(sw, new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), dark, [0, 0, 0.1], [Math.PI / 2, 0, 0]);
  interior.add(sw);
  addMesh(interior, new THREE.BoxGeometry(0.2, 0.02, 0.05), MAT(0x323b3e), [0, 1.28, -0.62]);
  addMesh(interior, new THREE.CylinderGeometry(0.011, 0.011, 0.08, 6), dark, [0, 1.33, -0.63], [Math.PI / 2, 0, 0]);
  body.add(interior);

  const lights = [];
  for (const x of [-0.5, 0.5]) {
    const sp = new THREE.SpotLight(0xfff4dc, 0, 95, 0.44, 0.6, 1.1);
    sp.position.set(x, 0.84, -1.95);
    sp.target.position.set(x * 1.5, 0.1, -27);
    body.add(sp); body.add(sp.target);
    lights.push(sp);
  }

  const shadow = blobShadow(1.15);
  root.add(shadow);

  return {
    root, body, wheels, lights, interior, steerWheel: sw, glassParts: [glass],
    eye: new THREE.Vector3(-0.32, 1.24, -0.3), seatZ: 0.1,
    mats: { headMat, tailMat, amberMat, paint },
    shadow
  };
}

/* ------------------------------------------------------------
   JIPE VERDE
   ------------------------------------------------------------ */
function buildJeep() {
  const spec = CARS.jeep;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = PHYS(spec.color, { roughness: 0.44, metalness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.28 });
  const paintDark = PHYS(mixHex(spec.color, 0x000000, 0.34), { roughness: 0.5, metalness: 0.4 });
  const black = MAT(0x121617, { roughness: 0.92 });
  const darkGrey = MAT(0x2a2f31, { roughness: 0.85 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x9aa3a4, roughness: 0.42, metalness: 0.85 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x93b9c3, roughness: 0.08, transparent: true, opacity: 0.3 });
  const headMat = basicMat(0xfff3d2, 0xffe9b0, 0.22);
  const tailMat = basicMat(0x7d1a17, 0xd62a20, 0.12);
  const amberMat = basicMat(0x8a4a12, 0xff9026, 0.14);
  const ledMat = basicMat(0x2a2a26, 0xfff4d0, 0.9);

  /* tub */
  addMesh(body, new THREE.BoxGeometry(1.72, 0.52, 2.5), paint, [0, 0.98, 0.32]);
  addMesh(body, new THREE.BoxGeometry(1.78, 0.3, 1.5), paintDark, [0, 0.62, 0]);
  /* hood */
  addMesh(body, new THREE.BoxGeometry(1.52, 0.28, 1.36), paint, [0, 1.06, -1.18]);
  addMesh(body, new THREE.BoxGeometry(1.5, 0.03, 1.3), paintDark, [0, 1.21, -1.18]);
  /* grille face */
  addMesh(body, new THREE.BoxGeometry(1.42, 0.56, 0.1), MAT(0x171b1c, { roughness: 0.7 }), [0, 0.96, -1.89]);
  for (let i = 0; i < 7; i++) addMesh(body, new THREE.BoxGeometry(0.045, 0.5, 0.13), paintDark, [-0.5 + i * 0.167, 0.96, -1.9]);
  /* round headlights */
  for (const x of [-0.58, 0.58]) {
    const h = addMesh(body, new THREE.SphereGeometry(0.13, 16, 12), headMat, [x, 0.98, -1.86], null, [1, 1, 0.6]);
    h.userData.headlight = true;
    addMesh(body, new THREE.TorusGeometry(0.135, 0.022, 6, 18), steel, [x, 0.98, -1.9]);
  }
  /* fenders / flares */
  for (const z of [-1.32, 1.42]) {
    for (const x of [-0.94, 0.94]) {
      const f = addMesh(body, new THREE.BoxGeometry(0.34, 0.12, 1.06), black, [x, 0.9, z]);
      f.rotation.z = x > 0 ? -0.06 : 0.06;
      addMesh(body, new THREE.BoxGeometry(0.06, 0.5, 1.0), black, [x * 1.12, 0.62, z]);
    }
  }
  /* rock rails / side steps */
  for (const x of [-0.93, 0.93]) addMesh(body, new THREE.BoxGeometry(0.14, 0.09, 1.5), steel, [x, 0.4, 0.05]);
  /* bumpers + bull bar */
  addMesh(body, new THREE.BoxGeometry(1.84, 0.2, 0.18), steel, [0, 0.62, -2.0]);
  addMesh(body, new THREE.BoxGeometry(1.84, 0.2, 0.18), steel, [0, 0.62, 1.98]);
  const bull = new THREE.Group();
  addMesh(bull, new THREE.TorusGeometry(0.52, 0.05, 6, 20, Math.PI), steel, [0, 0.62, -2.12], [0, 0, 0]);
  for (const x of [-0.36, 0.36]) addMesh(bull, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), steel, [x, 0.72, -2.12]);
  addMesh(bull, new THREE.CylinderGeometry(0.05, 0.05, 0.92, 8), steel, [0, 0.7, -2.12], [0, 0, Math.PI / 2]);
  body.add(bull);
  /* fog lights on bar */
  for (const x of [-0.36, 0.36]) {
    const fl = addMesh(body, new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), ledMat, [x, 1.18, -2.13], [Math.PI / 2, 0, 0]);
    fl.userData.headlight = true;
  }
  /* winch */
  addMesh(body, new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12), darkGrey, [0, 0.72, -1.94], [0, 0, Math.PI / 2]);
  /* tail lights + spare tire */
  for (const x of [-0.68, 0.68]) addMesh(body, new THREE.BoxGeometry(0.14, 0.3, 0.06), tailMat, [x, 0.95, 1.6]);
  const spare = new THREE.Group();
  spare.position.set(0, 1.0, 1.62);
  spare.rotation.x = Math.PI / 2;
  const spareWheel = makeWheel(0.44, 0.28, { offroad: true });
  spare.add(spareWheel);
  body.add(spare);
  addMesh(body, new THREE.BoxGeometry(0.5, 0.4, 0.06), black, [0, 0.95, 1.58]);
  /* windshield */
  addMesh(body, new THREE.BoxGeometry(1.5, 0.62, 0.05), glass, [0, 1.58, -0.5], [-0.14, 0, 0]);
  addMesh(body, new THREE.BoxGeometry(0.07, 0.66, 0.08), steel, [-0.76, 1.58, -0.5], [-0.14, 0, 0]);
  addMesh(body, new THREE.BoxGeometry(0.07, 0.66, 0.08), steel, [0.76, 1.58, -0.5], [-0.14, 0, 0]);
  addMesh(body, new THREE.BoxGeometry(1.56, 0.07, 0.1), steel, [0, 1.9, -0.45]);
  /* side + rear glass (soft top frame) */
  addMesh(body, new THREE.BoxGeometry(0.05, 0.5, 1.5), glass, [-0.86, 1.54, 0.42]);
  addMesh(body, new THREE.BoxGeometry(0.05, 0.5, 1.5), glass, [0.86, 1.54, 0.42]);
  addMesh(body, new THREE.BoxGeometry(1.6, 0.55, 0.05), glass, [0, 1.52, 1.24]);
  /* roll cage */
  const tube = new THREE.CylinderGeometry(0.045, 0.045, 1, 8);
  const cage = new THREE.Group();
  for (const x of [-0.72, 0.72]) {
    addMesh(cage, tube, black, [x, 1.62, -0.42], null, [1, 0.72, 1]);
    addMesh(cage, tube, black, [x, 1.62, 1.2], null, [1, 0.72, 1]);
  }
  addMesh(cage, tube, black, [0, 1.95, -0.42], [0, 0, Math.PI / 2], [1, 1.44, 1]);
  addMesh(cage, tube, black, [0, 1.95, 1.2], [0, 0, Math.PI / 2], [1, 1.44, 1]);
  addMesh(cage, tube, black, [-0.72, 1.95, 0.4], [Math.PI / 2, 0, 0], [1, 1.62, 1]);
  addMesh(cage, tube, black, [0.72, 1.95, 0.4], [Math.PI / 2, 0, 0], [1, 1.62, 1]);
  body.add(cage);
  /* roof rack with light bar */
  addMesh(body, new THREE.BoxGeometry(1.5, 0.06, 1.3), black, [0, 2.02, 0.38]);
  for (const x of [-0.72, 0.72]) addMesh(body, new THREE.BoxGeometry(0.06, 0.08, 1.3), black, [x, 2.05, 0.38]);
  for (const z of [-0.2, 0.95]) addMesh(body, new THREE.BoxGeometry(1.44, 0.06, 0.06), black, [0, 2.05, z]);
  const bar = new THREE.Group();
  addMesh(bar, new THREE.BoxGeometry(1.3, 0.1, 0.1), black, [0, 2.12, -0.16]);
  for (let i = 0; i < 4; i++) {
    const lamp = addMesh(bar, new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), ledMat, [-0.42 + i * 0.28, 2.2, -0.16], [Math.PI / 2, 0, 0]);
    lamp.userData.headlight = true;
  }
  body.add(bar);
  /* snorkel */
  addMesh(body, new THREE.CylinderGeometry(0.055, 0.055, 1.1, 8), black, [0.82, 1.44, -1.3]);
  addMesh(body, new THREE.CylinderGeometry(0.075, 0.055, 0.18, 8), black, [0.82, 2.0, -1.3]);
  /* mirrors, handles, 4x4 decal */
  for (const x of [-0.92, 0.92]) {
    addMesh(body, new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), black, [x, 1.6, -0.42], [0, 0, Math.PI / 2]);
    addMesh(body, new THREE.BoxGeometry(0.12, 0.16, 0.04), black, [x * 1.1, 1.66, -0.42]);
    addMesh(body, new THREE.BoxGeometry(0.03, 0.035, 0.15), steel, [x * 0.94, 1.16, 0.4]);
  }
  const decal = (() => {
    const c = cv(256, 128), x = c.getContext("2d");
    x.clearRect(0, 0, 256, 128);
    x.fillStyle = "#e8ece2"; x.font = "bold 62px Manrope, Arial"; x.textAlign = "center";
    x.fillText("4×4", 128, 80);
    x.strokeStyle = "#e8ece2"; x.lineWidth = 5; x.strokeRect(14, 14, 228, 100);
    const t = new THREE.CanvasTexture(c);
    return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 });
  })();
  addMesh(body, new THREE.PlaneGeometry(0.62, 0.31), decal, [-0.87, 1.16, 0.72], [0, -Math.PI / 2, 0]);
  addMesh(body, new THREE.PlaneGeometry(0.62, 0.31), decal, [0.87, 1.16, 0.72], [0, Math.PI / 2, 0]);
  /* plate */
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture("JEP-4X4"), roughness: 0.6 });
  addMesh(body, new THREE.PlaneGeometry(0.42, 0.13), plateMat, [-0.5, 0.5, -2.1]);
  addMesh(body, new THREE.PlaneGeometry(0.42, 0.13), plateMat, [-0.5, 0.5, 2.08], [0, Math.PI, 0]);

  /* wheels */
  const wheels = [];
  for (const z of [-1.32, 1.42]) {
    for (const x of [-0.9, 0.9]) {
      const steer = z < 0;
      const holder = new THREE.Group();
      holder.position.set(x * 1.0, 0.52, z);
      const w = makeWheel(0.46, 0.3, { offroad: true, rimMat: new THREE.MeshPhysicalMaterial({ color: 0x3c4142, roughness: 0.5, metalness: 0.7 }) });
      holder.add(w);
      body.add(holder);
      wheels.push({ holder, wheel: w, front: steer, radius: 0.46 });
    }
  }

  /* interior */
  const interior = new THREE.Group();
  interior.visible = false;
  const seatMat = MAT(0x22262a, { roughness: 0.94 });
  addMesh(interior, new THREE.BoxGeometry(0.46, 0.16, 0.46), seatMat, [-0.34, 0.95, 0.1]);
  addMesh(interior, new THREE.BoxGeometry(0.46, 0.6, 0.14), seatMat, [-0.34, 1.2, 0.36], [-0.14, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(0.46, 0.14, 0.44), seatMat, [0.34, 0.95, 0.1]);
  addMesh(interior, new THREE.BoxGeometry(0.46, 0.55, 0.13), seatMat, [0.34, 1.17, 0.36], [-0.12, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(1.2, 0.18, 0.36), MAT(0x1b2022, { roughness: 0.7 }), [0, 1.2, -0.55]);
  const sw = new THREE.Group();
  sw.position.set(-0.34, 1.24, -0.4);
  sw.rotation.x = -0.26;
  addMesh(sw, new THREE.TorusGeometry(0.18, 0.026, 6, 20), MAT(0x0f1213, { roughness: 0.6 }));
  addMesh(sw, new THREE.BoxGeometry(0.34, 0.02, 0.03), MAT(0x0f1213, { roughness: 0.6 }));
  addMesh(sw, new THREE.BoxGeometry(0.03, 0.17, 0.03), MAT(0x0f1213, { roughness: 0.6 }));
  addMesh(sw, new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), black, [0, 0, 0.11], [Math.PI / 2, 0, 0]);
  interior.add(sw);
  addMesh(interior, new THREE.BoxGeometry(0.22, 0.02, 0.05), MAT(0x323b3e), [0, 1.52, -0.5]);
  addMesh(interior, new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), black, [0, 1.57, -0.51], [Math.PI / 2, 0, 0]);
  body.add(interior);

  const lights = [];
  for (const x of [-0.58, 0.58]) {
    const sp = new THREE.SpotLight(0xfff4dc, 0, 105, 0.5, 0.6, 1.2);
    sp.position.set(x, 1.0, -1.92);
    sp.target.position.set(x * 1.4, 0.1, -30);
    body.add(sp); body.add(sp.target);
    lights.push(sp);
  }

  const shadow = blobShadow(1.3);
  root.add(shadow);

  return {
    root, body, wheels, lights, interior, steerWheel: sw, glassParts: [glass],
    eye: new THREE.Vector3(-0.34, 1.48, -0.28), seatZ: 0.1,
    mats: { headMat, tailMat, amberMat, paint },
    shadow
  };
}


/* ------------------------------------------------------------
   POCRTE 911 (esportivo de luxo)
   ------------------------------------------------------------ */
function buildPocrte() {
  const spec = CARS.pocrte;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = PHYS(spec.color, { roughness: 0.22, metalness: 0.82, clearcoat: 1, clearcoatRoughness: 0.06 });
  const carbon = MAT(0x14171a, { roughness: 0.42, metalness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x51606b, roughness: 0.05, metalness: 0.35, transparent: true, opacity: 0.62, clearcoat: 1 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xd8dedd, roughness: 0.12, metalness: 1 });
  const headMat = basicMat(0xf2f6ff, 0xffffff, 0.55);
  const tailMat = basicMat(0x8e1518, 0xff2a2a, 0.5);
  const amberMat = basicMat(0x8a4a12, 0xff9a2a, 0.2);

  /* silhueta fastback baixa */
  const bodyGeo = extrudeProfile([
    [-2.12, 0.30], [-2.16, 0.52], [-2.04, 0.66], [-1.60, 0.74], [-1.02, 0.82],
    [-0.60, 0.90], [-0.26, 1.18], [0.26, 1.24], [0.70, 1.14], [1.12, 0.96],
    [1.60, 0.86], [1.94, 0.74], [2.08, 0.56], [2.04, 0.34], [1.66, 0.24], [-1.66, 0.24]
  ], 1.84, 0.1);
  addMesh(body, bodyGeo, paint, [0, 0, 0]);

  /* vidros */
  addMesh(body, new THREE.PlaneGeometry(1.3, 0.42), glass, [0, 1.06, -0.66], [-0.72, 0, 0]);
  addMesh(body, new THREE.PlaneGeometry(1.24, 0.36), glass, [0, 1.1, 0.62], [0.92, 0, 0]);
  for (const x of [-0.905, 0.905]) {
    addMesh(body, new THREE.PlaneGeometry(0.92, 0.3), glass, [x, 1.06, -0.12], [0, Math.PI / 2, 0]);
  }
  /* frisos pretos das janelas */
  for (const x of [-0.9, 0.9]) addMesh(body, new THREE.BoxGeometry(0.012, 0.34, 1.0), carbon, [x, 1.05, -0.12]);

  /* faróis full-LED */
  for (const x of [-0.62, 0.62]) {
    const l = addMesh(body, new THREE.BoxGeometry(0.42, 0.12, 0.1), headMat, [x, 0.72, -2.02], [0.22, 0, 0]);
    l.userData.headlight = true;
    addMesh(body, new THREE.BoxGeometry(0.46, 0.05, 0.06), carbon, [x, 0.64, -2.03]);
  }
  /* entrada de ar e splitter */
  addMesh(body, new THREE.BoxGeometry(1.1, 0.16, 0.08), carbon, [0, 0.46, -2.04]);
  addMesh(body, new THREE.BoxGeometry(1.7, 0.05, 0.34), carbon, [0, 0.26, -1.96]);
  /* lanternas em barra (assinatura 911) */
  addMesh(body, new THREE.BoxGeometry(1.62, 0.1, 0.07), tailMat, [0, 0.8, 2.06]);
  for (const x of [-0.5, 0.5]) addMesh(body, new THREE.BoxGeometry(0.24, 0.05, 0.08), amberMat, [x, 0.68, 2.06]);
  /* aerofólio traseiro */
  const wing = new THREE.Group();
  wing.position.set(0, 1.02, 1.62);
  addMesh(wing, new THREE.BoxGeometry(1.62, 0.04, 0.3), carbon, [0, 0, 0], [0.14, 0, 0]);
  for (const x of [-0.62, 0.62]) addMesh(wing, new THREE.BoxGeometry(0.06, 0.22, 0.16), carbon, [x, -0.12, 0.02]);
  body.add(wing);
  /* difusor + escapes duplos */
  addMesh(body, new THREE.BoxGeometry(1.5, 0.14, 0.2), carbon, [0, 0.3, 2.02]);
  for (const x of [-0.34, 0.34]) addMesh(body, new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10), chrome, [x, 0.32, 2.12], [Math.PI / 2, 0, 0]);
  /* retrovisores */
  for (const x of [-0.94, 0.94]) {
    addMesh(body, new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), carbon, [x, 0.98, -0.6], [0, 0, Math.PI / 2]);
    addMesh(body, new THREE.BoxGeometry(0.1, 0.08, 0.18), paint, [x * 1.12, 1.0, -0.6]);
  }
  /* soleiras laterais */
  for (const x of [-0.92, 0.92]) addMesh(body, new THREE.BoxGeometry(0.06, 0.12, 2.2), carbon, [x, 0.34, 0]);

  /* rodas largas */
  const wheels = [];
  const axles = [{ z: -1.33, r: 0.35, w: 0.3, front: true }, { z: 1.36, r: 0.38, w: 0.36, front: false }];
  for (const ax of axles) {
    for (const side of [-1, 1]) {
      const holder = new THREE.Group();
      holder.position.set(side * 0.82, ax.r, ax.z);
      const w = makeWheel(ax.r, ax.w, { rimMat: new THREE.MeshPhysicalMaterial({ color: 0x2a2f33, roughness: 0.3, metalness: 0.95, clearcoat: 0.6 }) });
      holder.add(w);
      body.add(holder);
      wheels.push({ holder, wheel: w, front: ax.front, radius: ax.r });
    }
  }

  /* interior */
  const interior = new THREE.Group();
  interior.visible = false;
  const leather = MAT(0x1e1a17, { roughness: 0.82 });
  addMesh(interior, new THREE.BoxGeometry(0.44, 0.14, 0.44), leather, [-0.34, 0.68, 0.12]);
  addMesh(interior, new THREE.BoxGeometry(0.44, 0.52, 0.12), leather, [-0.34, 0.92, 0.36], [-0.16, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(0.44, 0.12, 0.42), leather, [0.34, 0.68, 0.12]);
  addMesh(interior, new THREE.BoxGeometry(0.44, 0.48, 0.11), leather, [0.34, 0.9, 0.36], [-0.14, 0, 0]);
  addMesh(interior, new THREE.BoxGeometry(1.14, 0.16, 0.46), MAT(0x101214, { roughness: 0.7 }), [0, 0.94, -0.62]);
  const sw = new THREE.Group();
  sw.position.set(-0.34, 0.96, -0.44);
  sw.rotation.x = -0.26;
  addMesh(sw, new THREE.TorusGeometry(0.15, 0.023, 6, 20), MAT(0x0e1012, { roughness: 0.6 }));
  addMesh(sw, new THREE.BoxGeometry(0.27, 0.02, 0.03), MAT(0x0e1012));
  addMesh(sw, new THREE.BoxGeometry(0.03, 0.14, 0.03), MAT(0x0e1012));
  interior.add(sw);
  addMesh(interior, new THREE.BoxGeometry(0.34, 0.02, 0.06), MAT(0x2a3238), [0, 1.0, -0.66]);
  body.add(interior);

  const lights = [];
  for (const x of [-0.6, 0.6]) {
    const sp = new THREE.SpotLight(0xeef4ff, 0, 120, 0.38, 0.5, 1.1);
    sp.position.set(x, 0.74, -2.02);
    sp.target.position.set(x * 1.4, 0.1, -32);
    body.add(sp); body.add(sp.target);
    lights.push(sp);
  }

  const shadow = blobShadow(1.15);
  root.add(shadow);

  return {
    root, body, wheels, lights, interior, steerWheel: sw, glassParts: [glass],
    eye: new THREE.Vector3(-0.34, 1.12, -0.28), seatZ: 0.12,
    mats: { headMat, tailMat, amberMat, paint },
    shadow
  };
}

function buildVehicle(type) {
  if (type === "uno") return buildUno();
  if (type === "jeep") return buildJeep();
  if (type === "pocrte") return buildPocrte();
  return buildFusca();
}

/* ------------------------------------------------------------
   tráfego e carros estacionados (baixo custo)
   ------------------------------------------------------------ */
function makeSimpleCarGeometry() {
  const parts = [];
  const push = (geo, x, y, z) => { geo.translate(x, y, z); parts.push(geo); };
  push(new THREE.BoxGeometry(1.76, 0.58, 3.6), 0, 0.66, 0);
  push(new THREE.BoxGeometry(1.6, 0.52, 1.9), 0, 1.2, -0.16);
  push(new THREE.BoxGeometry(1.68, 0.06, 1.8), 0, 1.47, -0.16);
  for (const x of [-0.86, 0.86]) {
    for (const z of [-1.14, 1.16]) {
      const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.2, 10);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(x, 0.33, z);
      parts.push(wheel);
    }
  }
  /* merge by hand: convert each to non-indexed and concat positions */
  let total = 0;
  const partsNI = parts.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g;
    total += ni.attributes.position.count;
    return ni;
  });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of partsNI) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
}

let SIMPLE_CAR_GEO = null;
function simpleCarGeometry() {
  if (!SIMPLE_CAR_GEO) SIMPLE_CAR_GEO = makeSimpleCarGeometry();
  return SIMPLE_CAR_GEO;
}
