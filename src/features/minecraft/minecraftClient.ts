import {
  MinecraftChatMessage,
  MinecraftConfig,
  MinecraftGameEvent,
  MinecraftStatus,
} from "./minecraftConfig";

type StatusHandler = (s: MinecraftStatus) => void;
type ChatHandler = (m: MinecraftChatMessage) => void;
type EventHandler = (e: MinecraftGameEvent) => void;

/** Talks to tools/minecraft-bridge over WebSocket. One instance for the whole app. */
export class MinecraftBridgeClient {
  private ws: WebSocket | null = null;
  private statusHandlers: StatusHandler[] = [];
  private chatHandlers: ChatHandler[] = [];
  private eventHandlers: EventHandler[] = [];
  private status: MinecraftStatus = { state: "idle" };
  private intentionalClose = false;

  get connected() {
    return this.status.state === "connected";
  }

  onStatus(h: StatusHandler) {
    this.statusHandlers.push(h);
    return () => { this.statusHandlers = this.statusHandlers.filter((x) => x !== h); };
  }
  onChat(h: ChatHandler) {
    this.chatHandlers.push(h);
    return () => { this.chatHandlers = this.chatHandlers.filter((x) => x !== h); };
  }
  onEvent(h: EventHandler) {
    this.eventHandlers.push(h);
    return () => { this.eventHandlers = this.eventHandlers.filter((x) => x !== h); };
  }

  private setStatus(next: MinecraftStatus) {
    this.status = next;
    this.statusHandlers.forEach((h) => h(next));
  }

  connect(config: MinecraftConfig) {
    this.disconnect(true);
    this.intentionalClose = false;
    this.setStatus({ state: "connecting", message: "Contacting the bridge…" });

    let ws: WebSocket;
    try {
      ws = new WebSocket(config.bridgeUrl);
    } catch (e: any) {
      this.setStatus({ state: "error", message: `Invalid bridge URL: ${e?.message ?? e}` });
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.setStatus({ state: "bridge", message: "Bridge reached — joining the server…" });
      ws.send(
        JSON.stringify({
          type: "connect",
          host: config.host,
          port: config.port,
          username: config.botName,
          version: config.version,
          auth: config.auth,
        })
      );
    };

    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data as string); } catch { return; }

      switch (msg.type) {
        case "status":
          if (msg.state === "connecting") {
            this.setStatus({ state: "connecting", message: `Joining ${msg.host}:${msg.port}…` });
          } else if (msg.state === "connected") {
            this.setStatus({ state: "connected", version: msg.version, players: msg.players });
          } else if (msg.state === "kicked") {
            this.setStatus({ state: "kicked", message: msg.message });
          } else if (msg.state === "disconnected") {
            // keep an error message that arrived just before the disconnect
            this.setStatus({
              state: this.status.state === "error" ? "error" : "bridge",
              message: this.status.state === "error" ? this.status.message : msg.message || "Left the server.",
            });
          }
          break;
        case "msaCode":
          this.setStatus({ ...this.status, msaCode: { url: msg.url, code: msg.code } });
          break;
        case "chat":
          this.chatHandlers.forEach((h) => h({ username: msg.username, message: msg.message, whisper: false }));
          break;
        case "whisper":
          this.chatHandlers.forEach((h) => h({ username: msg.username, message: msg.message, whisper: true }));
          break;
        case "event":
          this.eventHandlers.forEach((h) => h(msg as MinecraftGameEvent));
          break;
        case "error":
          this.setStatus({ state: "error", message: msg.message });
          break;
        default:
          break;
      }
    };

    ws.onerror = () => {
      this.setStatus({
        state: "error",
        message: "Can't reach the bridge. Start it with: cd tools/minecraft-bridge && npm install && npm start",
      });
    };

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.intentionalClose) return;
      if (this.status.state !== "error") {
        this.setStatus({ state: "idle", message: "Bridge connection closed." });
      }
    };
  }

  /** Type a line (or a long reply — the bridge splits it) into Minecraft chat. */
  say(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN && this.connected && text.trim()) {
      this.ws.send(JSON.stringify({ type: "chat", message: text }));
    }
  }

  disconnect(silent = false) {
    this.intentionalClose = true;
    if (this.ws) {
      try { this.ws.send(JSON.stringify({ type: "disconnect" })); } catch { /* socket already closing */ }
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    if (!silent) this.setStatus({ state: "idle" });
  }
}

export const minecraftClient = new MinecraftBridgeClient();
