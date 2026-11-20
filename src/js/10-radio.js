/* ============================================================
   SAMPA DRIVER · 10 · rádio (YouTube, Piped, stream direto)
   ============================================================ */
const RADIO = {
  audio: null, yt: null, ytApi: false, ytPending: false, mode: null,
  volume: 0.72, titleTimer: 0, vizPhase: 0, energy: 0
};
const PIPED_HOSTS = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.drgns.space"
];

function initRadio() {
  state.radio.volume = clamp(Number(state.settings.music) || 0.72, 0, 1);
  RADIO.audio = new Audio();
  RADIO.audio.preload = "none";
  RADIO.audio.volume = state.radio.volume;
  RADIO.audio.addEventListener("ended", () => { if (state.radio.queue.length) radioNext(); });
  RADIO.audio.addEventListener("error", () => {
    if (state.radio.mode === "audio") setRadioStatus("Não consegui abrir este áudio — tente outro link", "err");
  });
  RADIO.audio.addEventListener("playing", () => { state.radio.playing = true; updateRadioUI(); });
  RADIO.audio.addEventListener("pause", () => { state.radio.playing = false; updateRadioUI(); });
  assignRange($("#radio-volume"), state.settings.music * 100);
  assignRange($("#set-music"), state.settings.music * 100);
}

function assignRange(el, value) {
  if (!el) return;
  el.value = value;
  const pct = (value - el.min) / (el.max - el.min) * 100;
  el.style.setProperty("--p", pct + "%");
}

/* ---------- utils ---------- */
function parsePlaylist(url) {
  try {
    const u = new URL(url.trim());
    const list = u.searchParams.get("list");
    const v = u.searchParams.get("v");
    let host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return { kind: "video", id: u.pathname.slice(1), host: "youtube.com" };
    if (/youtube|youtu\.be/.test(host)) {
      if (list) return { kind: "playlist", id: list, host: "youtube.com" };
      if (v) return { kind: "video", id: v, host: "youtube.com" };
      const m = u.pathname.match(/\/(?:embed|shorts)\/([\w-]{6,})/);
      if (m) return { kind: "video", id: m[1], host: "youtube.com" };
      return { kind: "unknown", id: "", host };
    }
    if (/piped|invidious|yewtu\.be|nitter/.test(host)) {
      if (list) return { kind: "playlist", id: list, host };
      if (v) return { kind: "video", id: v, host };
    }
    if (/\.(mp3|ogg|wav|m4a|aac|opus|flac)(\?|$)/i.test(url) || /stream|radio|icecast|zeno|somafm/i.test(url)) {
      return { kind: "audio", id: url, host: "stream" };
    }
    return { kind: "unknown", id: "", host };
  } catch (e) {
    return { kind: "unknown", id: "", host: "" };
  }
}

function setRadioStatus(text, kind) {
  state.radio.status = kind || "idle";
  const el = $("#radio-status");
  if (el) {
    el.className = "radio-status" + (kind === "live" ? " live" : kind === "err" ? " err" : "");
    const span = el.querySelector("span");
    if (span) span.textContent = text;
  }
}
function setRadioMeta(title, sub) {
  state.radio.title = title;
  state.radio.sub = sub;
  updateRadioUI();
}

/* ---------- YouTube ---------- */
function ensureYouTubeApi() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) { RADIO.ytApi = true; return resolve(true); }
    let done = false;
    const finish = (ok) => { if (done) return; done = true; RADIO.ytApi = ok; resolve(ok); };
    window.onYouTubeIframeAPIReady = () => finish(true);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => finish(false);
    document.head.appendChild(tag);
    setTimeout(() => finish(false), 14000);
  });
}

async function startYouTube(info) {
  const ok = await ensureYouTubeApi();
  if (!ok) {
    setRadioStatus("YouTube bloqueado neste navegador — use Piped ou link direto", "err");
    playClick("err");
    return false;
  }
  const args = {
    height: "200", width: "200",
    playerVars: {
      autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1,
      origin: location.origin
    },
    events: {
      onReady: (ev) => {
        try { ev.target.setVolume(Math.round(state.radio.volume * 100)); } catch (e) {}
        try { ev.target.playVideo(); } catch (e) {}
        setRadioStatus("YouTube conectado · só o áudio", "live");
      },
      onStateChange: (ev) => {
        const st = ev.data;
        state.radio.playing = st === 1;
        if (st === 1) {
          setRadioStatus("Tocando no player do YouTube", "live");
          pollYouTubeTitle();
        }
        if (st === 3) setRadioStatus("Carregando faixa…", "idle");
        if (st === 0 && state.radio.queue.length) radioNext();
        updateRadioUI();
      },
      onError: () => { setRadioStatus("O YouTube recusou esta playlist (pode ser privada ou bloqueada)", "err"); }
    }
  };
  if (info.kind === "video") args.videoId = info.id;
  else {
    args.playerVars.list = info.id;
    args.playerVars.listType = "playlist";
  }
  try {
    if (RADIO.yt && RADIO.yt.destroy) RADIO.yt.destroy();
    RADIO.yt = new window.YT.Player("yt", args);
  } catch (err) {
    setRadioStatus("Não foi possível criar o player do YouTube", "err");
    return false;
  }
  RADIO.mode = "youtube";
  state.radio.mode = "youtube";
  state.radio.type = info.kind;
  setRadioMeta(info.kind === "playlist" ? "Playlist do YouTube" : "Vídeo do YouTube", "Áudio do player oficial");
  return true;
}

function pollYouTubeTitle() {
  if (!RADIO.yt || !RADIO.yt.getVideoData) return;
  try {
    const data = RADIO.yt.getVideoData();
    if (data && data.title) {
      const author = RADIO.yt.getVideoData().author || "YouTube";
      setRadioMeta(data.title, "YouTube · " + author);
    }
  } catch (e) {}
}

/* ---------- Piped / Invidious ---------- */
async function pipedFetch(path, timeout) {
  for (const host of PIPED_HOSTS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout || 9000);
    try {
      const res = await fetch(host + path, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json();
      return { json, host };
    } catch (e) {
      clearTimeout(t);
    }
  }
  return null;
}

async function startPiped(info) {
  setRadioStatus("Consultando uma instância Piped…", "idle");
  if (info.kind === "playlist") {
    setRadioStatus("Buscando a playlist no Piped…", "idle");
    const result = await pipedFetch("/playlists/" + encodeURIComponent(info.id), 12000);
    if (!result || !result.json) {
      setRadioStatus("Nenhuma instância Piped respondeu — tente novamente ou use link direto", "err");
      playClick("err");
      return false;
    }
    const rows = result.json.relatedStreams || result.json.items || [];
    state.radio.queue = rows.map((r) => ({
      id: (r.url || r.link || "").split("v=")[1] || (r.url || "").split("/").pop(),
      title: r.title || "Faixa"
    })).filter((r) => r.id && r.id.length > 3).slice(0, 60);
    if (!state.radio.queue.length) {
      setRadioStatus("Playlist vazia ou não pública", "err");
      return false;
    }
    state.radio.index = 0;
    setRadioMeta(result.json.name || "Playlist Piped", result.host.replace("https://", ""));
    RADIO.mode = "piped";
    state.radio.mode = "piped";
    return await playPipedTrack(0);
  }
  state.radio.queue = [{ id: info.id, title: info.id }];
  RADIO.mode = "piped";
  state.radio.mode = "piped";
  return await playPipedTrack(0);
}

async function playPipedTrack(index) {
  const queue = state.radio.queue;
  if (!queue.length) return false;
  index = (index + queue.length) % queue.length;
  state.radio.index = index;
  const track = queue[index];
  setRadioStatus("Abrindo áudio…", "idle");
  setRadioMeta(track.title || "Faixa " + (index + 1), "Piped · " + (index + 1) + " de " + queue.length);
  const result = await pipedFetch("/streams/" + encodeURIComponent(track.id), 11000);
  if (!result || !result.json) {
    setRadioStatus("Piped não retornou o áudio desta faixa", "err");
    return false;
  }
  const streams = (result.json.audioStreams || []).filter((s) => s.url);
  streams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  if (!streams.length) {
    setRadioStatus("Faixa sem áudio disponível", "err");
    return false;
  }
  const url = streams[0].url;
  return await playAudioUrl(url, track.title, "Piped · " + (index + 1) + " de " + queue.length);
}

/* ---------- direct ---------- */
async function playAudioUrl(url, title, sub) {
  if (!RADIO.audio) return false;
  try {
    RADIO.audio.src = url;
    RADIO.audio.volume = state.radio.volume;
    await RADIO.audio.play();
    RADIO.mode = "audio";
    state.radio.mode = "audio";
    state.radio.playing = true;
    setRadioMeta(title || "Stream de áudio", sub || "Link direto");
    setRadioStatus("Tocando áudio", "live");
    updateRadioUI();
    return true;
  } catch (err) {
    setRadioStatus("O navegador bloqueou ou recusou o áudio — clique em tocar", "err");
    state.radio.playing = false;
    updateRadioUI();
    return false;
  }
}

/* ---------- connect / controls ---------- */
async function connectRadio() {
  audioResume();
  const input = $("#radio-url");
  const url = (input && input.value ? input.value : state.radio.url || "").trim();
  if (!url) {
    setRadioStatus("Cole o link de uma playlist, vídeo ou stream", "err");
    toast("Cole um link para conectar a rádio", "warn");
    playClick("err");
    return;
  }
  state.radio.url = url;
  const source = state.radio.source;
  const info = parsePlaylist(url);
  stopRadioPlayback(true);
  setRadioStatus("Conectando…", "idle");
  setRadioMeta("Conectando…", source.toUpperCase());
  playClick("tick");

  if (source === "direct" || info.kind === "audio") {
    if (info.kind === "unknown" && source === "direct") {
      await playAudioUrl(url, decodeURIComponent((url.split("/").pop() || "Stream").slice(0, 60)), "Link direto");
      return;
    }
    const title = decodeURIComponent((url.split("/").pop() || "Stream").split("?")[0]).slice(0, 60) || "Stream de áudio";
    await playAudioUrl(url, title, "Link direto");
    return;
  }

  if (info.kind === "unknown") {
    setRadioStatus("Não reconheci este link. Confira o formato.", "err");
    playClick("err");
    return;
  }
  if (info.kind === "playlist" && !info.id) {
    setRadioStatus("Playlist inválida", "err");
    return;
  }

  if (source === "piped") {
    await startPiped(info);
    return;
  }
  if (info.host === "youtube.com" || source === "youtube") {
    if (info.host !== "youtube.com") {
      setRadioStatus("Esse link não é do YouTube — tentando pelo Piped", "idle");
      await startPiped(info);
      return;
    }
    const ok = await startYouTube(info);
    if (!ok) {
      setRadioStatus("Tentando o Piped como alternativa…", "idle");
      await startPiped(info);
    }
    return;
  }
  await startPiped(info);
}

function stopRadioPlayback(silent) {
  if (RADIO.audio) {
    RADIO.audio.pause();
    RADIO.audio.removeAttribute("src");
    RADIO.audio.load();
  }
  if (RADIO.yt && RADIO.yt.stopVideo) {
    try { RADIO.yt.stopVideo(); } catch (e) {}
  }
  state.radio.playing = false;
  if (!silent) {
    state.radio.title = "Rádio desligada";
    state.radio.sub = "Conecte uma playlist";
    updateRadioUI();
    setRadioStatus("Rádio desligada", "idle");
  }
}

function radioToggle() {
  audioResume();
  if (state.radio.playing) {
    if (RADIO.mode === "youtube" && RADIO.yt && RADIO.yt.pauseVideo) RADIO.yt.pauseVideo();
    else if (RADIO.audio) RADIO.audio.pause();
    state.radio.playing = false;
    updateRadioUI();
    return;
  }
  if (RADIO.mode === "youtube" && RADIO.yt && RADIO.yt.playVideo) {
    RADIO.yt.playVideo();
    state.radio.playing = true;
  } else if (RADIO.audio && RADIO.audio.src) {
    RADIO.audio.play().then(() => { state.radio.playing = true; updateRadioUI(); }).catch(() => toast("Clique para liberar o áudio", "warn"));
  } else {
    const url = ($("#radio-url") && $("#radio-url").value) || state.radio.url;
    if (url) connectRadio();
    else { showPage("radio"); toast("Cole um link de playlist para começar"); }
  }
  updateRadioUI();
}

function radioNext() {
  if (RADIO.mode === "youtube" && RADIO.yt && RADIO.yt.nextVideo) {
    try { RADIO.yt.nextVideo(); return; } catch (e) {}
  }
  if (state.radio.queue.length) playPipedTrack(state.radio.index + 1);
}
function radioPrev() {
  if (RADIO.mode === "youtube" && RADIO.yt && RADIO.yt.previousVideo) {
    try { RADIO.yt.previousVideo(); return; } catch (e) {}
  }
  if (state.radio.queue.length) playPipedTrack(state.radio.index - 1);
}

function radioVolume(value) {
  state.radio.volume = clamp(value, 0, 1);
  state.settings.music = state.radio.volume;
  if (RADIO.audio) RADIO.audio.volume = state.radio.volume;
  if (RADIO.yt && RADIO.yt.setVolume) { try { RADIO.yt.setVolume(Math.round(state.radio.volume * 100)); } catch (e) {} }
  assignRange($("#radio-volume"), state.radio.volume * 100);
  assignRange($("#set-music"), state.radio.volume * 100);
  const label = $("#radio-volume-label");
  if (label) label.textContent = String(Math.round(state.radio.volume * 100));
  saveGame();
}

/* ---------- UI ---------- */
const ICON_PLAY = "#i-play", ICON_PAUSE = "#i-pause";
function setIcon(btn, href) {
  if (!btn) return;
  const use = btn.querySelector("use");
  if (use) use.setAttribute("href", href);
}
function updateRadioUI() {
  const title = state.radio.title || "Nada tocando";
  const sub = state.radio.sub || "Conecte uma playlist para começar";
  const t1 = $("#radio-title"); if (t1) t1.textContent = title;
  const t2 = $("#radio-sub"); if (t2) t2.textContent = sub;
  const t3 = $("#hud-track"); if (t3) t3.textContent = state.radio.playing ? title : (state.radio.title && state.radio.title !== "Nada tocando" ? "Pausado · " + title : "Rádio desligado");
  const t4 = $("#hud-radio-sub"); if (t4) t4.textContent = sub;
  const home = $("#home-radio-title"); if (home) home.textContent = state.radio.playing ? title : "Desligada";
  const homeSub = $("#home-radio-sub"); if (homeSub) homeSub.textContent = sub;
  setIcon($("#radio-play"), state.radio.playing ? ICON_PAUSE : ICON_PLAY);
  setIcon($("#hud-radio-play"), state.radio.playing ? ICON_PAUSE : ICON_PLAY);
  const eqs = $$(".mini-eq");
  eqs.forEach((e) => e.classList.toggle("live", state.radio.playing));
  const cover = $("#radio-cover");
  if (cover) cover.classList.toggle("spin", state.radio.playing);
  const label = $("#radio-source-label");
  if (label) {
    label.textContent = state.radio.source === "piped" ? "PIPED · PLAYER PESSOAL" : state.radio.source === "direct" ? "STREAM · PLAYER PESSOAL" : "SAMPA FM · YOUTUBE";
  }
}
function updateRadioVolumeUI() {
  assignRange($("#radio-volume"), state.radio.volume * 100);
  assignRange($("#set-music"), state.radio.volume * 100);
  const label = $("#radio-volume-label");
  if (label) label.textContent = String(Math.round(state.radio.volume * 100));
}

/* ---------- visualiser ---------- */
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
  RADIO.vizPhase += dt * (state.radio.playing ? 3.4 : 0.7);
  RADIO.energy = damp(RADIO.energy, state.radio.playing ? 1 : 0.34, 2.4, dt);
  const bars = Math.max(24, Math.min(64, Math.floor(cw / 11)));
  const base = ch * 0.9;
  const unit = cw / bars;
  for (let i = 0; i < bars; i++) {
    const p = i / bars;
    const wave =
      Math.abs(Math.sin(p * 7.3 + RADIO.vizPhase * 1.6)) * 0.42 +
      Math.abs(Math.sin(p * 17.7 + RADIO.vizPhase * 0.85)) * 0.3 +
      Math.abs(Math.sin(p * 3.1 - RADIO.vizPhase * 2.2)) * 0.28;
    const env = Math.sin(p * Math.PI) * 0.75 + 0.25;
    const h = (5 + wave * env * ch * 0.52) * RADIO.energy;
    const x = i * unit + unit * 0.22;
    const w = unit * 0.56;
    const g = ctx.createLinearGradient(0, base - h, 0, base);
    g.addColorStop(0, "rgba(211,251,104,.95)");
    g.addColorStop(0.55, "rgba(160,240,190,.65)");
    g.addColorStop(1, "rgba(121,230,221,.18)");
    ctx.fillStyle = g;
    roundRect(ctx, x, base - h, w, h, Math.min(w / 2, 3));
    ctx.fill();
    /* reflection */
    ctx.globalAlpha = 0.14;
    const g2 = ctx.createLinearGradient(0, base, 0, base + h * 0.5);
    g2.addColorStop(0, "rgba(121,230,221,.55)");
    g2.addColorStop(1, "rgba(121,230,221,0)");
    ctx.fillStyle = g2;
    roundRect(ctx, x, base, w, h * 0.5, Math.min(w / 2, 3));
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  /* baseline */
  ctx.beginPath();
  ctx.moveTo(0, base + 0.5);
  ctx.lineTo(cw, base + 0.5);
  ctx.strokeStyle = "rgba(211,251,104,.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
