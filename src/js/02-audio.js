/* ============================================================
   SAMPA DRIVER · 02 · áudio procedural
   ============================================================ */
const AUDIO = {
  ctx: null, master: null, engine: null, wind: null, tires: null, rain: null, ambience: null,
  noiseBuffer: null, started: false, unlocked: false
};

function audioNoiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * (seconds || 2));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = 0.96 * last + 0.04 * white;
    d[i] = last * 2.2 + white * 0.25;
  }
  return buf;
}

function initAudio() {
  if (AUDIO.ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    const ctx = new AC();
    AUDIO.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.65;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    master.connect(comp);
    comp.connect(ctx.destination);
    AUDIO.master = master;
    AUDIO.noiseBuffer = audioNoiseBuffer(ctx, 2.4);

    /* --- engine --- */
    const eg = ctx.createGain(); eg.gain.value = 0.0001;
    const ef = ctx.createBiquadFilter(); ef.type = "lowpass"; ef.frequency.value = 620; ef.Q.value = 1.6;
    const osc1 = ctx.createOscillator(); osc1.type = "sawtooth"; osc1.frequency.value = 70;
    const osc2 = ctx.createOscillator(); osc2.type = "square"; osc2.frequency.value = 35; osc2.detune.value = 6;
    const osc3 = ctx.createOscillator(); osc3.type = "triangle"; osc3.frequency.value = 140;
    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.32;
    const g3 = ctx.createGain(); g3.gain.value = 0.14;
    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3);
    g1.connect(ef); g2.connect(ef); g3.connect(ef);
    /* intake air noise */
    const air = ctx.createBufferSource(); air.buffer = AUDIO.noiseBuffer; air.loop = true;
    const airF = ctx.createBiquadFilter(); airF.type = "bandpass"; airF.frequency.value = 900; airF.Q.value = 0.8;
    const airG = ctx.createGain(); airG.gain.value = 0;
    air.connect(airF); airF.connect(airG); airG.connect(eg);
    ef.connect(eg); eg.connect(master);
    osc1.start(); osc2.start(); osc3.start(); air.start();

    /* --- wind --- */
    const wn = ctx.createBufferSource(); wn.buffer = AUDIO.noiseBuffer; wn.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = "lowpass"; wf.frequency.value = 480;
    const wg = ctx.createGain(); wg.gain.value = 0;
    wn.connect(wf); wf.connect(wg); wg.connect(master); wn.start();

    /* --- tires --- */
    const tn = ctx.createBufferSource(); tn.buffer = AUDIO.noiseBuffer; tn.loop = true;
    const tf = ctx.createBiquadFilter(); tf.type = "bandpass"; tf.frequency.value = 2100; tf.Q.value = 5;
    const tg = ctx.createGain(); tg.gain.value = 0;
    tn.connect(tf); tf.connect(tg); tg.connect(master); tn.start();

    /* --- rain --- */
    const rn = ctx.createBufferSource(); rn.buffer = AUDIO.noiseBuffer; rn.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = "highpass"; rf.frequency.value = 1400;
    const rg = ctx.createGain(); rg.gain.value = 0;
    rn.connect(rf); rf.connect(rg); rg.connect(master); rn.start();

    /* --- city ambience --- */
    const an = ctx.createBufferSource(); an.buffer = AUDIO.noiseBuffer; an.loop = true;
    const af = ctx.createBiquadFilter(); af.type = "lowpass"; af.frequency.value = 320;
    const ag = ctx.createGain(); ag.gain.value = 0.05;
    an.connect(af); af.connect(ag); ag.connect(master); an.start();

    AUDIO.engine = { gain: eg, filter: ef, osc1, osc2, osc3, g1, g2, g3, airG, airF };
    AUDIO.wind = { gain: wg, filter: wf };
    AUDIO.tires = { gain: tg, filter: tf };
    AUDIO.rain = { gain: rg };
    AUDIO.ambience = { gain: ag };
    AUDIO.started = true;
    applyAudioSettings();
    return true;
  } catch (err) {
    console.warn("Audio indisponível:", err);
    return false;
  }
}

function audioResume() {
  if (!AUDIO.ctx) initAudio();
  if (AUDIO.ctx && AUDIO.ctx.state === "suspended") AUDIO.ctx.resume().catch(() => {});
  AUDIO.unlocked = true;
}

function applyAudioSettings() {
  if (!AUDIO.ctx) return;
  const s = state.settings;
  const vol = (s.sfx || 0) * (state.muted ? 0 : 1);
  AUDIO.master.gain.setTargetAtTime(0.72 * vol, AUDIO.ctx.currentTime, 0.08);
  if (AUDIO.ambience) AUDIO.ambience.gain.gain.setTargetAtTime(s.ambient ? 0.055 : 0, AUDIO.ctx.currentTime, 0.2);
  if (AUDIO.rain) AUDIO.rain.gain.gain.setTargetAtTime(state.weather === "rain" ? 0.16 : 0, AUDIO.ctx.currentTime, 0.4);
  if (AUDIO.engine) AUDIO.engine.gain.gain.setTargetAtTime(s.engine ? 0.55 : 0.0001, AUDIO.ctx.currentTime, 0.3);
}

/* rpm / throttle → engine timbre */
function updateEngineAudio(dt) {
  if (!AUDIO.ctx || !AUDIO.engine) return;
  if (!state.settings.engine || state.muted || !state.playing) {
    AUDIO.engine.gain.gain.setTargetAtTime(0.0001, AUDIO.ctx.currentTime, 0.12);
    AUDIO.wind.gain.gain.setTargetAtTime(0, AUDIO.ctx.currentTime, 0.15);
    AUDIO.tires.gain.gain.setTargetAtTime(0, AUDIO.ctx.currentTime, 0.1);
    return;
  }
  const t = AUDIO.ctx.currentTime;
  const spec = CARS[state.car];
  const snd = spec.sound;
  const rpmNorm = clamp((state.rpm - snd.idle) / (snd.redline - snd.idle), 0, 1.15);
  const f = 26 + rpmNorm * 132 + (snd.style === "jeep" ? -4 : 0);
  AUDIO.engine.osc1.frequency.setTargetAtTime(f, t, 0.055);
  AUDIO.engine.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
  AUDIO.engine.osc3.frequency.setTargetAtTime(f * 2.02, t, 0.05);
  const open = 0.16 + state.throttle * 0.62 + rpmNorm * 0.24;
  AUDIO.engine.filter.frequency.setTargetAtTime(340 + rpmNorm * 2100 + state.throttle * 500, t, 0.08);
  AUDIO.engine.airG.gain.setTargetAtTime(0.05 + state.throttle * 0.16, t, 0.09);
  const level = (0.035 + state.throttle * 0.05 + rpmNorm * 0.032) * (0.7 + open * 0.5) * (spec.sound.loud || 0.7);
  AUDIO.engine.gain.gain.setTargetAtTime(level, t, 0.07);

  const sp = Math.abs(state.speed) * 3.6;
  AUDIO.wind.gain.gain.setTargetAtTime(Math.min(0.09, (sp / 240) * 0.075), t, 0.2);
  AUDIO.wind.filter.frequency.setTargetAtTime(300 + sp * 5.5, t, 0.2);
  const slip = state.slip || 0;
  AUDIO.tires.gain.gain.setTargetAtTime(clamp(slip * 0.09, 0, 0.115), t, 0.07);
  AUDIO.tires.filter.frequency.setTargetAtTime(1700 + slip * 900, t, 0.1);
}

/* one shot helpers */
function blip(freq, dur, type, level, slideTo) {
  if (!AUDIO.ctx || state.muted) return;
  const ctx = AUDIO.ctx, t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level || 0.05, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AUDIO.master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noiseBurst(dur, freq, q, level) {
  if (!AUDIO.ctx || state.muted) return;
  const ctx = AUDIO.ctx, t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = AUDIO.noiseBuffer;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q || 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level || 0.08, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(AUDIO.master);
  src.start(t); src.stop(t + dur + 0.05);
}
function playHorn() {
  audioResume();
  if (!AUDIO.ctx) return;
  const spec = CARS[state.car].sound;
  const ctx = AUDIO.ctx, t = ctx.currentTime;
  const dur = 0.55;
  spec.horn.forEach((freq, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = i === 0 ? "sawtooth" : "square";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.setValueAtTime(freq * 1.005, t + 0.2);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055 * (spec.loud || 0.7), t + 0.03);
    g.gain.setValueAtTime(0.055 * (spec.loud || 0.7), t + dur - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(AUDIO.master);
    o.start(t); o.stop(t + dur + 0.02);
  });
  hornFlash();
}
let hornFlashTimer = 0;
function hornFlash() {
  const btn = $("#btn-horn");
  if (!btn) return;
  btn.classList.add("active");
  clearTimeout(hornFlashTimer);
  hornFlashTimer = setTimeout(() => btn.classList.remove("active"), 220);
}
function playClick(kind) {
  if (!AUDIO.ctx) return;
  if (state.muted) return;
  if (kind === "tick") { blip(1450, 0.035, "square", 0.018); return; }
  if (kind === "shift") { noiseBurst(0.06, 1600, 6, 0.035); return; }
  if (kind === "crash") { noiseBurst(0.24, 240, 1.4, 0.13); blip(90, 0.18, "sine", 0.07, 45); return; }
  if (kind === "ok") { blip(660, 0.09, "sine", 0.035); setTimeout(() => blip(990, 0.12, "sine", 0.03), 70); return; }
  if (kind === "err") { blip(220, 0.16, "square", 0.03, 160); return; }
  blip(520, 0.05, "sine", 0.022);
}
