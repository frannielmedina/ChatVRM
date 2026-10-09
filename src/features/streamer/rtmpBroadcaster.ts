// ─────────────────────────────────────────────────────────────────────────────
// Browser → RTMP.
//
// Browsers cannot speak RTMP directly. So this does it in two hops:
//
//   1. getDisplayMedia() captures THIS tab (3D model, background, captions,
//      overlays, emote wall — exactly what's on screen) plus its audio (the TTS
//      voice), the same way screen-sharing from Chrome works.
//   2. MediaRecorder encodes that to WebM and streams it over a WebSocket to
//      the small local relay in tools/rtmp-relay, which pipes it into ffmpeg and
//      pushes RTMP to Twitch / YouTube / etc.
// ─────────────────────────────────────────────────────────────────────────────
import { RESOLUTIONS, ResolvedStreamProfile, StreamerConfig } from "./streamerConfig";

export type BroadcastStatus = "idle" | "capturing" | "connecting" | "live" | "stopping" | "error";

export type BroadcastStats = {
  seconds: number;
  sentMB: number;
  kbps: number;
  bufferKB: number;
  hasAudio: boolean;
  captureSize: string;
};

export type BroadcastState = {
  status: BroadcastStatus;
  error: string | null;
  stats: BroadcastStats;
  relayEncoders: string[];
};

const EMPTY_STATS: BroadcastStats = {
  seconds: 0, sentMB: 0, kbps: 0, bufferKB: 0, hasAudio: false, captureSize: "",
};

const MAX_BUFFER_BYTES = 24 * 1024 * 1024;

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=h264,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

class RtmpBroadcaster {
  private state: BroadcastState = { status: "idle", error: null, stats: EMPTY_STATS, relayEncoders: [] };
  private listeners = new Set<(s: BroadcastState) => void>();

  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private ws: WebSocket | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private bytesSent = 0;
  private lastBytes = 0;

  getState() {
    return this.state;
  }

  subscribe(l: (s: BroadcastState) => void) {
    this.listeners.add(l);
    l(this.state);
    return () => {
      this.listeners.delete(l);
    };
  }

  private set(patch: Partial<BroadcastState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private fail(message: string) {
    this.cleanup();
    this.set({ status: "error", error: message });
  }

  async start(cfg: StreamerConfig, profile: ResolvedStreamProfile) {
    if (this.state.status !== "idle" && this.state.status !== "error") return;
    if (!cfg.rtmpUrl.trim() || !cfg.streamKey.trim()) {
      this.set({ status: "error", error: "Enter the RTMP URL and your stream key first." });
      return;
    }
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      this.set({ status: "error", error: "This browser can't capture the screen. Use Chrome or Edge." });
      return;
    }

    this.set({ status: "capturing", error: null, stats: EMPTY_STATS });
    const res = RESOLUTIONS[profile.resolution];

    // 1 ── capture this tab ─────────────────────────────────────────────────
    let stream: MediaStream;
    try {
      stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: {
          width: { ideal: res.w },
          height: { ideal: res.h },
          frameRate: { ideal: profile.fps, max: profile.fps },
        },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        // Chrome hints: pre-select this very tab and offer its audio.
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        systemAudio: "include",
      });
    } catch (e: any) {
      this.set({ status: "idle", error: e?.name === "NotAllowedError" ? "Capture was cancelled." : `Capture failed: ${e?.message ?? e}` });
      return;
    }
    this.stream = stream;

    const vTrack = stream.getVideoTracks()[0];
    const settings = vTrack?.getSettings?.() ?? {};
    const hasAudio = stream.getAudioTracks().length > 0;
    vTrack?.addEventListener("ended", () => this.stop());

    // 2 ── connect to the relay ─────────────────────────────────────────────
    this.set({ status: "connecting" });
    let ws: WebSocket;
    try {
      ws = new WebSocket(cfg.relayUrl);
    } catch {
      this.fail(`Invalid relay address: ${cfg.relayUrl}`);
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    const ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("The relay didn't answer. Is `npm start` running in tools/rtmp-relay?")),
        10000
      );
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "start",
            rtmpUrl: cfg.rtmpUrl.trim(),
            streamKey: cfg.streamKey.trim(),
            width: res.w,
            height: res.h,
            fps: profile.fps,
            videoBitrateKbps: profile.videoBitrateKbps,
            audioBitrateKbps: profile.audioBitrateKbps,
            encoder: cfg.encoder,
            hasAudio,
          })
        );
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string") return;
        let msg: any;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === "hello") {
          this.set({ relayEncoders: Array.isArray(msg.encoders) ? msg.encoders : [] });
        } else if (msg.type === "started") {
          clearTimeout(timeout);
          resolve();
        } else if (msg.type === "error") {
          clearTimeout(timeout);
          reject(new Error(msg.message || "Relay error"));
        } else if (msg.type === "ended") {
          // ffmpeg exited after we went live (bad key, network drop, ...)
          if (this.state.status === "live") this.fail(msg.message || "The stream ended unexpectedly.");
        }
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Can't reach the relay at ${cfg.relayUrl}. Start it with \`npm start\` in tools/rtmp-relay.`));
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        if (this.state.status === "live") this.fail("Lost connection to the relay.");
        else reject(new Error("The relay closed the connection."));
      };
    });

    try {
      await ready;
    } catch (e: any) {
      this.fail(e?.message ?? String(e));
      return;
    }

    // 3 ── record + ship chunks ────────────────────────────────────────────
    try {
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: profile.videoBitrateKbps * 1000,
        audioBitsPerSecond: profile.audioBitrateKbps * 1000,
      });
      this.recorder = recorder;
      recorder.ondataavailable = async (ev) => {
        if (!ev.data || ev.data.size === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (this.ws.bufferedAmount > MAX_BUFFER_BYTES) {
          this.fail("Your upload (or the relay) can't keep up. Lower the bitrate/resolution and try again.");
          return;
        }
        const buf = await ev.data.arrayBuffer();
        this.ws?.send(buf);
        this.bytesSent += buf.byteLength;
      };
      recorder.onerror = () => this.fail("The browser's video encoder failed.");
      recorder.start(250);
    } catch (e: any) {
      this.fail(`Couldn't start recording: ${e?.message ?? e}`);
      return;
    }

    this.startedAt = Date.now();
    this.bytesSent = 0;
    this.lastBytes = 0;
    this.set({ status: "live", error: null });
    this.statsTimer = setInterval(() => {
      const kbps = Math.round(((this.bytesSent - this.lastBytes) * 8) / 1000);
      this.lastBytes = this.bytesSent;
      this.set({
        stats: {
          seconds: Math.floor((Date.now() - this.startedAt) / 1000),
          sentMB: Number((this.bytesSent / 1048576).toFixed(1)),
          kbps,
          bufferKB: Math.round((this.ws?.bufferedAmount ?? 0) / 1024),
          hasAudio,
          captureSize: settings.width && settings.height ? `${settings.width}×${settings.height}` : "",
        },
      });
    }, 1000);
  }

  stop() {
    if (this.state.status === "idle") return;
    this.set({ status: "stopping" });
    try { this.ws?.readyState === WebSocket.OPEN && this.ws.send(JSON.stringify({ type: "stop" })); } catch { /* ignore */ }
    this.cleanup();
    this.set({ status: "idle", error: null, stats: EMPTY_STATS });
  }

  private cleanup() {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
    try { if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop(); } catch { /* ignore */ }
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      try { this.ws.close(); } catch { /* ignore */ }
    }
    this.ws = null;
  }
}

export const rtmpBroadcaster = new RtmpBroadcaster();
