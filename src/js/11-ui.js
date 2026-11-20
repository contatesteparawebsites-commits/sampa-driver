/* ============================================================
   SAMPA DRIVER · 11 · interface, fluxo do jogo e loop principal
   ============================================================ */

let currentPage = "home";

function showPage(page) {
  currentPage = page;
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + page));
  $$(".rail-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  const stage = $(".stage");
  if (stage) stage.scrollTop = 0;
  if (page === "garage") { mountShowroom("garage"); setTimeout(resizeShowroom, 60); }
  else if (page === "home") { mountShowroom("hero"); setTimeout(resizeShowroom, 60); }
  if (page === "map") {
    BIGMAP.init = false;
    setTimeout(() => { drawBigMap(); refreshDestinations(); }, 80);
  }
  if (page === "garage") refreshGarage();
  playClick("tick");
}

function openMenu(page) {
  state.menu = true;
  state.paused = true;
  $("#app").classList.remove("hidden");
  $("#hud").classList.remove("active");
  $("#pause").classList.remove("open");
  document.body.classList.remove("photo");
  state.photo = false;
  showPage(page || "home");
  const btn = $("#btn-play");
  if (btn) btn.innerHTML = '<svg class="ico"><use href="#i-play"/></svg>' + (state.playing ? "CONTINUAR DIRIGINDO" : "DIRIGIR AGORA");
  saveGame();
}

function startGame() {
  audioResume();
  if (!PLAYER.model) spawnPlayerModel();
  state.menu = false;
  state.paused = false;
  state.playing = true;
  $("#app").classList.add("hidden");
  $("#hud").classList.add("active");
  $("#hud").setAttribute("aria-hidden", "false");
  document.body.classList.remove("photo");
  state.photo = false;
  applyCameraMode(true);
  updateGPSHud(true);
  updateCarHUD();
  refreshDestinations();
  setTimeout(() => { drawMinimap(); }, 60);
  const btn = $("#btn-play");
  if (btn) btn.innerHTML = '<svg class="ico"><use href="#i-play"/></svg>CONTINUAR DIRIGINDO';
  playClick("ok");
  saveGame();
  if (!state.hintShown) {
    state.hintShown = true;
    setTimeout(() => toast("W A S D para dirigir · C troca a câmera · H buzina"), 500);
  }
}

function pauseGame() {
  if (!state.playing || state.menu) return;
  state.paused = true;
  $("#pause").classList.add("open");
  const odo = $("#pause-odo");
  if (odo) odo.textContent = state.odometer.toFixed(1) + " KM";
  playClick("tick");
}
function resumeGame() {
  state.paused = false;
  $("#pause").classList.remove("open");
  playClick("tick");
}
function openMapFromGame() { pauseOrMenu("map"); }
function openGarageQuick() { pauseOrMenu("garage"); }
function pauseOrMenu(page) {
  $("#pause").classList.remove("open");
  openMenu(page);
}

function unstickCar() {
  const node = nearestNavNode(state.x, state.z, 8);
  if (node) {
    state.x = node.x; state.z = node.z;
    state.vx = 0; state.vz = 0; state.speed = 0;
    toast("Carro de volta no asfalto", "ok");
    playClick("ok");
  } else {
    toast("Não achei uma rua por perto", "warn");
  }
  $("#pause").classList.remove("open");
  state.paused = false;
}

function togglePhotoMode() {
  state.photo = !state.photo;
  document.body.classList.toggle("photo", state.photo);
  toast(state.photo ? "Modo foto — F para voltar à HUD" : "HUD de volta");
}

function selectCar(type) {
  if (!CARS[type]) return;
  state.car = type;
  state.settings.car = type;
  setShowroomCar(type);
  if (state.playing) spawnPlayerModel();
  updateCarHUD();
  refreshGarage();
  refreshQuickCars();
  playClick("tick");
  saveGame();
}

function refreshGarage() {
  const spec = CARS[state.car];
  const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  set("#garage-name", spec.name);
  set("#garage-eyebrow", spec.kind.toUpperCase());
  set("#garage-desc", spec.desc);
  set("#garage-tag", spec.name.toUpperCase() + " · " + spec.engine);
  set("#spec-speed", spec.maxKmh);
  set("#spec-accel", spec.bars.accel);
  set("#spec-grip", spec.bars.grip);
  set("#spec-weight", spec.mass + " kg");
  set("#spec-engine", spec.engine);
  set("#spec-drive", spec.driveTag);
  set("#spec-gears", spec.gearCount + " MARCHAS");
  const paint = $("#garage-paint");
  if (paint) paint.style.background = spec.css;
  const bars = $$(".spec u");
  const vals = [spec.bars.speed, spec.bars.accel, spec.bars.grip, spec.bars.weight];
  bars.forEach((b, i) => { if (vals[i] !== undefined) b.style.width = vals[i] + "%"; });
  $$("#garage-cards .car-card").forEach((c) => c.classList.toggle("active", c.dataset.car === state.car));
}

function refreshQuickCars() {
  const wrap = $("#quick-cars");
  if (!wrap) return;
  wrap.innerHTML = "";
  CAR_LIST.forEach((type) => {
    const spec = CARS[type];
    const btn = document.createElement("button");
    btn.className = "quick-car" + (state.car === type ? " active" : "");
    btn.innerHTML = '<i style="background:' + spec.css + '"></i><span>' + spec.name + "</span><small>" + spec.maxKmh + "</small>";
    btn.addEventListener("click", () => selectCar(type));
    wrap.appendChild(btn);
  });
}

function buildGarageCards() {
  const wrap = $("#garage-cards");
  if (!wrap) return;
  wrap.innerHTML = "";
  CAR_LIST.forEach((type) => {
    const spec = CARS[type];
    const card = document.createElement("button");
    card.className = "car-card" + (state.car === type ? " active" : "");
    card.dataset.car = type;
    card.innerHTML =
      '<div class="cc-check">✓</div>' +
      '<div class="cc-top"><div class="cc-swatch" style="background:' + spec.css + '"></div>' +
      "<div><b>" + spec.name + "</b><small>" + spec.engine + " · " + spec.driveTag + "</small></div></div>" +
      '<div class="cc-specs"><span>' + spec.maxKmh + " km/h</span><span>" + spec.gearCount + " marchas</span><span>" + spec.mass + " kg</span></div>";
    card.addEventListener("click", () => selectCar(type));
    wrap.appendChild(card);
  });
}

/* ---------- districts ---------- */
function buildDistrictSeg() {
  const seg = $("#district-seg");
  if (!seg) return;
  seg.innerHTML = "";
  Object.values(DISTRICTS).forEach((d) => {
    const b = document.createElement("button");
    b.textContent = d.short;
    b.dataset.district = d.id;
    b.className = d.id === state.district ? "active" : "";
    b.addEventListener("click", () => changeDistrict(d.id));
    seg.appendChild(b);
  });
}

async function changeDistrict(id) {
  if (state.district === id && CITY.visible) { toast("Você já está em " + DISTRICTS[id].short); return; }
  state.savedPos = state.playing ? { x: state.x, z: state.z } : null;
  clearRoute();
  toast("Carregando " + DISTRICTS[id].name + "…");
  await loadCity(id, { showLoader: true });
  if (state.playing) {
    spawnPlayerModel();
    applyCameraMode(true);
  }
  refreshDestinations();
  buildDistrictSeg();
  drawBigMap();
  toast(DISTRICTS[id].name + " carregada · " + state.stats.roads + " ruas", "ok");
}

/* ---------- settings ---------- */
function bindToggle(sel, key, after) {
  const el = $(sel);
  if (!el) return;
  el.classList.toggle("on", !!state.settings[key]);
  el.addEventListener("click", () => {
    state.settings[key] = !state.settings[key];
    el.classList.toggle("on", state.settings[key]);
    if (after) after(state.settings[key]);
    applyAudioSettings();
    saveGame();
    playClick("tick");
  });
}

function applyAllSettings() {
  const s = state.settings;
  const q = $("#set-quality");
  if (q) q.value = s.quality;
  const view = $("#set-view");
  if (view) view.value = s.view;
  const traffic = $("#set-traffic");
  if (traffic) traffic.value = s.traffic;
  const weather = $("#set-weather");
  if (weather) weather.value = s.weather;
  const hourSel = $("#set-hour");
  if (hourSel) {
    const h = String(Math.round(s.hour * 2) / 2);
    const opt = Array.prototype.slice.call(hourSel.options).find((o) => o.value === String(s.hour) || o.value === h);
    if (opt) hourSel.value = opt.value;
  }
  const camSel = $("#set-camera");
  if (camSel) camSel.value = s.camera;
  assignRange($("#set-sfx"), Math.round(s.sfx * 100));
  assignRange($("#set-sens"), Math.round(s.sens * 100));
  assignRange($("#set-music"), Math.round(s.music * 100));
  ["shadows", "timelapse", "autolight", "engine", "ambient", "assist", "save"].forEach((k) => {
    const el = $("#set-" + k);
    if (el) el.classList.toggle("on", !!s[k]);
  });
}

function setupSettings() {
  /* preenchimento dos sliders */
  const paintRanges = () => document.querySelectorAll('input[type=range]').forEach((r) => {
    const min = parseFloat(r.min || "0"), max = parseFloat(r.max || "100");
    const v = parseFloat(r.value || "0");
    r.style.setProperty("--p", (max > min ? ((v - min) / (max - min)) * 100 : 50).toFixed(1) + "%");
  });
  document.addEventListener("input", (e) => {
    if (e.target && e.target.type === "range") paintRanges();
  });
  paintRanges();
  const quality = $("#set-quality");
  if (quality) quality.addEventListener("change", () => {
    state.settings.quality = quality.value;
    setQuality(quality.value);
    saveGame();
  });
  const view = $("#set-view");
  if (view) view.addEventListener("change", () => { state.settings.view = view.value; setQuality(state.settings.quality); saveGame(); });
  const traffic = $("#set-traffic");
  if (traffic) traffic.addEventListener("change", () => { state.settings.traffic = traffic.value; buildTraffic(traffic.value); saveGame(); });
  const weather = $("#set-weather");
  if (weather) weather.addEventListener("change", () => {
    state.settings.weather = weather.value;
    updateSkyLight();
    if (weather.value === "rain") toast("Chuva em São Paulo · cuidado na pista");
    saveGame();
  });
  const hourSel = $("#set-hour");
  if (hourSel) hourSel.addEventListener("change", () => {
    state.hour = Number(hourSel.value);
    state.settings.hour = state.hour;
    updateSkyLight();
    saveGame();
  });
  const camSel = $("#set-camera");
  if (camSel) camSel.addEventListener("change", () => {
    state.settings.camera = camSel.value;
    if (state.playing) setCamera(camSel.value);
    saveGame();
  });

  bindToggle("#set-shadows", "shadows", () => setQuality(state.settings.quality));
  bindToggle("#set-timelapse", "timelapse");
  bindToggle("#set-autolight", "autolight");
  bindToggle("#set-engine", "engine", () => applyAudioSettings());
  bindToggle("#set-ambient", "ambient", () => applyAudioSettings());
  bindToggle("#set-assist", "assist");
  bindToggle("#set-save", "save", (v) => { if (v) saveGame(true); });

  const sfx = $("#set-sfx");
  if (sfx) sfx.addEventListener("input", () => {
    state.settings.sfx = Number(sfx.value) / 100;
    assignRange(sfx, Number(sfx.value));
    applyAudioSettings();
  });
  const music = $("#set-music");
  if (music) music.addEventListener("input", () => radioVolume(Number(music.value) / 100));
  const sens = $("#set-sens");
  if (sens) sens.addEventListener("input", () => {
    state.settings.sens = Number(sens.value) / 100;
    assignRange(sens, Number(sens.value));
    saveGame();
  });

  const reset = $("#btn-reset-save");
  if (reset) reset.addEventListener("click", () => {
    resetSave();
    state.odometer = 0;
    toast("Progresso apagado", "warn");
    playClick("err");
  });

  $("#quality-menu") && $("#quality-menu").addEventListener("click", () => {
    const order = ["high", "balanced", "low"];
    const next = order[(order.indexOf(state.settings.quality) + 1) % 3];
    state.settings.quality = next;
    setQuality(next);
    applyAllSettings();
    toast("Qualidade: " + ({ high: "alta", balanced: "equilibrada", low: "baixa" })[next]);
  });
}

/* ---------- radio wiring ---------- */
function setupRadioUI() {
  $$("#radio-tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.radio.source = tab.dataset.src;
      $$("#radio-tabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
      const label = $("#radio-url-label");
      const input = $("#radio-url");
      if (label) label.textContent = tab.dataset.src === "youtube" ? "LINK DA PLAYLIST DO YOUTUBE" : tab.dataset.src === "piped" ? "LINK DA PLAYLIST NO PIPED / YOUTUBE" : "LINK DIRETO DE ÁUDIO";
      if (input) input.placeholder = tab.dataset.src === "direct" ? "https://…/musica.mp3 ou stream" : "https://www.youtube.com/playlist?list=…";
      const hint = $("#radio-hint");
      if (hint) hint.textContent = tab.dataset.src === "youtube"
        ? "O player oficial do YouTube fica escondido atrás do jogo e só o áudio toca na cabine. Playlists privadas não funcionam."
        : tab.dataset.src === "piped"
          ? "O jogo consulta uma instância pública do Piped para extrair o áudio. Algumas instâncias podem estar fora do ar a qualquer momento."
          : "Aceita MP3, OGG, M4A ou URLs de rádio (streams). Precisa de CORS liberado para tocar dentro do jogo.";
      updateRadioUI();
      playClick("tick");
    });
  });
  const connect = $("#radio-connect");
  if (connect) connect.addEventListener("click", connectRadio);
  const url = $("#radio-url");
  if (url) {
    url.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); connectRadio(); } });
    url.value = state.radio.url || "";
  }
  const play = $("#radio-play");
  if (play) play.addEventListener("click", () => { audioResume(); if (!state.radio.mode) connectRadio(); else radioToggle(); });
  const next = $("#radio-next"), prev = $("#radio-prev");
  if (next) next.addEventListener("click", radioNext);
  if (prev) prev.addEventListener("click", radioPrev);
  const vol = $("#radio-volume");
  if (vol) vol.addEventListener("input", () => radioVolume(Number(vol.value) / 100));
  const hudPlay = $("#hud-radio-play");
  if (hudPlay) hudPlay.addEventListener("click", () => { audioResume(); if (!state.radio.mode) connectRadio(); else radioToggle(); });
  const hudNext = $("#hud-radio-next"), hudPrev = $("#hud-radio-prev");
  if (hudNext) hudNext.addEventListener("click", radioNext);
  if (hudPrev) hudPrev.addEventListener("click", radioPrev);
  $$(".preset").forEach((p) => {
    p.addEventListener("click", () => {
      const type = p.dataset.preset;
      const target = $(`#radio-tabs .tab[data-src="${type}"]`);
      if (target) target.click();
      const input = $("#radio-url");
      if (input) input.value = p.dataset.url;
      state.radio.source = type;
      state.radio.url = p.dataset.url;
      connectRadio();
    });
  });
  updateRadioVolumeUI();
}

/* ---------- HUD wiring ---------- */
function setupHUD() {
  const on = (sel, fn) => { const el = $(sel); if (el) el.addEventListener("click", (e) => { e.preventDefault(); fn(e); }); };
  on("#hud-pause", () => pauseGame());
  on("#hud-map", () => openMapFromGame());
  on("#hud-garage", () => openGarageQuick());
  on("#hud-photo", () => togglePhotoMode());
  on("#btn-camera", () => { toggleCamera(); });
  on("#t-camera", () => { toggleCamera(); });
  on("#btn-lights", () => setHeadlights(!state.lights));
  on("#btn-hazard", () => toggleHazard());
  on("#btn-horn", () => { audioResume(); playHorn(); });
  on("#t-horn", () => { audioResume(); playHorn(); });
  on("#paste-odo", () => {});
  const miniMode = $("#mini-mode");
  if (miniMode) miniMode.addEventListener("click", () => {
    state.mapNorth = !state.mapNorth;
    miniMode.textContent = state.mapNorth ? "N" : "↻";
    toast(state.mapNorth ? "Mapa travado no norte" : "Mapa girando com o carro");
  });
  const zi = $("#mini-zoom-in"), zo = $("#mini-zoom-out");
  if (zi) zi.addEventListener("click", () => { state.mapScale = clamp(state.mapScale * 1.3, 0.16, 2.4); });
  if (zo) zo.addEventListener("click", () => { state.mapScale = clamp(state.mapScale / 1.3, 0.16, 2.4); });
  const mm = $("#minimap");
  if (mm) mm.addEventListener("click", () => { state.mapNorth = !state.mapNorth; });
}

/* ---------- global buttons ---------- */
function setupGlobalUI() {
  $$("[data-page]").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.page === "home" && btn.classList.contains("rail-logo")) { showPage("home"); return; }
    showPage(btn.dataset.page);
  }));
  const play = $("#btn-play");
  if (play) play.addEventListener("click", startGame);
  const quit = $("#btn-quit-menu");
  if (quit) quit.addEventListener("click", () => {
    if (state.playing) { openMenu("home"); }
    else { startGame(); }
  });
  const fs = $("#btn-fullscreen");
  if (fs) fs.addEventListener("click", () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  });
  const snd = $("#btn-sound");
  if (snd) snd.addEventListener("click", () => {
    state.muted = !state.muted;
    snd.classList.toggle("off", state.muted);
    applyAudioSettings();
    toast(state.muted ? "Som desligado" : "Som ligado");
  });
  $("#hero-mount") && $("#hero-mount");
  const driveSelected = $("#btn-drive-selected");
  if (driveSelected) driveSelected.addEventListener("click", () => { selectCar(state.car); startGame(); });
  const hornPreview = $("#btn-horn-preview");
  if (hornPreview) hornPreview.addEventListener("click", () => { audioResume(); playHorn(); });

  /* pause modal */
  const p = {
    "#pause-close": () => { $("#pause").classList.remove("open"); state.paused = false; },
    "#pause-resume": () => resumeGame(),
    "#pause-garage": () => openMenu("garage"),
    "#pause-map": () => openMenu("map"),
    "#pause-settings": () => openMenu("settings"),
    "#pause-reset": () => unstickCar(),
    "#pause-menu": () => openMenu("home")
  };
  Object.keys(p).forEach((sel) => { const el = $(sel); if (el) el.addEventListener("click", p[sel]); });
  const pauseEl = $("#pause");
  if (pauseEl) pauseEl.addEventListener("click", (e) => { if (e.target === pauseEl) resumeGame(); });

  const reload = $("#btn-reload-city");
  if (reload) reload.addEventListener("click", async () => {
    state.savedPos = state.playing ? { x: state.x, z: state.z } : null;
    await loadCity(state.district, { showLoader: true });
    if (state.playing) spawnPlayerModel();
    refreshDestinations();
    drawBigMap();
    toast("Cidade recarregada");
  });
  const clearBtn = $("#btn-route-clear");
  if (clearBtn) clearBtn.addEventListener("click", () => { clearRoute(); drawBigMap(); });
  const homeRadioOpen = $("#home-radio-open");
  if (homeRadioOpen) homeRadioOpen.addEventListener("click", () => showPage("radio"));
}

/* ---------- menu camera ---------- */
let menuAngle = 0.6;
function updateMenuCamera(dt) {
  menuAngle += dt * 0.075;
  const r = 46 + Math.sin(menuAngle * 0.5) * 8;
  const y = 20 + Math.sin(menuAngle * 0.7) * 5;
  camera.position.lerp(new THREE.Vector3(state.x + Math.cos(menuAngle) * r, y, state.z + Math.sin(menuAngle) * r), 1 - Math.exp(-2 * dt));
  camera.lookAt(state.x, 3, state.z);
  camera.fov = damp(camera.fov, 58, 3, dt);
  camera.updateProjectionMatrix();
}

/* ---------- labels ---------- */
function updateLabels() {
  for (const l of state.hostLabels) {
    const d = dist2(camera.position.x, camera.position.z, l.x, l.z);
    const s = l.sprite;
    s.visible = d < 1400;
    if (s.visible) {
      const k = clamp(d / 90, 1.2, 7);
      s.scale.set(30 * 0.6 + k * 3, 7.5 * 0.6 + k * 0.75, 1);
      s.material.opacity = clamp(1.15 - d / 1400, 0.1, 0.95);
    }
  }
}

/* ---------- fit ---------- */
function fitCanvasToParent(canvas) {
  if (!canvas || !canvas.parentNode) return false;
  const w = canvas.parentNode.clientWidth, h = canvas.parentNode.clientHeight;
  if (!w || !h) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  return true;
}

/* ---------- main loop ---------- */
let lastMinimap = 0, lastMapDraw = 0, lastViz = 0, fpsAcc = 0, fpsFrames = 0, lastStatOdo = 0;
function animateLoop() {
  requestAnimationFrame(animateLoop);
  if (!renderer || !scene) return;
  const dt = Math.min(clock.getDelta(), 0.06);
  pollGamepad();

  const driving = state.playing && !state.paused && !state.menu;
  if (driving) updateDrive(dt);
  else if (state.menu) updateMenuCamera(dt);
  else if (state.paused) { /* frozen */ }

  if (!state.menu) {
    updateTraffic(dt);
    updateTrafficLights(dt);
  }
  updateEnvironment(dt);
  updateLabels();

  if (state.routeLine && state.routeLine.material.map) {
    state.routeLine.material.map.offset.x -= dt * 0.55;
  }
  if (state.destBeacon) {
    state.destBeacon.rotation.y += dt * 0.9;
    state.destBeacon.children[0].material.opacity = 0.18 + Math.sin(performance.now() / 420) * 0.08;
  }

  renderer.render(scene, camera);

  if (state.menu) {
    renderShowroom(dt);
    if (currentPage === "map" && performance.now() - lastMapDraw > 60) { lastMapDraw = performance.now(); drawBigMap(); }
    if (currentPage === "radio" && performance.now() - lastViz > 40) { lastViz = performance.now(); drawRadioViz(dt); }
  }
  if (state.playing && !state.menu && performance.now() - lastMinimap > 70) {
    lastMinimap = performance.now();
    drawMinimap();
  }
  if (state.playing && performance.now() - lastStatOdo > 500) {
    lastStatOdo = performance.now();
    const so = $("#stat-odo");
    if (so) so.textContent = state.odometer.toFixed(1) + " KM";
  }
  if (RADIO.mode === "youtube" && state.radio.playing && performance.now() - RADIO.titleTimer > 2400) {
    RADIO.titleTimer = performance.now();
    pollYouTubeTitle();
  }

  /* keep canvas sizes in sync */
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 1) { state.fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
}

/* ============================================================
   BOOT
   ============================================================ */
function bootStep(pct, message) {
  const fill = $("#boot-fill");
  if (fill) fill.style.width = pct + "%";
  const p = $("#boot-percent");
  if (p) p.textContent = Math.round(pct) + "%";
  const s = $("#boot-status");
  if (s) s.textContent = message;
}

async function boot() {
  const t0 = performance.now();
  try {
    bootStep(5, "Preparando texturas e motor 3D…");
    loadGame();
    state.weather = state.settings.weather;
    state.hour = Number.isFinite(state.settings.hour) ? state.settings.hour : 16;
    if (!state.settings.car) state.settings.car = state.car;
    makeSurfaceTextures();
    await new Promise((r) => setTimeout(r, 30));

    bootStep(16, "Iniciando renderizador WebGL…");
    initRenderer();
    setQuality(state.settings.quality);

    bootStep(30, "Montando sua São Paulo…");
    state.origin = districtOrigin(DISTRICTS[state.district]);
    state.landmarkZones = districtLandmarkZones(DISTRICTS[state.district]);
    buildFallbackCity(DISTRICTS[state.district]);
    updateCityUI();
    await new Promise((r) => setTimeout(r, 20));

    bootStep(52, "Ligando o carro…");
    spawnPlayerModel();
    state.camera = state.settings.camera || "third";
    applyCameraMode(true);

    bootStep(64, "Sintonizando a rádio e os mapas…");
    initRadio();
    initShowroom();
    setupInput();
    setupGlobalUI();
    setupSettings();
    setupRadioUI();
    setupHUD();
    setupBigMap();
    buildGarageCards();
    buildDistrictSeg();
    refreshQuickCars();
    refreshGarage();
    applyAllSettings();
    updateRadioUI();
    updateCarHUD();
    updateSkyLight();

    bootStep(80, "Preparando a navegação e o GPS…");
    refreshDestinations();
    updateGPSHud(true);
    mountShowroom("hero");
    setTimeout(resizeShowroom, 120);
    drawBigMap();
    await new Promise((r) => setTimeout(r, 40));

    bootStep(94, "Abrindo as ruas de São Paulo…");
    state.menu = true;
    state.paused = false;
    state.playing = false;
    $("#hud").classList.remove("active");

    clock.getDelta();
    animateLoop();

    bootStep(100, "Tudo pronto. Bom rolê!");
    $("#boot").classList.add("done");
    setTimeout(() => { const b = $("#boot"); if (b) b.style.display = "none"; }, 900);
    toast("Bem-vindo a São Paulo. Escolha seu carro e caia na rua.", "ok");
    playClick("ok");

    /* real map in the background, without blocking the menu */
    setNetBadge("loading");
    loadCity(state.district, { fast: false, instantFallback: false }).then((res) => {
      if (res.ok) {
        toast("Mapa real carregado · " + state.stats.roads + " ruas e " + state.stats.buildings + " prédios", "ok");
        if (state.playing) { spawnPlayerModel(); applyCameraMode(true); }
        refreshDestinations();
        drawBigMap();
        buildDistrictSeg();
      } else {
        toast("OpenStreetMap indisponível · modo local ativo", "warn");
      }
      updateCityUI();
    }).catch((err) => {
      console.warn(err);
      setNetBadge("bad");
    });
    console.info("SAMPA DRIVER pronto em " + Math.round(performance.now() - t0) + "ms");
  } catch (err) {
    console.error("Falha ao iniciar:", err);
    bootStep(100, "Erro ao iniciar o 3D");
    const s = $("#boot-status");
    if (s) s.textContent = "Não foi possível iniciar o WebGL. Atualize a página ou use outro navegador. (" + (err && err.message ? err.message : "erro") + ")";
    const b = $("#boot");
    if (b) setTimeout(() => b.classList.add("done"), 2500);
  }
}

/* hook de depuração (também útil no console do navegador) */
window.SAMPA = {
  state, CARS, DISTRICTS, TEXCACHE, BIGMAP, buildVehicle, spawnPlayerModel,
  setDestination, clearRoute, findRoute, loadCity, selectCar, startGame, openMenu,
  drawMinimap, drawBigMap, drawSpeedo, drawRadioViz, getFacadeTextures, makeSurfaceTextures,
  updateTraffic, updateTrafficLights, buildTraffic, updateGPS, updateGPSHud,
  buildFallbackCity, buildCityFromOSM, updateSkyLight, setQuality, spawnPlayerModel,
  ensureClearSpawn, nearestRoadPoint,
  get city() { return CITY; },
  get camera() { return camera; },
  get scene() { return scene; },
  get renderer() { return renderer; },
  get player() { return PLAYER; },
  get traffic() { return TRAFFIC; },
  get route() { return state.route; }
};

window.addEventListener("load", () => {
  if (!window.THREE) {
    const s = $("#boot-status");
    if (s) s.textContent = "Biblioteca 3D não carregou. Recarregue a página.";
    return;
  }
  boot();
});
