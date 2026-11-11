// ── WebSocket client for Aika's peer protocol ────────────────────────────────
// One outbound WSS connection, JSON text frames. See "Miko x Aika peer guide".
import { AikaMood } from "./aikaPeerConfig";

export type PeerFrame =
  | { type: "msg"; from?: string; text: string; mood?: string; ts?: number; test?: boolean }
  | { type: "system"; event: string; info?: string; ts?: number; duration?: number; test?: boolean }
  | { type: "pong" };

export type PeerStatus = "offline" | "connecting" | "connected" | "fatal";

export type PeerEvents = {
  status?: (s: PeerStatus, detail?: string) => void;
  aikaMessage?: (text: string, mood: string | undefined, test: boolean) => void;
  ready?: () => void;                // ai_talk_ready — "you may knock"
  sessionStart?: () => void;         // ai_talk_start from Aika — guest slot is open
  sessionEnd?: () => void;           // ai_talk_end
  voiceStart?: () => void;           // Aika started speaking
  voiceEnd?: () => void;             // Aika finished speaking
  log?: (line: string) => void;
};

const BACKOFF_MS = [2000, 5000, 15000, 60000];
const PING_MS = 25000;
const MAX_TEXT = 1000;
const RATE_LIMIT_PER_MIN = 30;
// Errors where retrying in a loop is pointless / forbidden by the guide.
const FATAL_ERRORS = ["invalid token or peer disabled", "token required"];

export class AikaPeerClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private wantConnected = false;
  private sentAt: number[] = [];
  status: PeerStatus = "offline";

  constructor(
    private getUrl: () => string,
    private events: PeerEvents
  ) {}

  private setStatus(s: PeerStatus, detail?: string) {
    this.status = s;
    this.events.status?.(s, detail);
  }

  connect() {
    this.wantConnected = true;
    this.open();
  }

  disconnect() {
    this.wantConnected = false;
    this.clearTimers();
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.setStatus("offline");
  }

  private clearTimers() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pingTimer = null;
    this.retryTimer = null;
  }

  private open() {
    if (!this.wantConnected) return;
    this.clearTimers();
    try { this.ws?.close(); } catch {}
    this.setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.getUrl());
    } catch (e: any) {
      this.setStatus("fatal", e?.message || "bad URL");
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      // The handshake "succeeds" even with a wrong token — wait for the
      // `connected` frame before calling ourselves connected.
      this.pingTimer = setInterval(() => this.rawSend({ type: "ping" }), PING_MS);
    };
    ws.onmessage = (ev) => {
      let f: PeerFrame;
      try { f = JSON.parse(String(ev.data)); } catch { return; }
      this.handleFrame(f);
    };
    ws.onclose = () => {
      if (ws !== this.ws) return;
      this.clearTimers();
      if (this.status === "fatal" || !this.wantConnected) return;
      this.scheduleReconnect();
    };
    ws.onerror = () => { /* onclose follows */ };
  }

  private scheduleReconnect() {
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt++;
    this.setStatus("connecting", `reconnecting in ${Math.round(delay / 1000)}s`);
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  private handleFrame(f: PeerFrame) {
    if (f.type === "pong") return;
    if (f.type === "msg") {
      if (f.from === "aika" || f.from === undefined) {
        this.events.aikaMessage?.(f.text, f.mood, !!f.test);
      }
      return;
    }
    switch (f.event) {
      case "connected":
        this.attempt = 0;
        this.setStatus("connected", f.info);
        break;
      case "ai_talk_ready": this.events.ready?.(); break;
      case "ai_talk_start": this.events.sessionStart?.(); break;
      case "ai_talk_end": this.events.sessionEnd?.(); break;
      case "voice_start": this.events.voiceStart?.(); break;
      case "voice_end": this.events.voiceEnd?.(); break;
      case "rate_limit": this.events.log?.("⚠ rate limited by Aika — slow down"); break;
      case "error": {
        const info = f.info || "unknown error";
        this.events.log?.(`error: ${info}`);
        if (FATAL_ERRORS.some((e) => info.startsWith(e))) {
          // Do NOT retry in a loop — ask Samy.
          this.setStatus("fatal", info);
          this.wantConnected = false;
        }
        break; // other errors: server closes the socket, onclose backs off
      }
    }
  }

  private rawSend(obj: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(obj));
      return true;
    } catch {
      // Half-dead socket looks alive until a send fails → reconnect.
      try { this.ws.close(); } catch {}
      return false;
    }
  }

  /** Ask for a session (guide: "you may knock" after ai_talk_ready). */
  requestSession() { return this.rawSend({ type: "system", event: "ai_talk_start" }); }
  endSession() { return this.rawSend({ type: "system", event: "ai_talk_end" }); }

  /** Send Miko's line to Aika. Client-side rate guard keeps us under 30/min. */
  sendMessage(text: string, mood?: AikaMood): boolean {
    const now = Date.now();
    this.sentAt = this.sentAt.filter((t) => now - t < 60000);
    if (this.sentAt.length >= RATE_LIMIT_PER_MIN - 2) return false;
    const trimmed = text.trim().slice(0, MAX_TEXT);
    if (!trimmed) return false;
    const ok = this.rawSend(mood ? { type: "msg", text: trimmed, mood } : { type: "msg", text: trimmed });
    if (ok) this.sentAt.push(now);
    return ok;
  }
}

export function buildPeerUrl(base: string, token: string, test: boolean): string {
  const u = new URL(base);
  u.searchParams.set("token", token);
  if (test) u.searchParams.set("test", "1");
  return u.toString();
}
