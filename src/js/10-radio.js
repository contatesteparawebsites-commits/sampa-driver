/* ============================================================
   SAMPA DRIVER · 10 · rádio própria (música eletrônica sintetizada)
   Nenhum link, nenhum streaming: o som é gerado no WebAudio.
   ============================================================ */

const STATIONS = [
  {
    id: "sampa-house",
    name: "SAMPA HOUSE",
    genre: "deep house · 124 BPM",
    bpm: 124,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
    bass: [40, 0, 0, 40, 0, 0, 43, 0, 38, 0, 0, 40, 0, 0, 45, 0],
    chord: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    arp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    padEvery: 32
  },
  {
    id: "techno-011",
    name: "TECHNO 011",
    genre: "techno · 132 BPM",
    bpm: 132,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1],
    bass: [33, 0, 33, 0, 0, 33, 0, 0, 33, 0, 33, 0, 0, 33, 0, 33],
    chord: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    arp: [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1],
    padEvery: 16
  },
  {
    id: "eletro-brasil",
    name: "ELETRO BRASIL",
    genre: "brazilian electro · 112 BPM",
    bpm: 112,
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    clap: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
    hat: [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1],
    bass: [38, 0, 0, 41, 0, 43, 0, 0, 38, 0, 0, 45, 0, 41, 0, 0],
    chord: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    arp: [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
    padEvery: 32
  },
  {
    id: "lofi-paulista",
    name: "LO-FI PAULISTA",
    genre: "lo-fi · 82 BPM",
    bpm: 82,
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
    bass: [36, 0, 0, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0, 39, 0],
    chord: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    arp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    padEvery: 16,
    vinyl: true
  }
];

const RADIO = {
  ctx: null, out: null, analyser: null, data: null, delay: null,
  timer: 0, nextTime: 0, step: 0, bar: 0,
  station: 0, playing: false, volume: 0.72, started: false,
  energy: 0, vizPhase: 0, titleTimer: 0, mode: null,
  noise: null
};

/* ---------- helpers de síntese ---------- */
function radioCtx() {
  if (RADIO.ctx) return RADIO.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC();
    RADIO.ctx = ctx;
    const out = ctx.createGain();
    out.gain.value = RADIO.volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.72;
    out.connect(analyser);
    analyser.connect(ctx.destination);
    RADIO.out = out;
    RADIO.analyser = analyser;
    RADIO.data = new Uint8Array(analyser.frequencyBinCount);
    /* delay para dar espaço ao lead */
    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 0.28;
    delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(out);
    RADIO.delay = delay;
    /* buffer de ruído reaproveitado */
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    RADIO.noise = buf;
    return ctx;
  } catch (e) {
    console.warn("rádio indisponível:", e && e.message);
    return null;
  }
}

const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

function envGain(ctx, at, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

function rKick(ctx, at, gain) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(155, at);
  o.frequency.exponentialRampToValueAtTime(46, at + 0.12);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
  o.connect(g); g.connect(RADIO.out);
  o.start(at); o.stop(at + 0.4);
  /* click de ataque */
  const n = ctx.createBufferSource(); n.buffer = RADIO.noise;
  const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 1800;
  const ng = envGain(ctx, at, gain * 0.22, 0.002, 0.03);
  n.connect(nf); nf.connect(ng); ng.connect(RADIO.out);
  n.start(at); n.stop(at + 0.06);
}

function rNoise(ctx, at, gain, type, freq, q, dur) {
  const n = ctx.createBufferSource();
  n.buffer = RADIO.noise;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
  const g = envGain(ctx, at, gain, 0.002, dur);
  n.connect(f); f.connect(g); g.connect(RADIO.out);
  n.start(at); n.stop(at + dur + 0.1);
}

function rBass(ctx, at, note, dur, gain) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = "sawtooth"; o2.type = "square";
  o.frequency.value = midiHz(note);
  o2.frequency.value = midiHz(note - 12);
  f.type = "lowpass";
  f.frequency.setValueAtTime(320, at);
  f.frequency.exponentialRampToValueAtTime(150, at + dur);
  f.Q.value = 6;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(RADIO.out);
  o.start(at); o.stop(at + dur + 0.05);
  o2.start(at); o2.stop(at + dur + 0.05);
}

function rChord(ctx, at, notes, dur, gain) {
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(900, at);
  f.frequency.linearRampToValueAtTime(1750, at + dur * 0.5);
  f.frequency.linearRampToValueAtTime(700, at + dur);
  f.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + Math.min(0.35, dur * 0.35));
  g.gain.linearRampToValueAtTime(0.0001, at + dur);
  f.connect(g);
  g.connect(RADIO.out);
  if (RADIO.delay) g.connect(RADIO.delay);
  notes.forEach((n, i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? "triangle" : "sawtooth";
    o.frequency.value = midiHz(n);
    o.detune.value = (i - 1) * 7;
    o.connect(f);
    o.start(at); o.stop(at + dur + 0.1);
  });
}

function rLead(ctx, at, note, dur, gain) {
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = midiHz(note);
  f.type = "lowpass"; f.frequency.value = 2600; f.Q.value = 3;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(f); f.connect(g); g.connect(RADIO.out);
  if (RADIO.delay) g.connect(RADIO.delay);
  o.start(at); o.stop(at + dur + 0.05);
}

/* progressões (ré menor / lá menor, conforme a estação) */
const PROGRESSIONS = [
  [[50, 53, 57, 60], [48, 52, 55, 59], [46, 50, 53, 57], [48, 52, 55, 58]],
  [[45, 48, 52, 55], [43, 46, 50, 53], [41, 45, 48, 52], [43, 46, 50, 53]],
  [[43, 47, 50, 53], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 54]],
  [[48, 52, 55, 59], [45, 48, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53]]
];

/* ---------- sequenciador ---------- */
function scheduleStep(st, when, step, bar) {
  const ctx = RADIO.ctx;
  const s = step % 16;
  const st16 = 60 / st.bpm / 4;
  if (st.kick[s]) rKick(ctx, when, 0.85);
  if (st.clap[s]) rNoise(ctx, when, 0.22, "bandpass", 1900, 1.4, 0.12);
  if (st.hat[s]) rNoise(ctx, when, s % 4 === 0 ? 0.1 : 0.055, "highpass", 8200, 0.7, 0.035);
  if (st.bass[s]) rBass(ctx, when, st.bass[s], st16 * 2.1, 0.16);
  if (st.arp[s]) rLead(ctx, when, st.arp === null ? 0 : (PROGRESSIONS[RADIO.station][bar % 4][(s + 1) % 4] + 12), st16 * 1.4, 0.06);
  if (st.chord[s]) {
    const ch = PROGRESSIONS[RADIO.station][bar % 4];
    rChord(ctx, when, ch, st16 * 14, 0.075);
  }
  if (step % st.padEvery === 0) {
    const ch = PROGRESSIONS[RADIO.station][bar % 4];
    rChord(ctx, when, ch.map((n) => n + 12), st16 * st.padEvery * 0.95, 0.035);
  }
  if (st.vinyl && step % 4 === 0) rNoise(ctx, when, 0.012, "lowpass", 2400, 0.6, 0.3);
}

function radioTick() {
  if (!RADIO.playing || !RADIO.ctx) return;
  const st = STATIONS[RADIO.station];
  const stepDur = 60 / st.bpm / 4;
  const now = RADIO.ctx.currentTime;
  if (RADIO.nextTime < now) RADIO.nextTime = now + 0.05;
  while (RADIO.nextTime < now + 0.18) {
    if (RADIO.step % 16 === 0) RADIO.bar++;
    scheduleStep(st, RADIO.nextTime, RADIO.step, RADIO.bar);
    RADIO.step++;
    RADIO.nextTime += stepDur;
  }
}

/* ---------- API ---------- */
function radioStation() { return STATIONS[RADIO.station]; }

function radioPlay() {
  const ctx = radioCtx();
  if (!ctx) return false;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (RADIO.playing) return true;
  RADIO.playing = true;
  RADIO.mode = "synth";
  RADIO.nextTime = ctx.currentTime + 0.08;
  RADIO.step = 0;
  RADIO.bar = 0;
  if (!RADIO.timer) RADIO.timer = setInterval(radioTick, 25);
  state.radio.playing = true;
  updateRadioUI();
  return true;
}

function radioStop() {
  RADIO.playing = false;
  state.radio.playing = false;
  if (RADIO.timer) { clearInterval(RADIO.timer); RADIO.timer = 0; }
  updateRadioUI();
}

function radioToggle() {
  if (RADIO.playing) radioStop(); else { audioResume(); radioPlay(); }
  playClick("tick");
}

function connectRadio() { audioResume(); radioPlay(); }

function radioNext() {
  RADIO.station = (RADIO.station + 1) % STATIONS.length;
  state.radio.station = RADIO.station;
  if (RADIO.playing) { RADIO.step = 0; RADIO.bar = 0; RADIO.nextTime = RADIO.ctx ? RADIO.ctx.currentTime + 0.05 : 0; }
  updateRadioUI();
  toast(radioStation().name + " · " + radioStation().genre, "ok");
  playClick("tick");
}

function radioPrev() {
  RADIO.station = (RADIO.station + STATIONS.length - 1) % STATIONS.length;
  state.radio.station = RADIO.station;
  if (RADIO.playing) { RADIO.step = 0; RADIO.bar = 0; RADIO.nextTime = RADIO.ctx ? RADIO.ctx.currentTime + 0.05 : 0; }
  updateRadioUI();
  toast(radioStation().name + " · " + radioStation().genre, "ok");
  playClick("tick");
}

function radioSelect(index) {
  if (index === RADIO.station && RADIO.playing) { radioToggle(); return; }
  RADIO.station = clamp(index, 0, STATIONS.length - 1);
  state.radio.station = RADIO.station;
  RADIO.step = 0; RADIO.bar = 0;
  if (RADIO.ctx) RADIO.nextTime = RADIO.ctx.currentTime + 0.05;
  audioResume();
  radioPlay();
  playClick("tick");
}

function radioVolume(value) {
  RADIO.volume = clamp(value, 0, 1);
  state.radio.volume = RADIO.volume;
  if (RADIO.out) RADIO.out.gain.setTargetAtTime(RADIO.volume, RADIO.ctx.currentTime, 0.05);
  updateRadioVolumeUI();
}

function updateRadioVolumeUI() {
  const v = Math.round(RADIO.volume * 100);
  const label = $("#radio-volume-label");
  if (label) label.textContent = String(v);
  const slider = $("#radio-volume");
  if (slider && String(slider.value) !== String(v)) slider.value = String(v);
  const hud = $("#hud-radio-vol");
  if (hud) hud.textContent = v + "%";
}

function updateRadioUI() {
  const st = radioStation();
  const title = $("#radio-title");
  if (title) title.textContent = RADIO.playing ? st.name : "Rádio desligada";
  const sub = $("#radio-sub");
  if (sub) sub.textContent = RADIO.playing ? st.genre + " · gerado ao vivo" : "Escolha uma estação para tocar";
  const label = $("#radio-source-label");
  if (label) label.textContent = "SAMPA FM · ESTAÇÕES DO JOGO";
  const hudTitle = $("#hud-radio-title");
  if (hudTitle) hudTitle.textContent = RADIO.playing ? st.name : "Rádio desligada";
  const hudTrack = $("#hud-track");
  if (hudTrack) hudTrack.textContent = RADIO.playing ? st.name : "Rádio desligado";
  const hudEq = $("#hud-eq");
  if (hudEq) hudEq.classList.toggle("playing", RADIO.playing);
  const hudSub = $("#hud-radio-sub");
  if (hudSub) hudSub.textContent = RADIO.playing ? st.genre : "Toque para sintonizar";
  const homeTitle = $("#home-radio-title");
  if (homeTitle) homeTitle.textContent = RADIO.playing ? st.name : "Desligado";
  const homeSub = $("#home-radio-sub");
  if (homeSub) homeSub.textContent = RADIO.playing ? st.genre : "4 estações de música eletrônica";
  const eq = $("#home-eq");
  if (eq) eq.classList.toggle("playing", RADIO.playing);
  const status = $("#radio-status");
  if (status) {
    const tag = status.querySelector("b") || status.querySelector("span");
    if (tag) tag.textContent = RADIO.playing ? "no ar" : "parada";
    status.classList.toggle("on", RADIO.playing);
  }
  $$("#radio-stations .station").forEach((card, i) => {
    card.classList.toggle("active", i === RADIO.station);
    card.classList.toggle("playing", i === RADIO.station && RADIO.playing);
  });
  const playIcon = $("#radio-play");
  if (playIcon) playIcon.classList.toggle("paused", !RADIO.playing);
}

function initRadio() {
  RADIO.volume = clamp(state.settings.music !== undefined ? state.settings.music : 0.72, 0, 1);
  state.radio.volume = RADIO.volume;
  state.radio.playing = false;
  state.radio.mode = null;
  updateRadioUI();
  updateRadioVolumeUI();
}

/* mantido por compatibilidade: nada é baixado da internet */
function pollYouTubeTitle() {}
function startPiped() {}
function playAudioUrl() {}

/* ---------- visualizador ---------- */
function drawRadioViz(dt) {
  const canvas = $("#radio-viz");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (!cw || !ch) return;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  let bins = null;
  if (RADIO.analyser && RADIO.playing) {
    RADIO.analyser.getByteFrequencyData(RADIO.data);
    bins = RADIO.data;
  }
  RADIO.vizPhase += dt * (RADIO.playing ? 2.6 : 0.5);
  const bars = Math.max(20, Math.min(56, Math.floor(cw / 12)));
  const base = ch * 0.9;
  const unit = cw / bars;
  for (let i = 0; i < bars; i++) {
    let level;
    if (bins) {
      const idx = Math.floor(Math.pow(i / bars, 1.4) * (bins.length - 1));
      level = bins[idx] / 255;
    } else {
      level = 0.06 + Math.abs(Math.sin(i * 0.4 + RADIO.vizPhase)) * 0.05;
    }
    const h = Math.max(3, Math.pow(level, 1.15) * ch * 0.72 + 3);
    const x = i * unit + unit * 0.22;
    const w = unit * 0.56;
    const g = ctx.createLinearGradient(0, base - h, 0, base);
    g.addColorStop(0, "rgba(211,251,104,.95)");
    g.addColorStop(0.55, "rgba(160,240,190,.7)");
    g.addColorStop(1, "rgba(121,230,221,.22)");
    ctx.fillStyle = g;
    roundRect(ctx, x, base - h, w, h, Math.min(w / 2, 3));
    ctx.fill();
    ctx.globalAlpha = 0.13;
    const g2 = ctx.createLinearGradient(0, base, 0, base + h * 0.45);
    g2.addColorStop(0, "rgba(121,230,221,.6)");
    g2.addColorStop(1, "rgba(121,230,221,0)");
    ctx.fillStyle = g2;
    roundRect(ctx, x, base, w, h * 0.45, Math.min(w / 2, 3));
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.moveTo(0, base + 0.5);
  ctx.lineTo(cw, base + 0.5);
  ctx.strokeStyle = "rgba(211,251,104,.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
