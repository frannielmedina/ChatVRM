/* eslint-disable no-console */
// ChatVRM RTMP relay
//
//   browser (MediaRecorder, WebM)  ──WebSocket──▶  this server  ──stdin──▶  ffmpeg  ──RTMP──▶  Twitch / YouTube / …
//
// Runs on your own machine and only listens on localhost.
//
//   npm install && npm start
//
// Environment variables (all optional):
//   PORT             WebSocket port                         (default 8787)
//   HOST             Interface to bind                      (default 127.0.0.1)
//   FFMPEG_PATH      Path to the ffmpeg binary              (default: ffmpeg-static if installed, else `ffmpeg` on PATH)
//   ALLOWED_ORIGINS  Extra comma-separated page origins allowed to connect, e.g. https://my-chatvrm.example.com

const { spawn, spawnSync } = require("child_process");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ── Locate ffmpeg ────────────────────────────────────────────────────────────
function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const p = require("ffmpeg-static");
    if (p) return p;
  } catch (_) {
    /* optional dependency not installed */
  }
  return "ffmpeg";
}
const FFMPEG = resolveFfmpeg();

const ENCODER_NAMES = {
  x264: "libx264",
  nvenc: "h264_nvenc",
  qsv: "h264_qsv",
  amf: "h264_amf",
  videotoolbox: "h264_videotoolbox",
};

function detectEncoders() {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-encoders"], { encoding: "utf8" });
  if (r.error || r.status !== 0) return null;
  const out = r.stdout || "";
  return Object.keys(ENCODER_NAMES).filter((k) => out.includes(ENCODER_NAMES[k]));
}

const available = detectEncoders();
if (!available) {
  console.error(
    `\n✖ Couldn't run ffmpeg ("${FFMPEG}").\n` +
      "  Install it (https://ffmpeg.org/download.html) and make sure `ffmpeg` is on your PATH,\n" +
      "  or run:  npm install   (installs a bundled ffmpeg-static),\n" +
      "  or set FFMPEG_PATH to the binary.\n"
  );
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function originAllowed(origin) {
  // Non-browser clients (curl, tests) send no Origin — fine, they're already on this machine.
  if (!origin) return true;
  try {
    const u = new URL(origin);
    if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(u.hostname)) return true;
  } catch (_) {
    return false;
  }
  return EXTRA_ORIGINS.includes(origin);
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function buildArgs(opts) {
  const { width, height, fps, vk, ak, encoder, hasAudio, url } = opts;
  const args = ["-hide_banner", "-loglevel", "warning", "-analyzeduration", "2000000", "-i", "pipe:0"];

  // Streaming services insist on an audio track; synthesize silence if the capture had none.
  if (!hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");

  args.push("-map", "0:v:0", "-map", hasAudio ? "0:a:0" : "1:a:0");

  args.push(
    "-vf",
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p`
  );

  const venc = ENCODER_NAMES[encoder] || "libx264";
  args.push("-c:v", venc);
  switch (encoder) {
    case "nvenc":
      args.push("-preset", "fast", "-rc", "cbr");
      break;
    case "qsv":
      args.push("-preset", "veryfast");
      break;
    case "amf":
      args.push("-quality", "speed", "-rc", "cbr");
      break;
    case "videotoolbox":
      args.push("-realtime", "1");
      break;
    default:
      args.push("-preset", "veryfast", "-tune", "zerolatency", "-profile:v", "main");
  }
  args.push(
    "-b:v", `${vk}k`,
    "-maxrate", `${vk}k`,
    "-bufsize", `${vk * 2}k`,
    "-g", String(fps * 2), // keyframe every 2s — what Twitch/YouTube expect
    "-bf", "0"
  );

  args.push("-c:a", "aac", "-b:a", `${ak}k`, "-ar", "44100", "-ac", "2", "-af", "aresample=async=1");
  args.push("-f", "flv", url);
  return args;
}

// ── Server ───────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({
  host: HOST,
  port: PORT,
  maxPayload: 64 * 1024 * 1024,
  verifyClient: ({ origin }, done) => {
    if (originAllowed(origin)) return done(true);
    console.warn(`✖ Rejected connection from origin ${origin}`);
    done(false, 403, "Origin not allowed");
  },
});

let busy = false;

wss.on("connection", (ws) => {
  let ff = null;
  let started = false;
  let streamKey = "";
  let tail = [];

  const send = (obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };
  const mask = (s) => (streamKey ? s.split(streamKey).join("****") : s);
  const stopFfmpeg = () => {
    if (!ff) return;
    try { ff.stdin.end(); } catch (_) { /* ignore */ }
    const proc = ff;
    ff = null;
    setTimeout(() => { try { proc.kill("SIGTERM"); } catch (_) { /* ignore */ } }, 1500);
  };

  send({ type: "hello", encoders: available });

  ws.on("message", (data, isBinary) => {
    // ── binary frame = WebM chunk ────────────────────────────────────────────
    if (isBinary) {
      if (!ff || !ff.stdin.writable) return;
      ff.stdin.write(data);
      if (ff.stdin.writableLength > 64 * 1024 * 1024) {
        send({ type: "error", message: "ffmpeg can't keep up (try a faster encoder or lower resolution)." });
        stopFfmpeg();
      }
      return;
    }

    // ── text frame = control message ─────────────────────────────────────────
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (_) { return; }

    if (msg.type === "stop") { stopFfmpeg(); return; }
    if (msg.type !== "start" || started) return;

    if (busy) return send({ type: "error", message: "The relay is already streaming for another window." });

    const rtmpUrl = String(msg.rtmpUrl || "").trim().replace(/\/+$/, "");
    streamKey = String(msg.streamKey || "").trim();
    if (!/^rtmps?:\/\/\S+$/i.test(rtmpUrl)) return send({ type: "error", message: "RTMP URL must start with rtmp:// or rtmps://" });
    if (!streamKey || /\s/.test(streamKey)) return send({ type: "error", message: "Missing or invalid stream key." });

    const encoder = Object.prototype.hasOwnProperty.call(ENCODER_NAMES, msg.encoder) ? msg.encoder : "x264";
    if (!available.includes(encoder)) {
      return send({ type: "error", message: `This ffmpeg build has no "${encoder}" encoder. Available: ${available.join(", ") || "none"}.` });
    }

    const args = buildArgs({
      width: clampInt(msg.width, 160, 3840, 1280),
      height: clampInt(msg.height, 90, 2160, 720),
      fps: clampInt(msg.fps, 5, 60, 30),
      vk: clampInt(msg.videoBitrateKbps, 300, 20000, 3500),
      ak: clampInt(msg.audioBitrateKbps, 32, 320, 128),
      encoder,
      hasAudio: Boolean(msg.hasAudio),
      url: `${rtmpUrl}/${streamKey}`,
    });

    busy = true;
    started = true;
    console.log(`▶ Starting stream → ${rtmpUrl}/**** (${encoder}, ${msg.width}x${msg.height}@${msg.fps}, ${msg.videoBitrateKbps}k)`);
    ff = spawn(FFMPEG, args, { stdio: ["pipe", "ignore", "pipe"] });

    ff.stderr.on("data", (d) => {
      const text = mask(d.toString());
      text.split(/\r?\n/).filter(Boolean).forEach((line) => {
        console.log("[ffmpeg]", line);
        tail.push(line);
        if (tail.length > 6) tail.shift();
      });
    });
    ff.stdin.on("error", () => { /* ffmpeg died; 'close' handler reports it */ });

    ff.on("error", (err) => {
      send({ type: "error", message: `Couldn't start ffmpeg: ${err.message}` });
      busy = false;
      ff = null;
    });

    ff.on("close", (code) => {
      busy = false;
      const was = ff;
      ff = null;
      console.log(`■ ffmpeg exited (${code})`);
      if (code !== 0 && code !== null) {
        send({ type: "ended", message: `ffmpeg stopped (code ${code}). ${tail.slice(-2).join(" ")}`.trim() });
      } else if (was) {
        send({ type: "ended", message: "The stream ended." });
      }
    });

    // Give ffmpeg a moment to fail fast on a bad URL/encoder before we say "started".
    setTimeout(() => {
      if (ff && ff.exitCode === null) send({ type: "started" });
      else send({ type: "error", message: `ffmpeg exited immediately. ${tail.slice(-2).join(" ")}`.trim() });
    }, 900);
  });

  ws.on("close", () => {
    if (started) console.log("◼ Browser disconnected");
    stopFfmpeg();
  });
  ws.on("error", () => stopFfmpeg());
});

wss.on("listening", () => {
  console.log(`\nChatVRM RTMP relay listening on ws://${HOST}:${PORT}`);
  console.log(`ffmpeg: ${FFMPEG}`);
  console.log(`Encoders available: ${available.join(", ") || "none"}\n`);
});

process.on("SIGINT", () => process.exit(0));
