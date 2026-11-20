/* ============================================================
   SAMPA DRIVER · 04 · cena, céu, clima, luz
   ============================================================ */
let scene, camera, renderer, sunLight, hemiLight, fillLight, skyMesh, skyUniforms;
let cityRoot, trafficRoot, propRoot, rainPoints, starField, sunSprite, moonSprite, cloudGroup;
let clock = null;
const WORLD = {
  ready: false, sunDir: new THREE.Vector3(0.5, 0.8, 0.3),
  shadowSize: 1, fogNear: 400, fogFar: 2400, lampGlow: null, windowMats: [],
  asphaltMats: [], nightMix: 0, quality: "high"
};

/* ---------- textures ---------- */
const TEXCACHE = {};

function makeFacadeTextures() {
  const styles = [];
  const make = (draw, litChance, baseWarm) => {
    const c = cv(256, 256), x = c.getContext("2d");
    draw(x, 256);
    const map = tex(c);
    const e = cv(256, 256), ex = e.getContext("2d");
    ex.fillStyle = "#000"; ex.fillRect(0, 0, 256, 256);
    const cells = 4, cs = 256 / cells;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        if (Math.random() > litChance) continue;
        const px = i * cs + cs * 0.16, py = j * cs + cs * 0.2;
        const w = cs * 0.68, h = cs * 0.55;
        const grad = ex.createLinearGradient(px, py, px, py + h);
        grad.addColorStop(0, baseWarm ? "#ffe9b4" : "#dff1ff");
        grad.addColorStop(1, baseWarm ? "#a87b3a" : "#5c8fa8");
        ex.fillStyle = grad;
        ex.fillRect(px, py, w, h);
        ex.fillStyle = "rgba(0,0,0,.35)";
        ex.fillRect(px, py + h * 0.55, w, h * 0.45);
      }
    }
    const emissive = tex(e);
    return { map, emissive };
  };

  /* 0 · concreto claro com janelas */
  styles.push(make((x, S) => {
    x.fillStyle = "#b9b6ad"; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = "rgba(0,0,0," + rnd(0.01, 0.05) + ")";
      x.fillRect(rnd(S), rnd(S), rnd(1, 5), rnd(1, 5));
    }
    const cells = 4, cs = S / cells;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const px = i * cs + cs * 0.16, py = j * cs + cs * 0.2;
        const w = cs * 0.68, h = cs * 0.55;
        x.fillStyle = "#2f4650"; x.fillRect(px, py, w, h);
        const g = x.createLinearGradient(px, py, px + w, py + h);
        g.addColorStop(0, "rgba(150,200,215,.45)"); g.addColorStop(1, "rgba(20,40,50,.2)");
        x.fillStyle = g; x.fillRect(px, py, w, h);
        x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(px, py, w, 2);
        x.fillStyle = "rgba(0,0,0,.22)"; x.fillRect(px - 2, py + h + 2, w + 4, 3);
        x.fillStyle = "rgba(0,0,0,.10)"; x.fillRect(px - 4, py - 2, w + 8, 2);
      }
    }
  }, 0.42, true));

  /* 1 · tijolo / prédio antigo */
  styles.push(make((x, S) => {
    x.fillStyle = "#9c8474"; x.fillRect(0, 0, S, S);
    for (let row = 0; row < 24; row++) {
      for (let col = 0; col < 16; col++) {
        x.fillStyle = "rgba(" + rndInt(120, 168) + "," + rndInt(88, 118) + "," + rndInt(72, 96) + ",.55)";
        x.fillRect(col * 16 + (row % 2 ? 8 : 0), row * 11, 14, 9);
      }
    }
    const cells = 3, cs = S / cells;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const px = i * cs + cs * 0.28, py = j * cs + cs * 0.24;
        const w = cs * 0.42, h = cs * 0.5;
        x.fillStyle = "#20303a"; x.fillRect(px, py, w, h);
        x.fillStyle = "rgba(180,215,220,.28)"; x.fillRect(px + 1, py + 1, w - 2, h * 0.35);
        x.fillStyle = "rgba(240,235,220,.5)"; x.fillRect(px - 4, py + h + 3, w + 8, 4);
      }
    }
  }, 0.3, true));

  /* 2 · vidro / torre corporativa */
  styles.push(make((x, S) => {
    x.fillStyle = "#42595f"; x.fillRect(0, 0, S, S);
    const cells = 4, cs = S / cells;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const px = i * cs, py = j * cs;
        const g = x.createLinearGradient(px, py, px + cs, py + cs);
        g.addColorStop(0, "rgba(120,175,195,.65)");
        g.addColorStop(0.5, "rgba(48,80,95,.9)");
        g.addColorStop(1, "rgba(150,195,205,.5)");
        x.fillStyle = g; x.fillRect(px + 2, py + 2, cs - 4, cs - 4);
        x.strokeStyle = "rgba(20,30,34,.85)"; x.lineWidth = 3;
        x.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
        x.fillStyle = "rgba(255,255,255,.1)"; x.fillRect(px + 4, py + 4, cs - 8, 3);
      }
    }
  }, 0.5, false));

  /* 3 · branco moderno com faixas */
  styles.push(make((x, S) => {
    x.fillStyle = "#d8d5cb"; x.fillRect(0, 0, S, S);
    const floors = 4, fh = S / floors;
    for (let f = 0; f < floors; f++) {
      const y = f * fh;
      x.fillStyle = "rgba(0,0,0,.08)"; x.fillRect(0, y + fh - 4, S, 4);
      x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(0, y, S, 2);
      for (let i = 0; i < 4; i++) {
        const px = i * (S / 4) + 10, py = y + fh * 0.22, w = S / 4 - 20, h = fh * 0.44;
        x.fillStyle = "#31474f"; x.fillRect(px, py, w, h);
        x.fillStyle = "rgba(175,215,225,.35)"; x.fillRect(px + 2, py + 2, w - 4, h * 0.4);
      }
    }
  }, 0.4, true));

  return styles;
}

function makeSurfaceTextures() {
  /* asphalt */
  {
    const c = cv(128, 128), x = c.getContext("2d");
    x.fillStyle = "#4c5254"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2600; i++) {
      const v = rndInt(50, 105);
      x.fillStyle = "rgba(" + v + "," + v + "," + (v + 2) + "," + rnd(0.25, 0.7) + ")";
      x.fillRect(rnd(128), rnd(128), rnd(1, 2.4), rnd(1, 2.4));
    }
    for (let i = 0; i < 12; i++) {
      x.strokeStyle = "rgba(30,32,34,.25)"; x.lineWidth = rnd(0.5, 1.4);
      x.beginPath(); x.moveTo(rnd(128), 0); x.lineTo(rnd(128), 128); x.stroke();
    }
    TEXCACHE.asphalt = tex(c);
  }
  /* sidewalk */
  {
    const c = cv(128, 128), x = c.getContext("2d");
    x.fillStyle = "#8e8d86"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1200; i++) {
      const v = rndInt(115, 165);
      x.fillStyle = "rgba(" + v + "," + v + "," + (v - 6) + "," + rnd(0.2, 0.5) + ")";
      x.fillRect(rnd(128), rnd(128), rnd(1, 3), rnd(1, 3));
    }
    x.strokeStyle = "rgba(60,60,58,.5)"; x.lineWidth = 1.6;
    x.strokeRect(0, 0, 128, 128);
    x.strokeStyle = "rgba(60,60,58,.28)";
    x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke();
    TEXCACHE.sidewalk = tex(c);
  }
  /* roof */
  {
    const c = cv(128, 128), x = c.getContext("2d");
    x.fillStyle = "#6b6c68"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1600; i++) {
      const v = rndInt(70, 130);
      x.fillStyle = "rgba(" + v + "," + v + "," + v + "," + rnd(0.2, 0.6) + ")";
      x.fillRect(rnd(128), rnd(128), rnd(1, 4), rnd(1, 4));
    }
    x.strokeStyle = "rgba(40,42,40,.4)"; x.lineWidth = 1;
    for (let i = 0; i < 128; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    TEXCACHE.roof = tex(c);
  }
  /* ground */
  {
    const c = cv(256, 256), x = c.getContext("2d");
    x.fillStyle = "#5c6158"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) {
      const g = rndInt(70, 118);
      x.fillStyle = "rgba(" + (g - 6) + "," + g + "," + (g - 12) + "," + rnd(0.15, 0.5) + ")";
      x.fillRect(rnd(256), rnd(256), rnd(1, 4), rnd(1, 4));
    }
    TEXCACHE.ground = tex(c, 120);
  }
  /* park grass */
  {
    const c = cv(128, 128), x = c.getContext("2d");
    x.fillStyle = "#4b6b3d"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2800; i++) {
      const g = rndInt(60, 120);
      x.fillStyle = "rgba(" + (g * 0.7) + "," + g + "," + (g * 0.55) + "," + rnd(0.2, 0.6) + ")";
      x.fillRect(rnd(128), rnd(128), rnd(1, 3), rnd(1, 4));
    }
    TEXCACHE.grass = tex(c, 4);
  }
  /* water */
  {
    const c = cv(128, 128), x = c.getContext("2d");
    x.fillStyle = "#2c4a55"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 400; i++) {
      x.fillStyle = "rgba(150,200,215," + rnd(0.03, 0.14) + ")";
      x.fillRect(rnd(128), rnd(128), rnd(4, 20), rnd(0.6, 1.6));
    }
    TEXCACHE.water = tex(c, 20);
  }
  /* lamp glow sprite */
  TEXCACHE.glow = softCircleTexture(64, "rgba(255,226,170,0.95)", 0.3);
  TEXCACHE.sunGlow = softCircleTexture(128, "rgba(255,242,200,1)", 0.22);
}

/* ---------- sky ---------- */
const SKY_KEYS = [
  { h: 0, top: 0x050a14, hor: 0x0b1626, bot: 0x04070c, sun: 0x8aa6d8, amb: 0x1a2740, fog: 0x0a1420 },
  { h: 5, top: 0x0b1524, hor: 0x1c2a3c, bot: 0x090e16, sun: 0x9db0d8, amb: 0x233046, fog: 0x121d2a },
  { h: 6.5, top: 0x2b4258, hor: 0xc98a63, bot: 0x4a3a33, sun: 0xffb383, amb: 0x4a4a52, fog: 0x8a6a5f },
  { h: 9, top: 0x3f7098, hor: 0xb9d3dd, bot: 0x7d949a, sun: 0xfff2d8, amb: 0x6d8496, fog: 0xa8bfc6 },
  { h: 13, top: 0x3c7ba8, hor: 0xc3dbe2, bot: 0x8ba4a8, sun: 0xffffff, amb: 0x7d95a5, fog: 0xadc3c9 },
  { h: 16.5, top: 0x3f6f96, hor: 0xd4c3a8, bot: 0x8d9793, sun: 0xffe2bb, amb: 0x76858f, fog: 0xb3bfbd },
  { h: 18.2, top: 0x2c4767, hor: 0xe0a06a, bot: 0x5d5a58, sun: 0xffb070, amb: 0x5f6470, fog: 0x9c8f83 },
  { h: 19.5, top: 0x131f33, hor: 0x6b4a55, bot: 0x1d2029, sun: 0xd39a7a, amb: 0x39404f, fog: 0x3d3a44 },
  { h: 21, top: 0x070d18, hor: 0x141f30, bot: 0x05080e, sun: 0x8aa6d8, amb: 0x1e2a3e, fog: 0x0d1723 },
  { h: 24, top: 0x050a14, hor: 0x0b1626, bot: 0x04070c, sun: 0x8aa6d8, amb: 0x1a2740, fog: 0x0a1420 }
];

function skyAt(hour, weather) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (hour >= SKY_KEYS[i].h && hour <= SKY_KEYS[i + 1].h) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const t = clamp((hour - a.h) / Math.max(0.001, b.h - a.h), 0, 1);
  const out = {
    top: mixHex(a.top, b.top, t), hor: mixHex(a.hor, b.hor, t), bot: mixHex(a.bot, b.bot, t),
    sun: mixHex(a.sun, b.sun, t), amb: mixHex(a.amb, b.amb, t), fog: mixHex(a.fog, b.fog, t)
  };
  if (weather === "cloudy") {
    out.top = mixHex(out.top, 0x6d7c85, 0.55);
    out.hor = mixHex(out.hor, 0x9aa7ad, 0.6);
    out.bot = mixHex(out.bot, 0x6a767c, 0.5);
    out.fog = mixHex(out.fog, 0x8b989e, 0.6);
  } else if (weather === "rain") {
    out.top = mixHex(out.top, 0x39424a, 0.7);
    out.hor = mixHex(out.hor, 0x5c656c, 0.7);
    out.bot = mixHex(out.bot, 0x3a4247, 0.65);
    out.fog = mixHex(out.fog, 0x4c565d, 0.7);
  } else if (weather === "fog") {
    out.fog = mixHex(out.fog, 0xa8b2b4, 0.75);
    out.hor = mixHex(out.hor, 0xa8b2b4, 0.6);
  }
  return out;
}

function initSky() {
  skyUniforms = {
    topColor: { value: new THREE.Color(0x3c7ba8) },
    horizonColor: { value: new THREE.Color(0xc3dbe2) },
    bottomColor: { value: new THREE.Color(0x8ba4a8) },
    offset: { value: 0.1 },
    exponent: { value: 0.8 }
  };
  const geo = new THREE.SphereGeometry(2900, 32, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: [
      "uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor;",
      "uniform float offset; uniform float exponent; varying vec3 vP;",
      "void main(){",
      "  float h = normalize(vP).y;",
      "  vec3 col;",
      "  if(h > 0.0){ col = mix(horizonColor, topColor, pow(clamp(h,0.0,1.0), exponent)); }",
      "  else { col = mix(horizonColor, bottomColor, pow(clamp(-h*3.2,0.0,1.0), 0.75)); }",
      "  gl_FragColor = vec4(col,1.0);",
      "}"
    ].join("\n")
  });
  skyMesh = new THREE.Mesh(geo, mat);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -10;
  scene.add(skyMesh);

  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEXCACHE.sunGlow, color: 0xfff3cf, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9, fog: false }));
  sunSprite.scale.set(280, 280, 1);
  scene.add(sunSprite);

  moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEXCACHE.sunGlow, color: 0xdfe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false }));
  moonSprite.scale.set(120, 120, 1);
  scene.add(moonSprite);

  /* stars */
  const count = 900, pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(2500);
    v.y = Math.abs(v.y) * 0.9 + 60;
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starField = new THREE.Points(sg, new THREE.PointsMaterial({
    color: 0xffffff, size: 5, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false
  }));
  scene.add(starField);

  /* clouds */
  const cloudTex = (() => {
    const c = cv(256, 128), x = c.getContext("2d");
    for (let i = 0; i < 34; i++) {
      const cx = rnd(40, 216), cy = rnd(50, 92), r = rnd(22, 48);
      const g = x.createRadialGradient(cx, cy, 1, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
    }
    return tex(c);
  })();
  cloudGroup = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    const a = rnd(TAU), r = rnd(700, 2200);
    s.position.set(Math.cos(a) * r, rnd(280, 520), Math.sin(a) * r);
    s.scale.set(rnd(280, 620), rnd(110, 220), 1);
    s.userData.drift = rnd(0.6, 1.6);
    cloudGroup.add(s);
  }
  scene.add(cloudGroup);
}

/* ---------- rain ---------- */
function initRain() {
  const count = 2600;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rnd(-70, 70); pos[i * 3 + 1] = rnd(0, 55); pos[i * 3 + 2] = rnd(-70, 70);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xc9dbe6, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false });
  rainPoints = new THREE.Points(g, m);
  rainPoints.visible = false;
  scene.add(rainPoints);
}

/* ---------- engine ---------- */
function initRenderer() {
  const canvas = $("#scene");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb6bd);
  scene.fog = new THREE.Fog(0xa8bfc6, 380, 2300);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.28, 3200);
  camera.position.set(30, 26, 40);

  hemiLight = new THREE.HemisphereLight(0xdceeff, 0x4b5240, 0.85);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff0d8, 2.1);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 620;
  sunLight.shadow.camera.left = -95;
  sunLight.shadow.camera.right = 95;
  sunLight.shadow.camera.top = 95;
  sunLight.shadow.camera.bottom = -95;
  sunLight.shadow.bias = -0.0009;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight);
  scene.add(sunLight.target);

  fillLight = new THREE.DirectionalLight(0x9dc4d8, 0.4);
  fillLight.position.set(-120, 90, -160);
  scene.add(fillLight);

  cityRoot = new THREE.Group();
  scene.add(cityRoot);
  trafficRoot = new THREE.Group();
  scene.add(trafficRoot);
  propRoot = new THREE.Group();
  scene.add(propRoot);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(6200, 6200),
    new THREE.MeshStandardMaterial({ map: TEXCACHE.ground, color: 0x8f968c, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  ground.name = "ground";
  scene.add(ground);

  initSky();
  initRain();
  clock = new THREE.Clock();
  window.addEventListener("resize", onResize);
}

function onResize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (typeof resizeShowroom === "function") resizeShowroom();
}

function setQuality(q) {
  WORLD.quality = q;
  if (!renderer) return;
  const ratio = q === "high" ? 1.7 : q === "balanced" ? 1.15 : 0.8;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = !!state.settings.shadows && q !== "low";
  sunLight.castShadow = renderer.shadowMap.enabled;
  const size = q === "high" ? 2048 : q === "balanced" ? 1536 : 1024;
  if (sunLight.shadow.mapSize.x !== size) {
    sunLight.shadow.mapSize.set(size, size);
    if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
  }
  state.viewDist = state.settings.view === "far" ? 2400 : state.settings.view === "mid" ? 1700 : 1100;
  updateSkyLight();
  if (typeof buildCityDistant === "function") buildCityDistant();
}

function updateSkyLight() {
  if (!scene || !sunLight) return;
  const hour = state.hour;
  const pal = skyAt(hour, state.settings.weather);
  const isNight = hour < 5.9 || hour > 18.9;
  const nightMix = clamp(Math.max(0, 1 - Math.abs(hour - 19) / 2) * 0.4 + (isNight ? 0.6 : 0), 0, 1);
  WORLD.nightMix = nightMix;

  skyUniforms.topColor.value.setHex(pal.top);
  skyUniforms.horizonColor.value.setHex(pal.hor);
  skyUniforms.bottomColor.value.setHex(pal.bot);
  scene.fog.color.setHex(pal.fog);
  scene.background.setHex(pal.hor);

  /* sun arc */
  const t = ((hour - 6) / 12) * Math.PI;
  const sunY = Math.sin(t);
  const sunX = Math.cos(t);
  const sunDir = new THREE.Vector3(sunX * 0.85, Math.max(-0.25, sunY), 0.32).normalize();
  WORLD.sunDir.copy(sunDir);
  const dist = 480;
  sunLight.position.set(sunDir.x * dist, Math.max(6, sunDir.y * dist), sunDir.z * dist);
  if (state.player) sunLight.target.position.set(state.x, 0, state.z);

  const dayFactor = clamp(sunY * 1.6, 0, 1);
  sunLight.intensity = isNight ? 0.12 : 0.35 + dayFactor * 2.0;
  sunLight.color.setHex(pal.sun);
  hemiLight.intensity = isNight ? 0.28 : 0.5 + dayFactor * 0.55;
  hemiLight.color.setHex(pal.amb);
  hemiLight.groundColor.setHex(isNight ? 0x0e1420 : 0x4a4f40);
  if (fillLight) fillLight.intensity = isNight ? 0.25 : 0.45;
  renderer.toneMappingExposure = isNight ? 1.16 : 1.0 + dayFactor * 0.06;

  sunSprite.position.copy(sunDir).multiplyScalar(2500);
  sunSprite.material.opacity = clamp(0.85 - nightMix, 0, 1);
  sunSprite.material.color.setHex(isNight ? 0xffc98a : 0xfff2cc);
  moonSprite.position.set(-sunDir.x * 2500, Math.abs(sunDir.y) * 900 + 600, -sunDir.z * 2500);
  moonSprite.material.opacity = nightMix * 0.8;
  if (starField) starField.material.opacity = clamp((nightMix - 0.25) * 1.4, 0, 0.9);

  const fogNear = isNight ? 130 : 240;
  const fogFar = state.settings.weather === "fog" ? 420 : (state.viewDist || 2400) * (isNight ? 0.7 : 1);
  scene.fog.near = fogNear;
  scene.fog.far = fogFar;
  if (state.settings.weather === "rain") { scene.fog.near = 80; scene.fog.far = Math.min(scene.fog.far, 900); }
  if (cloudGroup) {
    const op = state.settings.weather === "clear" ? 0.16 : state.settings.weather === "cloudy" ? 0.5 : 0.62;
    cloudGroup.children.forEach((c) => { c.material.opacity = op * (1 - nightMix * 0.7); });
    cloudGroup.visible = state.settings.weather !== "fog";
  }

  /* window lights on buildings */
  const wi = clamp(nightMix * 1.35 + (state.settings.weather === "rain" ? 0.2 : 0), 0, 1);
  for (const m of WORLD.windowMats) m.emissiveIntensity = 0.06 + wi * 1.5;
  /* street lamps */
  if (WORLD.lampGlow) WORLD.lampGlow.material.opacity = clamp(nightMix * 1.25, 0, 1);
  if (WORLD.lampBulbMat) WORLD.lampBulbMat.emissiveIntensity = 0.25 + nightMix * 2.4;

  /* headlights automatically */
  if (state.settings.autolight && state.playing) {
    const want = nightMix > 0.45 || state.settings.weather === "rain" || state.settings.weather === "fog";
    if (want !== state.lights) setHeadlights(want, true);
  }

  /* at night the asphalt becomes slightly wet-looking */
  for (const m of WORLD.asphaltMats) {
    m.roughness = state.settings.weather === "rain" ? 0.42 : 0.92;
    m.metalness = state.settings.weather === "rain" ? 0.25 : 0.02;
  }
  if (rainPoints) rainPoints.visible = state.settings.weather === "rain";
  if (WORLD.rainOn !== (state.settings.weather === "rain")) {
    WORLD.rainOn = state.settings.weather === "rain";
    const rl = $("#rain-layer");
    if (rl) rl.className = WORLD.rainOn ? "on" : "";
    const mEl = $("#map-loader");
    if (mEl) mEl.classList.remove("show");
  }

  /* DOM only when something actually changed (evita recálculo por frame) */
  const meta = weatherMeta(state.settings.weather, hour);
  state.weatherName = meta.label;
  const clockStr = pad2(Math.floor(hour)) + ":" + pad2(Math.floor((hour % 1) * 60));
  if (WORLD.envKey !== clockStr + "|" + state.settings.weather) {
    WORLD.envKey = clockStr + "|" + state.settings.weather;
    const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
    set("#topbar-weather", meta.label.toUpperCase() + " · " + meta.temp + "°C");
    set("#hud-weather", meta.temp + "°");
    set("#topbar-time", clockStr);
    set("#hud-clock", clockStr);
    set("#stat-clock", clockStr);
    const pillIcon = $("#hud-weather-pill use");
    if (pillIcon) pillIcon.setAttribute("href", meta.icon);
    const chipIcon = $("#topbar-weather-pill use");
    if (chipIcon) chipIcon.setAttribute("href", meta.icon);
  }
}

function weatherMeta(w, hour) {
  const night = hour < 6 || hour > 19;
  const base = { clear: [night ? 17 : 24, night ? "Céu limpo" : "Ensolarado", "#i-sun"], cloudy: [night ? 16 : 21, "Nublado", "#i-cloud"], rain: [night ? 15 : 18, "Chuva", "#i-rain"], fog: [night ? 14 : 16, "Neblina", "#i-fog"] }[w] || [24, "Ensolarado", "#i-sun"];
  return { temp: base[0], label: base[1], icon: base[2] };
}

function updateEnvironment(dt) {
  if (state.settings.timelapse && state.playing && !state.paused) {
    state.hour = (state.hour + dt * (1 / 60)) % 24; /* 1 minuto de jogo por segundo */
  }
  updateSkyLight();
  if (cloudGroup) {
    cloudGroup.children.forEach((c) => {
      c.position.x += c.userData.drift * dt * 2.2;
      if (c.position.x > 2600) c.position.x = -2600;
    });
  }
  if (rainPoints && rainPoints.visible) {
    const pos = rainPoints.geometry.attributes.position;
    const arr = pos.array;
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * (26 + (i % 17));
      arr[i] -= dt * 6;
      if (arr[i + 1] < 0) {
        arr[i + 1] = 52 + Math.random() * 8;
        arr[i] = cx + rnd(-70, 70);
        arr[i + 2] = cz + rnd(-70, 70);
      }
      if (Math.abs(arr[i] - cx) > 80) arr[i] = cx + rnd(-70, 70);
      if (Math.abs(arr[i + 2] - cz) > 80) arr[i + 2] = cz + rnd(-70, 70);
    }
    pos.needsUpdate = true;
  }
  if (sunLight && state.player) {
    sunLight.target.position.set(state.x, 0, state.z);
    sunLight.position.set(state.x + WORLD.sunDir.x * 300, Math.max(20, WORLD.sunDir.y * 300), state.z + WORLD.sunDir.z * 300);
    sunLight.target.updateMatrixWorld();
  }
}
