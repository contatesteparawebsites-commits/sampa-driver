/* ============================================================
   SAMPA DRIVER · 07 · direção, câmera, showroom
   ============================================================ */

let PLAYER = { model: null, group: null, wheelSpin: 0, bodyRoll: 0, bodyPitch: 0, bob: 0 };
state.player = null;
state.slip = 0;
state.viewDist = 2400;

function spawnPlayerModel() {
  if (PLAYER.group) {
    scene.remove(PLAYER.group);
    PLAYER.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  const model = buildVehicle(state.car);
  model.root.position.set(state.x, 0, state.z);
  model.root.rotation.y = state.yaw;
  scene.add(model.root);
  PLAYER.model = model;
  PLAYER.group = model.root;
  PLAYER.wheelSpin = 0;
  PLAYER.bodyRoll = 0;
  PLAYER.bodyPitch = 0;
  state.player = { x: state.x, z: state.z };
  applyCameraMode(true);
  updateCarHUD();
}

function setHeadlights(on, silent) {
  state.lights = !!on;
  if (PLAYER.model) {
    PLAYER.model.lights.forEach((l) => { l.intensity = state.lights ? 3.4 : 0; l.visible = state.lights; });
    PLAYER.model.mats.headMat.emissiveIntensity = state.lights ? 1.6 : 0.2;
  }
  const btn = $("#btn-lights");
  if (btn) btn.classList.toggle("active", state.lights);
  if (!silent) toast(state.lights ? "Faróis ligados" : "Faróis desligados");
  else if (state.lights) toast("Faróis acenderam automaticamente");
}

function toggleHazard() {
  state.hazard = !state.hazard;
  const btn = $("#btn-hazard");
  if (btn) btn.classList.toggle("active", state.hazard);
  toast(state.hazard ? "Pisca-alerta ligado" : "Pisca-alerta desligado");
}

/* ---------- camera ---------- */
function cameraModeLabel() {
  return state.camera === "first" ? "1ª pessoa" : "3ª pessoa";
}
function applyCameraMode(instant) {
  if (!PLAYER.model) return;
  const first = state.camera === "first";
  PLAYER.model.interior.visible = first;
  PLAYER.model.glassParts.forEach((m) => { m.opacity = first ? 0.06 : (m === PLAYER.model.glassParts[0] ? 0.32 : 0.24); });
  PLAYER.model.root.traverse((o) => {
    if (o.isMesh && o.material && o.material === PLAYER.model.mats.paint) o.castShadow = !first;
  });
  const label = $("#camera-label");
  if (label) label.textContent = first ? "1ª" : "3ª";
  const home = $("#home-cam-label");
  if (home) home.textContent = cameraModeLabel();
  if (instant) {
    if (first) {
      const eye = PLAYER.model.eye;
      camera.position.set(state.x + eye.x, eye.y, state.z + eye.z);
    } else {
      camera.position.set(state.x + Math.sin(state.yaw) * 9, 4.6, state.z + Math.cos(state.yaw) * 9);
    }
  }
  $("#btn-camera").classList.toggle("active", first);
}
function toggleCamera() {
  state.camera = state.camera === "first" ? "third" : "first";
  state.settings.camera = state.camera;
  applyCameraMode(false);
  playClick("tick");
  toast("Câmera: " + cameraModeLabel());
}
function setCamera(mode) {
  state.camera = mode === "first" ? "first" : "third";
  applyCameraMode(false);
}
function zoomCamera(delta) {
  state.camZoom = clamp(state.camZoom + delta, 0.55, 2.6);
}

/* ---------- collisions ---------- */
function resolveCollisions() {
  const R = 1.25;
  const near = blockersNear(state.blockers, state.x, state.z, R + 2);
  if (!near.length) return false;
  let hit = false;
  for (const b of near) {
    if (b.h !== undefined && b.h < 1.4) continue;
    const cx = clamp(state.x, b.minX, b.maxX);
    const cz = clamp(state.z, b.minZ, b.maxZ);
    const dx = state.x - cx, dz = state.z - cz;
    const d = Math.hypot(dx, dz);
    if (d >= R || d === 0) {
      if (d === 0) {
        /* inside the box: push out on the nearest face */
        const dLeft = state.x - b.minX, dRight = b.maxX - state.x;
        const dUp = state.z - b.minZ, dDown = b.maxZ - state.z;
        const m = Math.min(dLeft, dRight, dUp, dDown);
        if (m === dLeft) state.x = b.minX - R;
        else if (m === dRight) state.x = b.maxX + R;
        else if (m === dUp) state.z = b.minZ - R;
        else state.z = b.maxZ + R;
        hit = true;
      }
      continue;
    }
    const nx = dx / d, nz = dz / d;
    const push = R - d;
    state.x += nx * push;
    state.z += nz * push;
    const vn = state.vx * nx + state.vz * nz;
    if (vn < 0) {
      state.vx -= nx * vn * 1.35;
      state.vz -= nz * vn * 1.35;
      const impact = Math.abs(vn);
      if (impact > 2.2) {
        state.condition = Math.max(0, state.condition - impact * 0.42);
        playClick("crash");
        cameraShake = Math.min(0.55, impact * 0.05);
        if (impact > 5) toast("Bateu! Cuidado com os prédios", "warn");
      }
    }
    hit = true;
  }
  return hit;
}

/* ---------- driving ---------- */
let cameraShake = 0;
let lastGear = 1;
let engineRan = false;

function inputAxis() {
  const k = state.keys;
  let throttle = 0, brake = 0, steer = 0;
  if (k.w || k.arrowup) throttle += 1;
  if (k.s || k.arrowdown) brake += 1;
  if (k.d || k.arrowright) steer += 1;
  if (k.a || k.arrowleft) steer -= 1;
  if (state.touch) {
    throttle = Math.max(throttle, state.touch.throttle || 0);
    brake = Math.max(brake, state.touch.brake || 0);
    steer = clamp(steer + (state.touch.steer || 0), -1, 1);
  }
  if (state.pad) {
    throttle = Math.max(throttle, state.pad.throttle || 0);
    brake = Math.max(brake, state.pad.brake || 0);
    if (Math.abs(state.pad.steer || 0) > 0.12) steer = clamp(steer + state.pad.steer, -1, 1);
  }
  return { throttle, brake, steer };
}

function updateDrive(dt) {
  if (!PLAYER.model) return;
  const spec = CARS[state.car];
  const maxSpeed = spec.maxKmh / 3.6;
  const input = inputAxis();
  const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
  const rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw);

  let vLong = state.vx * fx + state.vz * fz;
  let vLat = state.vx * rx + state.vz * rz;

  const near = nearestRoadInfo(state.x, state.z);
  const offroad = !near.on;
  const handbrake = !!(state.keys[" "] || state.keys.space);

  /* throttle / brake */
  let accel = 0;
  if (input.throttle > 0) {
    const curve = 1 - clamp(Math.abs(vLong) / maxSpeed, 0, 1) * 0.82;
    accel += spec.accel * input.throttle * curve * (offroad ? 0.72 : 1);
  }
  if (input.brake > 0) {
    if (vLong > 0.6) accel -= spec.brake * input.brake;
    else accel -= spec.accel * 0.62 * input.brake;
  }
  if (handbrake) accel -= Math.sign(vLong) * spec.handbrake * 0.55;
  /* engine braking + rolling resistance */
  if (!input.throttle && !input.brake) accel -= vLong * (offroad ? 0.85 : 0.32);
  accel -= Math.sign(vLong) * (0.55 + 0.0055 * vLong * vLong);

  vLong += accel * dt;
  if (Math.abs(vLong) < 0.06 && !input.throttle && !input.brake) vLong = 0;
  vLong = clamp(vLong, -maxSpeed * 0.34, maxSpeed);

  /* steering */
  const speedFactor = clamp(Math.abs(vLong) / 5, 0, 1);
  const steerLimit = (1 - clamp(Math.abs(vLong) / maxSpeed, 0, 1) * 0.52) * (state.settings.assist ? 1 : 1.16);
  state.steer = damp(state.steer, input.steer * steerLimit * (state.settings.sens || 1), 9, dt);
  const grip = spec.grip * (offroad ? 0.62 : 1) * (handbrake ? 0.3 : 1) * (state.settings.assist ? 1.06 : 0.94);
  const yawRate = state.steer * (1.72 + speedFactor * 0.42) * speedFactor * Math.sign(vLong || 1) * (handbrake ? 1.35 : 1);
  state.yaw -= yawRate * dt;

  /* lateral friction */
  vLat += -yawRate * vLong * dt * 0.55;
  vLat *= Math.exp(-grip * 7.5 * dt);
  state.slip = Math.abs(vLat);

  state.vx = fx * vLong + rx * vLat;
  state.vz = fz * vLong + rz * vLat;
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  state.speed = vLong;
  state.throttle = input.throttle;
  state.brakeInput = input.brake;
  state.handbrake = handbrake;

  if (resolveCollisions()) {
    const vLong2 = state.vx * fx + state.vz * fz;
    state.speed = vLong2;
  }

  /* odometer + top speed */
  const kmh = Math.abs(state.speed) * 3.6;
  state.odometer += Math.abs(state.speed) * dt / 1000;
  state.topSpeed = Math.max(state.topSpeed, kmh);

  /* gears + rpm */
  const ratio = clamp(Math.abs(state.speed) / maxSpeed, 0, 1);
  const gears = spec.gearCount;
  let gear = 1;
  if (state.speed < -0.4) gear = -1;
  else if (ratio > 0.001) gear = clamp(Math.ceil(ratio * gears - 0.001), 1, gears);
  if (gear > 0) {
    const span = 1 / gears;
    const within = clamp((ratio - (gear - 1) * span) / span, 0, 1.2);
    const target = spec.sound.idle + within * (spec.sound.redline - spec.sound.idle) * 0.92 + state.throttle * 260;
    state.rpm = damp(state.rpm, Math.max(spec.sound.idle * 0.92, Math.min(spec.sound.redline * 1.03, target)), 6, dt);
  } else {
    state.rpm = damp(state.rpm, spec.sound.idle + state.throttle * 400, 5, dt);
  }
  if (gear !== lastGear && gear > 0 && Math.abs(state.speed) > 2) {
    playClick("shift");
    lastGear = gear;
  }
  state.gear = gear;

  /* drifting */
  state.drifting = Math.abs(vLat) > 2.6 && Math.abs(state.speed) > 4;

  /* wheels + suspension */
  const model = PLAYER.model;
  PLAYER.wheelSpin -= state.speed * dt / (model.wheels[0] ? model.wheels[0].radius : 0.36);
  for (const w of model.wheels) {
    if (w.wheel.userData && w.wheel.userData.spin) w.wheel.userData.spin.rotation.x = PLAYER.wheelSpin;
    if (w.front) w.holder.rotation.y = -state.steer * 0.5;
  }
  PLAYER.bodyRoll = damp(PLAYER.bodyRoll, -state.steer * clamp(Math.abs(state.speed) / maxSpeed, 0, 1) * 0.11 + (handbrake ? 0 : 0), 6, dt);
  PLAYER.bodyPitch = damp(PLAYER.bodyPitch, clamp(accel * 0.0075, -0.06, 0.06), 5, dt);
  PLAYER.bob += dt * (6 + Math.abs(state.speed) * 0.8);
  const bob = offroad ? Math.sin(PLAYER.bob * 2.4) * 0.02 * clamp(Math.abs(state.speed) / 8, 0, 1) : 0;

  model.root.position.set(state.x, 0, state.z);
  model.root.rotation.y = state.yaw;
  model.body.rotation.z = PLAYER.bodyRoll + bob;
  model.body.rotation.x = PLAYER.bodyPitch;
  model.body.position.y = bob * 0.5;

  /* brake lights */
  const braking = input.brake > 0 || handbrake;
  model.mats.tailMat.emissiveIntensity = braking ? 1.5 : 0.12;
  model.mats.amberMat.emissiveIntensity = state.hazard ? (Math.sin(performance.now() / 160) > 0 ? 2.2 : 0) : 0.14;

  /* shadow follows */
  if (model.shadow) model.shadow.position.set(0, 0.035, 0);

  /* engine audio */
  updateEngineAudio(dt);

  updateDriveHUD(kmh, offroad, handbrake);
  updateCamera(dt, offroad);
  updateGPS(dt);
}

function updateDriveHUD(kmh, offroad, handbrake) {
  const speedEl = $("#speed");
  if (speedEl) speedEl.textContent = String(Math.round(kmh));
  const gearEl = $("#gear");
  if (gearEl) gearEl.textContent = state.gear < 0 ? "R" : state.gear === 0 ? "N" : String(state.gear);
  const odo = $("#odometer");
  if (odo) odo.textContent = state.odometer.toFixed(1) + " KM";
  const stateEl = $("#drive-state");
  if (stateEl) stateEl.textContent = handbrake ? "FREIO DE MÃO" : state.gear < 0 ? "RÉ" : kmh < 1 ? "PARADO" : offroad ? "FORA DO ASFALTO" : state.drifting ? "DERIVANDO" : "EM MOVIMENTO";
  const rpmBar = $("#rpm-bar");
  if (rpmBar) rpmBar.style.width = clamp((state.rpm - 600) / (CARS[state.car].sound.redline - 600) * 100, 0, 100) + "%";
  const drift = $("#drift-badge");
  if (drift) drift.classList.toggle("on", state.drifting);
  const cond = $("#hud-cond-bar");
  if (cond) cond.style.width = state.condition + "%";
  drawSpeedo(kmh);
}

/* ---------- camera ---------- */
const camTmp = new THREE.Vector3();
function updateCamera(dt, offroad) {
  if (!PLAYER.model) return;
  const model = PLAYER.model;
  const speed = Math.abs(state.speed);
  const maxSpeed = CARS[state.car].maxKmh / 3.6;
  const speedRatio = clamp(speed / maxSpeed, 0, 1);

  if (state.camera === "first") {
    const eye = model.eye;
    const shake = cameraShake * 0.5 + speedRatio * 0.006 + (offroad ? speedRatio * 0.03 : 0);
    const targetYaw = state.yaw + state.camOrbit * 0.5;
    camTmp.set(
      state.x + eye.x * Math.cos(state.yaw) + eye.z * Math.sin(state.yaw),
      eye.y + PATH_BOB(),
      state.z - eye.x * Math.sin(state.yaw) + eye.z * Math.cos(state.yaw)
    );
    camera.position.lerp(camTmp, 1 - Math.exp(-24 * dt));
    camera.position.y += Math.sin(performance.now() * 0.011) * shake * 0.2;
    camera.rotation.set(0, 0, 0);
    camera.lookAt(
      camera.position.x - Math.sin(targetYaw) * 20,
      camera.position.y + state.camHeight * 0.06 + shake * 0.4,
      camera.position.z - Math.cos(targetYaw) * 20
    );
    camera.fov = damp(camera.fov, 68 + speedRatio * 10, 3, dt);
  } else {
    const dist = (8.2 + speedRatio * 2.2) * state.camZoom;
    const height = (3.5 + speedRatio * 0.75 + state.camHeight) * (0.7 + state.camZoom * 0.3);
    const yaw = state.yaw + state.camOrbit;
    let cx = state.x + Math.sin(yaw) * dist;
    let cz = state.z + Math.cos(yaw) * dist;
    let cy = height;
    /* avoid clipping into buildings */
    const near = blockersNear(state.blockers, cx, cz, 2.4);
    for (const b of near) {
      const insideX = cx > b.minX - 1.6 && cx < b.maxX + 1.6;
      const insideZ = cz > b.minZ - 1.6 && cz < b.maxZ + 1.6;
      if (insideX && insideZ && b.h > cy) {
        cx = lerp(cx, state.x, 0.42);
        cz = lerp(cz, state.z, 0.42);
        cy = Math.max(cy, 2.4);
        break;
      }
    }
    camTmp.set(cx, cy, cz);
    camera.position.lerp(camTmp, 1 - Math.exp(-9 * dt));
    if (camera.position.y < 1.1) camera.position.y = 1.1;
    const shake = cameraShake;
    const lookY = 1.15 + state.camHeight * 0.1;
    camera.lookAt(
      state.x + Math.sin(state.yaw) * speedRatio * 3 + (Math.random() - 0.5) * shake * 0.4,
      lookY + (Math.random() - 0.5) * shake * 0.2,
      state.z + Math.cos(state.yaw) * speedRatio * 3
    );
    camera.fov = damp(camera.fov, 60 + speedRatio * 12, 3, dt);
  }
  if (camera.fov !== camera.userData.fov) {
    camera.userData.fov = camera.fov;
    camera.updateProjectionMatrix();
  }
  cameraShake = damp(cameraShake, 0, 6, dt);
  /* camera orbit returns to centre when moving */
  if (!state.pointer.dragging) state.camOrbit = damp(state.camOrbit, 0, 1.6 + speedRatio * 2.2, dt);
}

function PATH_BOB() {
  return Math.sin(performance.now() * 0.009) * 0.006 + Math.sin(performance.now() * 0.023) * 0.003;
}

/* ---------- speedometer ---------- */
function drawSpeedo(kmh) {
  const canvas = $("#speedo");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2 + W * 0.035, r = W * 0.352;
  ctx.clearRect(0, 0, W, H);
  const spec = CARS[state.car];
  const max = spec.maxKmh;
  const start = Math.PI * 0.78, end = Math.PI * 2.22;
  const val = clamp(Math.abs(kmh) / max, 0, 1);
  const span = end - start;

  /* base ring */
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = "rgba(232,244,240,.07)";
  ctx.lineWidth = W * 0.019;
  ctx.lineCap = "round";
  ctx.stroke();

  /* red zone */
  ctx.beginPath();
  ctx.arc(cx, cy, r, start + span * 0.9, end);
  ctx.strokeStyle = "rgba(255,122,112,.55)";
  ctx.lineWidth = W * 0.019;
  ctx.stroke();

  /* progress */
  if (val > 0.003) {
    const grad = ctx.createLinearGradient(cx - r, cy + r, cx + r, cy - r);
    grad.addColorStop(0, "#9fbf45");
    grad.addColorStop(0.55, "#d3fb68");
    grad.addColorStop(1, "#ffc383");
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + span * val);
    ctx.strokeStyle = grad;
    ctx.lineWidth = W * 0.019;
    ctx.shadowColor = "rgba(211,251,104,.5)";
    ctx.shadowBlur = W * 0.012;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ticks (bezel outside the ring) */
  const ticks = 16;
  for (let i = 0; i <= ticks; i++) {
    const a = start + span * (i / ticks);
    const major = i % 4 === 0;
    const on = i / ticks <= val + 0.001;
    const r1 = r + W * 0.036, r2 = r + W * (major ? 0.082 : 0.062);
    ctx.beginPath();
    ctx.strokeStyle = on ? "rgba(211,251,104," + (major ? 0.75 : 0.34) + ")" : "rgba(226,240,240," + (major ? 0.16 : 0.07) + ")";
    ctx.lineWidth = major ? 1.8 : 1;
    ctx.lineCap = "round";
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }

  /* tip */
  const na = start + span * val;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(na) * r, cy + Math.sin(na) * r, W * 0.014, 0, TAU);
  ctx.fillStyle = "#f8ffe8";
  ctx.shadowColor = "rgba(211,251,104,.9)";
  ctx.shadowBlur = W * 0.03;
  ctx.fill();
  ctx.shadowBlur = 0;
}

/* ---------- HUD car ---------- */
function updateCarHUD() {
  const spec = CARS[state.car];
  const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  set("#hud-car", spec.name);
  set("#hud-engine", spec.engine);
  set("#hud-drive", spec.driveTag);
  set("#home-car-name", spec.name);
  const paint = $("#hud-paint");
  if (paint) paint.style.background = spec.css;
  const dot = $("#garage-paint");
  if (dot) dot.style.background = spec.css;
}

/* ---------- showroom ---------- */
const SHOWROOM = {
  renderer: null, scene: null, camera: null, car: null, canvas: null,
  mount: null, rot: 0.6, dragging: false, lastX: 0, auto: 0, where: "hero", targetRot: 0.6
};

function initShowroom() {
  if (SHOWROOM.renderer) return;
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  cam.position.set(4.6, 2.5, 6.4);
  cam.lookAt(0, 0.7, 0);

  const hemi = new THREE.HemisphereLight(0xdff1ff, 0x1a2226, 0.9);
  sc.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2dc, 3.1);
  key.position.set(5, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6; key.shadow.camera.right = 6;
  key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
  key.shadow.normalBias = 0.02;
  sc.add(key);
  const rim = new THREE.DirectionalLight(0x9fe8ff, 2.6);
  rim.position.set(-6, 3.4, -4.5);
  sc.add(rim);
  const fill = new THREE.DirectionalLight(0xd3fb68, 0.7);
  fill.position.set(-2, 1.2, 6);
  sc.add(fill);
  const spot = new THREE.SpotLight(0xffffff, 6, 22, 0.6, 0.5, 1.4);
  spot.position.set(0, 7.5, 0);
  sc.add(spot);

  /* studio floor */
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0e161b, roughness: 0.36, metalness: 0.55, transparent: true, opacity: 0.95 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5.4, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.receiveShadow = true;
  sc.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.12, 64), new THREE.MeshBasicMaterial({ color: 0xd3fb68, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  sc.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.03, 64), new THREE.MeshBasicMaterial({ color: 0xd3fb68, transparent: true, opacity: 0.14, side: THREE.DoubleSide }));
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.004;
  sc.add(ring2);

  SHOWROOM.renderer = renderer;
  SHOWROOM.scene = sc;
  SHOWROOM.camera = cam;
  SHOWROOM.canvas = canvas;
  canvas.addEventListener("pointerdown", (e) => {
    SHOWROOM.dragging = true;
    SHOWROOM.lastX = e.clientX;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!SHOWROOM.dragging) return;
    SHOWROOM.targetRot += (e.clientX - SHOWROOM.lastX) * 0.012;
    SHOWROOM.lastX = e.clientX;
  });
  window.addEventListener("pointerup", () => { SHOWROOM.dragging = false; });
  setShowroomCar(state.car);
  mountShowroom("hero");
}

function mountShowroom(where) {
  initShowroom();
  SHOWROOM.where = where;
  const target = where === "garage" ? $("#showroom-garage") : $("#showroom-hero");
  if (!target || !SHOWROOM.canvas) return;
  if (SHOWROOM.canvas.parentNode !== target) target.appendChild(SHOWROOM.canvas);
  resizeShowroom();
}
function resizeShowroom() {
  if (!SHOWROOM.renderer) return;
  const el = SHOWROOM.canvas.parentNode;
  if (!el || !el.clientWidth) return;
  const w = el.clientWidth, h = el.clientHeight;
  SHOWROOM.renderer.setSize(w, h, false);
  SHOWROOM.camera.aspect = w / Math.max(1, h);
  SHOWROOM.camera.updateProjectionMatrix();
}
function setShowroomCar(type) {
  initShowroom();
  if (SHOWROOM.car) {
    SHOWROOM.scene.remove(SHOWROOM.car);
    SHOWROOM.car.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  const model = buildVehicle(type);
  model.root.rotation.y = 0;
  model.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  SHOWROOM.car = model.root;
  SHOWROOM.scene.add(model.root);
  const badge = $("#hero-badge");
  if (badge) badge.textContent = CARS[type].engine + " · " + CARS[type].maxKmh + " KM/H";
}
function renderShowroom(dt) {
  if (!SHOWROOM.renderer || !state.menu) return;
  const r = SHOWROOM.renderer;
  if (!SHOWROOM.canvas.parentNode || !SHOWROOM.canvas.parentNode.clientWidth) return;
  if (r.getSize(new THREE.Vector2()).x === 0) resizeShowroom();
  SHOWROOM.rot = damp(SHOWROOM.rot, SHOWROOM.targetRot, 5, dt);
  if (!SHOWROOM.dragging) SHOWROOM.targetRot += dt * 0.18;
  if (SHOWROOM.car) SHOWROOM.car.rotation.y = SHOWROOM.rot;
  const cam = SHOWROOM.camera;
  const zoom = state.camZoom || 1;
  cam.position.set(4.9 * zoom, 2.45, 6.6 * zoom);
  cam.lookAt(0, 0.72, 0);
  r.render(SHOWROOM.scene, cam);
}
