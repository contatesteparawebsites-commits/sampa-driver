/* ============================================================
   SAMPA DRIVER · 08 · entrada (teclado, mouse, toque, controle)
   ============================================================ */
state.touch = { steer: 0, throttle: 0, brake: 0, active: false };
state.pad = { steer: 0, throttle: 0, brake: 0, connected: false };

function typingInField() {
  const el = document.activeElement;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
}

function keyName(e) {
  const k = e.key;
  if (k === " " || k === "Spacebar") return "space";
  return k.toLowerCase();
}

function onKeyDown(e) {
  const key = keyName(e);
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "space"].indexOf(key) >= 0 && state.playing) e.preventDefault();
  if (typingInField()) return;
  const first = !state.keys[key];
  state.keys[key] = true;
  if (key === " " || key === "space") state.keys.space = true;
  if (!first || e.repeat) return;

  if (key === "escape") {
    if (!state.menu) { if (state.paused) resumeGame(); else pauseGame(); }
    return;
  }
  if (key === "c" && state.playing && !state.paused) { toggleCamera(); return; }
  if (key === "h" && state.playing) { audioResume(); playHorn(); return; }
  if (key === "l") { setHeadlights(!state.lights); return; }
  if (key === "j") { toggleHazard(); return; }
  if (key === "f" && state.playing) { togglePhotoMode(); return; }
  if (key === "m" && state.playing) { openMapFromGame(); return; }
  if (key === "g" && state.playing) { openGarageQuick(); return; }
  if (key === "r" && state.playing) { unstickCar(); return; }
  if (key === "enter" && state.menu) { const btn = $("#btn-play"); if (btn) startGame(); return; }
  if (key === "p" && state.playing) { toggleRadio(); return; }
}

function onKeyUp(e) {
  const key = keyName(e);
  state.keys[key] = false;
  if (key === " " || key === "space") state.keys.space = false;
}

function setupKeyboard() {
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => { state.keys = Object.create(null); });
}

/* ---------- pointer look ---------- */
function setupPointer() {
  const canvas = $("#scene");
  if (!canvas) return;
  canvas.addEventListener("pointerdown", (e) => {
    if (!state.playing || state.paused) return;
    state.pointer.dragging = true;
    state.pointer.lastX = e.clientX;
    state.pointer.lastY = e.clientY;
    state.pointer.id = e.pointerId;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!state.pointer.dragging) return;
    const dx = e.clientX - state.pointer.lastX;
    const dy = e.clientY - state.pointer.lastY;
    state.pointer.lastX = e.clientX;
    state.pointer.lastY = e.clientY;
    if (!state.playing || state.paused) return;
    state.camOrbit = clamp(state.camOrbit - dx * 0.006, -Math.PI * 0.95, Math.PI * 0.95);
    state.camHeight = clamp(state.camHeight + dy * 0.012, -1.6, 3.4);
  });
  const endDrag = () => { state.pointer.dragging = false; };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (e) => {
    if (!state.playing) return;
    e.preventDefault();
    zoomCamera(e.deltaY * 0.0012);
  }, { passive: false });
}

/* ---------- touch ---------- */
function isTouchDevice() {
  return ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0;
}
function setupTouch() {
  if (isTouchDevice()) document.body.classList.add("touch");
  const zone = $("#stick-zone"), knob = $("#stick-knob");
  if (zone && knob) {
    let pointerId = null;
    const reset = () => {
      state.touch.steer = 0; state.touch.throttle = 0;
      knob.style.transform = "translate(0,0)";
      pointerId = null;
    };
    zone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      pointerId = e.pointerId;
      zone.setPointerCapture && zone.setPointerCapture(e.pointerId);
      state.touch.active = true;
      move(e);
    });
    const move = (e) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = (e.clientX - cx) / (rect.width / 2);
      let dy = (e.clientY - cy) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      state.touch.steer = Math.abs(dx) > 0.14 ? dx : 0;
      state.touch.throttle = dy < -0.18 ? clamp(-dy, 0, 1) : 0;
      state.touch.brake = dy > 0.42 ? clamp(dy, 0, 1) : 0;
      knob.style.transform = "translate(" + (dx * 34) + "px," + (dy * 34) + "px)";
    };
    zone.addEventListener("pointermove", (e) => { if (pointerId !== null) move(e); });
    zone.addEventListener("pointerup", reset);
    zone.addEventListener("pointercancel", reset);
    zone.addEventListener("lostpointercapture", reset);
  }
  const holdButton = (sel, on, off) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); el.classList.add("pressed"); on(); });
    ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach((t) => el.addEventListener(t, () => { el.classList.remove("pressed"); if (off) off(); }));
  };
  holdButton("#pedal-gas", () => { state.touch.throttle = 1; }, () => { state.touch.throttle = 0; });
  holdButton("#pedal-brake", () => { state.touch.brake = 1; }, () => { state.touch.brake = 0; });
}

/* ---------- gamepad ---------- */
let padIndex = null;
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  let pad = null;
  for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
  if (!pad) { state.pad.connected = false; state.pad.steer = 0; state.pad.throttle = 0; state.pad.brake = 0; return; }
  state.pad.connected = true;
  const ax = pad.axes[0] || 0;
  state.pad.steer = Math.abs(ax) > 0.14 ? ax : 0;
  const rt = pad.buttons[7] ? pad.buttons[7].value : 0;
  const lt = pad.buttons[6] ? pad.buttons[6].value : 0;
  state.pad.throttle = rt;
  state.pad.brake = lt;
  if (pad.buttons[0] && pad.buttons[0].pressed && !state.pad.camHeld) {
    state.pad.camHeld = true;
    if (state.playing) toggleCamera();
  }
  if (pad.buttons[0] && !pad.buttons[0].pressed) state.pad.camHeld = false;
  if (pad.buttons[2] && pad.buttons[2].pressed && !state.pad.hornHeld) {
    state.pad.hornHeld = true;
    playHorn();
  }
  if (pad.buttons[2] && !pad.buttons[2].pressed) state.pad.hornHeld = false;
  if (pad.buttons[9] && pad.buttons[9].pressed && !state.pad.pauseHeld) {
    state.pad.pauseHeld = true;
    if (state.playing) { if (state.paused) resumeGame(); else pauseGame(); }
  }
  if (pad.buttons[9] && !pad.buttons[9].pressed) state.pad.pauseHeld = false;
}

function setupInput() {
  setupKeyboard();
  setupPointer();
  setupTouch();
  window.addEventListener("gamepadconnected", () => { toast("Controle conectado", "ok"); });
}
