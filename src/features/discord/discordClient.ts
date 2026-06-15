import {
  DiscordConfig,
  DiscordMessage,
  DiscordVoiceEvent,
} from "./discordConfig";

// ── Discord Gateway opcodes ───────────────────────────────────────────────────
const GW_OPCODES = {
  DISPATCH:          0,
  HEARTBEAT:         1,
  IDENTIFY:          2,
  VOICE_STATE_UPDATE: 4,
  RESUME:            6,
  RECONNECT:         7,
  REQUEST_GUILD_MEMBERS: 8,
  INVALID_SESSION:   9,
  HELLO:             10,
  HEARTBEAT_ACK:     11,
};

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

type MessageHandler = (msg: DiscordMessage) => void;
type VoiceHandler = (event: DiscordVoiceEvent) => void;
type StatusHandler = (connected: boolean, error?: string) => void;

export class DiscordGatewayClient {
  private ws: WebSocket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;
  private lastSeq: number | null = null;
  private token = "";
  private config: DiscordConfig | null = null;

  private messageHandlers: MessageHandler[] = [];
  private voiceHandlers: VoiceHandler[] = [];
  private statusHandlers: StatusHandler[] = [];

  private _connected = false;
  private _destroyed = false;

  // ── Public connection state ──────────────────────────────────────────────
  get connected() { return this._connected; }

  // ── Subscribe helpers ────────────────────────────────────────────────────
  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
    return () => { this.messageHandlers = this.messageHandlers.filter(h => h !== handler); };
  }

  onVoiceEvent(handler: VoiceHandler) {
    this.voiceHandlers.push(handler);
    return () => { this.voiceHandlers = this.voiceHandlers.filter(h => h !== handler); };
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.push(handler);
    return () => { this.statusHandlers = this.statusHandlers.filter(h => h !== handler); };
  }

  // ── Connect ──────────────────────────────────────────────────────────────
  connect(config: DiscordConfig) {
    this.config = config;
    this.token = config.botToken;
    this._destroyed = false;
    this._openWebSocket();
  }

  disconnect() {
    this._destroyed = true;
    this._cleanup();
    this._connected = false;
    this.statusHandlers.forEach(h => h(false));
  }

  // ── Internal WebSocket lifecycle ─────────────────────────────────────────
  private _openWebSocket() {
    this._cleanup();
    try {
      this.ws = new WebSocket(GATEWAY_URL);
    } catch (e) {
      this._emitStatus(false, "Failed to connect to Discord Gateway");
      return;
    }

    this.ws.onopen = () => {
      console.log("[Discord] Gateway connected");
    };

    this.ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        this._handlePayload(payload);
      } catch (_) {}
    };

    this.ws.onerror = (e) => {
      console.error("[Discord] Gateway error", e);
      this._emitStatus(false, "WebSocket error");
    };

    this.ws.onclose = (ev) => {
      console.warn(`[Discord] Gateway closed (${ev.code}): ${ev.reason}`);
      this._connected = false;
      this._clearHeartbeat();

      if (!this._destroyed) {
        const delay = ev.code === 4004 ? 0 : 5000; // 4004 = auth failed, don't retry
        if (ev.code === 4004) {
          this._emitStatus(false, "Authentication failed — check your Bot Token");
          return;
        }
        if (ev.code === 4013 || ev.code === 4014) {
          this._emitStatus(false, "Missing intents — enable Message Content Intent in Discord Developer Portal");
          return;
        }
        this._emitStatus(false, `Disconnected (${ev.code}), reconnecting…`);
        this.reconnectTimer = setTimeout(() => this._openWebSocket(), delay || 5000);
      }
    };
  }

  private _handlePayload(payload: any) {
    const { op, d, s, t } = payload;

    if (s != null) this.lastSeq = s;

    switch (op) {
      case GW_OPCODES.HELLO:
        this._startHeartbeat(d.heartbeat_interval);
        this._identify();
        break;

      case GW_OPCODES.HEARTBEAT_ACK:
        break;

      case GW_OPCODES.HEARTBEAT:
        this._sendHeartbeat();
        break;

      case GW_OPCODES.RECONNECT:
        this._openWebSocket();
        break;

      case GW_OPCODES.INVALID_SESSION:
        this.sessionId = null;
        setTimeout(() => this._identify(), 1000);
        break;

      case GW_OPCODES.DISPATCH:
        this._handleDispatch(t, d);
        break;
    }
  }

  private _handleDispatch(event: string, data: any) {
    switch (event) {
      case "READY":
        this.sessionId = data.session_id;
        this._connected = true;
        this._emitStatus(true);
        console.log(`[Discord] Identified as ${data.user?.username}`);
        break;

      case "MESSAGE_CREATE": {
        const cfg = this.config;
        if (!cfg) break;

        // Filter to configured channel only
        if (cfg.channelId && data.channel_id !== cfg.channelId) break;
        // Ignore bot messages
        if (data.author?.bot) break;

        const isMention = (data.mentions ?? []).some(
          (m: any) => m.id === data.application_id
        ) || (data.content ?? "").includes("<@");

        if (cfg.respondToMentionsOnly && !isMention) break;

        const msg: DiscordMessage = {
          id: data.id,
          username: data.author?.username ?? "unknown",
          displayName: data.member?.nick ?? data.author?.global_name ?? data.author?.username ?? "Unknown",
          content: data.content ?? "",
          timestamp: Date.now(),
          avatarUrl: data.author?.avatar
            ? `https://cdn.discordapp.com/avatars/${data.author.id}/${data.author.avatar}.png`
            : undefined,
          color: data.member?.roles?.[0]?.color
            ? `#${data.member.roles[0].color.toString(16).padStart(6, "0")}`
            : "#5865F2",
          isMention,
          isBot: data.author?.bot ?? false,
        };

        this.messageHandlers.forEach(h => h(msg));
        break;
      }

      case "VOICE_STATE_UPDATE": {
        const cfg = this.config;
        if (!cfg || !cfg.voiceChannelId) break;
        if (data.channel_id !== cfg.voiceChannelId) break;

        // Voice state updates don't include speaking directly
        // We use VOICE_SERVER_UPDATE + SPEAKING events for that
        break;
      }

      case "VOICE_SPEAKING": {
        // Sent when a user in a voice channel starts/stops speaking
        const event: DiscordVoiceEvent = {
          userId: data.user_id ?? data.ssrc?.toString() ?? "",
          username: data.username ?? "Unknown",
          speaking: !!(data.speaking & 1), // bit 0 = voice activity
          timestamp: Date.now(),
        };
        this.voiceHandlers.forEach(h => h(event));
        break;
      }
    }
  }

  private _identify() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      op: GW_OPCODES.IDENTIFY,
      d: {
        token: this.token,
        intents: (1 << 9) | (1 << 15), // GUILD_MESSAGES + MESSAGE_CONTENT
        properties: {
          os: "browser",
          browser: "ChatVRM",
          device: "ChatVRM",
        },
      },
    }));
  }

  private _startHeartbeat(interval: number) {
    this._clearHeartbeat();
    // Jitter: start at interval * random to avoid thundering herd
    const jitter = Math.random() * interval;
    const hb = () => this._sendHeartbeat();
    setTimeout(() => {
      hb();
      this.heartbeatInterval = setInterval(hb, interval);
    }, jitter);
  }

  private _sendHeartbeat() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: GW_OPCODES.HEARTBEAT, d: this.lastSeq }));
    }
  }

  private _clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private _cleanup() {
    this._clearHeartbeat();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
  }

  private _emitStatus(connected: boolean, error?: string) {
    this.statusHandlers.forEach(h => h(connected, error));
  }
}

// Singleton
export const discordClient = new DiscordGatewayClient();
