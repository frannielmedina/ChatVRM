// ── Link between Miko's control tab and the widget page ──────────────────────
// Aika's OBS loads /aika-widget in ITS browser, so the widget can't read this
// tab's localStorage/IndexedDB. Frames travel over:
//   • WebRTC data channel (PeerJS public broker, no server of your own) → remote OBS
//   • BroadcastChannel                                                  → same browser (testing)
// No API keys ever leave the control tab: only the finished TTS audio does.
import type { Peer as PeerType, DataConnection } from "peerjs";

export type WidgetFrame =
  | { t: "show" }
  | { t: "hide" }
  | {
      t: "speak";
      expression: "neutral" | "happy" | "angry" | "sad" | "relaxed";
      pose?: string;
      style: string;
      text: string;
      audio: ArrayBuffer;
    }
  | { t: "hello" };

const BC_NAME = "chatvrm-aika-widget-v1";
const PEER_ID_KEY = "chatVRM_aikaWidgetPeerId";

export function getWidgetPeerId(): string {
  try {
    let id = window.localStorage.getItem(PEER_ID_KEY);
    if (!id) {
      id = "miko-" + Array.from(crypto.getRandomValues(new Uint8Array(10)))
        .map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
      window.localStorage.setItem(PEER_ID_KEY, id);
    }
    return id;
  } catch {
    return "miko-fallback-" + Math.random().toString(36).slice(2, 10);
  }
}

// ── Control-tab side ─────────────────────────────────────────────────────────
export class WidgetSender {
  private peer: PeerType | null = null;
  private conns = new Set<DataConnection>();
  private bc: BroadcastChannel | null = null;
  private lastVisible = false;
  onViewers?: (n: number) => void;

  async start() {
    if (this.peer) return;
    if (typeof BroadcastChannel !== "undefined") this.bc = new BroadcastChannel(BC_NAME);
    const { Peer } = await import("peerjs");
    const peer = new Peer(getWidgetPeerId());
    this.peer = peer;
    peer.on("connection", (conn) => {
      conn.on("open", () => {
        this.conns.add(conn);
        this.onViewers?.(this.conns.size);
        // A widget that (re)loads mid-session must learn the current state.
        conn.send({ t: this.lastVisible ? "show" : "hide" } as WidgetFrame);
      });
      const drop = () => { this.conns.delete(conn); this.onViewers?.(this.conns.size); };
      conn.on("close", drop);
      conn.on("error", drop);
    });
    peer.on("disconnected", () => { try { peer.reconnect(); } catch {} });
    peer.on("error", (e) => console.warn("[widgetBridge] peer error", e));
  }

  send(frame: WidgetFrame) {
    if (frame.t === "show") this.lastVisible = true;
    if (frame.t === "hide") this.lastVisible = false;
    this.bc?.postMessage(frame);
    this.conns.forEach((c) => { try { c.send(frame); } catch {} });
  }

  stop() {
    this.conns.forEach((c) => { try { c.close(); } catch {} });
    this.conns.clear();
    this.peer?.destroy();
    this.peer = null;
    this.bc?.close();
    this.bc = null;
  }
}

// ── Widget side ──────────────────────────────────────────────────────────────
export class WidgetReceiver {
  private peer: PeerType | null = null;
  private conn: DataConnection | null = null;
  private bc: BroadcastChannel | null = null;
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(private peerId: string | null, private onFrame: (f: WidgetFrame) => void) {}

  async start() {
    if (typeof BroadcastChannel !== "undefined") {
      this.bc = new BroadcastChannel(BC_NAME);
      this.bc.onmessage = (e) => this.onFrame(e.data as WidgetFrame);
    }
    if (this.peerId) await this.connectRemote();
  }

  private async connectRemote() {
    if (this.stopped || !this.peerId) return;
    const { Peer } = await import("peerjs");
    const peer = new Peer();
    this.peer = peer;
    const again = () => {
      if (this.stopped) return;
      if (this.retry) clearTimeout(this.retry);
      this.retry = setTimeout(() => {
        try { this.peer?.destroy(); } catch {}
        this.connectRemote();
      }, 3000);
    };
    peer.on("open", () => {
      const conn = peer.connect(this.peerId!, { reliable: true });
      this.conn = conn;
      conn.on("data", (d) => this.onFrame(d as WidgetFrame));
      conn.on("close", again);
      conn.on("error", again);
    });
    peer.on("error", again);
  }

  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    try { this.conn?.close(); } catch {}
    try { this.peer?.destroy(); } catch {}
    this.bc?.close();
  }
}
