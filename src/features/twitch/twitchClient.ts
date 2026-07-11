export type TwitchMessage = {
  username: string;
  message: string;
  color: string;
  timestamp: number;
  isMod?: boolean;
  isBroadcaster?: boolean;
  // Extended fields parsed from IRC tags
  emotesTag?: string;      // raw emotes tag value, e.g. "25:0-4/112291:6-15"
  badgeImages?: TwitchBadge[]; // CDN URLs + names for all badges the user has
};

export type TwitchBadge = {
  name: string; // e.g. "broadcaster", "moderator", "vip", "subscriber"
  label: string; // human readable, used for the tooltip/title
  url: string;
};

export type TwitchBanEvent = {
  username: string;
  permanent: boolean; // false = timeout (temporary), true = permanent ban
};

export type TwitchConfig = {
  enabled: boolean;
  channel: string;
  oauthToken?: string;
  readChat: boolean;
  respondToChat: boolean;
};

export const DEFAULT_TWITCH_CONFIG: TwitchConfig = {
  enabled: false,
  channel: "",
  oauthToken: "",
  readChat: true,
  respondToChat: false,
};

type MessageHandler = (msg: TwitchMessage) => void;
type CommandHandler = (command: string, msg: TwitchMessage) => void;

// ── Badge CDN URL builder ─────────────────────────────────────────────────────
// Twitch sends badges like "broadcaster/1,subscriber/6,bits/1000"
// We map known badge set names to their CDN image URLs.
// For unlisted badges we fall back to the Twitch Badges API URL pattern.
const KNOWN_BADGE_URLS: Record<string, (version: string) => string> = {
  broadcaster: () =>
    "https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1",
  moderator: () =>
    "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1",
  vip: () =>
    "https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/1",
  subscriber: (v) =>
    `https://static-cdn.jtvnw.net/badges/v1/subscriber/${v}/1`,
  // Well-known global badges
  "bits-leader": () =>
    "https://static-cdn.jtvnw.net/badges/v1/8bedf8c3-7a6a-4d16-9b10-7d4b7b8d3f5b/1",
  partner: () =>
    "https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1",
  turbo: () =>
    "https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/1",
  premium: () =>
    "https://static-cdn.jtvnw.net/badges/v1/a1dd5073-19c3-4911-8cb4-c464a7bc1510/1",
  "no_audio": () =>
    "https://static-cdn.jtvnw.net/badges/v1/aef2cd08-f29b-45a1-8c12-d44d7fd5e6f0/1",
  "no_video": () =>
    "https://static-cdn.jtvnw.net/badges/v1/199a0dab-75d5-4c2d-a74c-19f4be4bc2fc/1",
};

// Human-readable labels shown in the badge tooltip (title attribute)
const BADGE_LABELS: Record<string, string> = {
  broadcaster: "Broadcaster",
  moderator: "Moderator",
  vip: "VIP",
  subscriber: "Subscriber",
  "bits-leader": "Bits Leader",
  partner: "Partner",
  turbo: "Turbo",
  premium: "Prime Gaming",
  no_audio: "No Audio",
  no_video: "No Video",
};

function parseBadgeImages(badgesStr: string): TwitchBadge[] {
  if (!badgesStr) return [];
  const badges: TwitchBadge[] = [];
  const seen = new Set<string>();
  for (const badge of badgesStr.split(",")) {
    const [name, version] = badge.split("/");
    if (!name || seen.has(name)) continue;
    const resolver = KNOWN_BADGE_URLS[name];
    if (resolver) {
      seen.add(name);
      badges.push({
        name,
        label: BADGE_LABELS[name] || name,
        url: resolver(version || "1"),
      });
    }
    // Unknown badges: we skip rather than guess a broken URL
  }
  return badges;
}

export class TwitchClient {
  private ws: WebSocket | null = null;
  private channel = "";
  private reconnectTimer: any = null;
  private handlers: MessageHandler[] = [];
  private commandHandlers: CommandHandler[] = [];
  private banHandlers: ((e: TwitchBanEvent) => void)[] = [];
  private pingInterval: any = null;

  connect(channel: string, oauthToken?: string) {
    this.channel = channel.toLowerCase().replace("#", "");
    this.disconnect();

    this.ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

    this.ws.onopen = () => {
      const token = oauthToken || "SCHMOOPIIE";
      this.ws!.send(`PASS oauth:${token}`);
      this.ws!.send(`NICK justinfan${Math.floor(Math.random() * 99999)}`);
      this.ws!.send(`JOIN #${this.channel}`);
      // Request tags for emotes, badges, mod/broadcaster status, etc.
      this.ws!.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      console.log(`[Twitch] Connected to #${this.channel}`);

      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send("PING :tmi.twitch.tv");
        }
      }, 60_000);
    };

    this.ws.onmessage = (event) => {
      const raw = event.data as string;
      if (raw.startsWith("PING")) {
        this.ws?.send("PONG :tmi.twitch.tv");
        return;
      }
      this.parseMessage(raw);
    };

    this.ws.onerror = (e) => console.error("[Twitch] WS error", e);

    this.ws.onclose = () => {
      console.log("[Twitch] Disconnected — reconnecting in 5s…");
      clearInterval(this.pingInterval);
      this.reconnectTimer = setTimeout(
        () => this.connect(this.channel, oauthToken),
        5_000
      );
    };
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  onCommand(handler: CommandHandler) {
    this.commandHandlers.push(handler);
    return () => {
      this.commandHandlers = this.commandHandlers.filter((h) => h !== handler);
    };
  }

  // Fires when a user is banned or timed out in the channel (via CLEARCHAT),
  // regardless of whether a human mod or a moderation bot issued the ban.
  onBan(handler: (e: TwitchBanEvent) => void) {
    this.banHandlers.push(handler);
    return () => {
      this.banHandlers = this.banHandlers.filter((h) => h !== handler);
    };
  }

  private parseMessage(raw: string) {
    const lines = raw.split("\r\n").filter(Boolean);
    for (const line of lines) {
      // ── CLEARCHAT (ban / timeout) ──────────────────────────────────────
      // Twitch relays this for ANY ban/timeout in the channel, whether it
      // was issued by a human mod or a moderation bot, so this is the
      // single source of truth for "this user just got banned".
      const clearChatMatch = line.match(
        /^@([^ ]+) :tmi\.twitch\.tv CLEARCHAT #\S+(?: :(\S+))?$/
      );
      if (clearChatMatch) {
        const targetUser = clearChatMatch[2];
        if (targetUser) {
          const tagsStr = clearChatMatch[1];
          const tags: Record<string, string> = {};
          tagsStr.split(";").forEach((tag) => {
            const eqIdx = tag.indexOf("=");
            if (eqIdx === -1) return;
            tags[tag.slice(0, eqIdx)] = tag.slice(eqIdx + 1);
          });
          const banEvent: TwitchBanEvent = {
            username: targetUser,
            permanent: !tags["ban-duration"],
          };
          this.banHandlers.forEach((h) => h(banEvent));
        }
        continue;
      }

      // ── Tagged PRIVMSG ──────────────────────────────────────────────────
      const tagMatch = line.match(/^@([^ ]+) :(\S+)!.*PRIVMSG #(\S+) :(.+)$/);
      if (tagMatch) {
        const tagsStr = tagMatch[1];
        const userStr = tagMatch[2];
        const msg = tagMatch[4];

        // Parse IRC tags into a key→value map
        const tags: Record<string, string> = {};
        tagsStr.split(";").forEach((tag) => {
          const eqIdx = tag.indexOf("=");
          if (eqIdx === -1) return;
          tags[tag.slice(0, eqIdx)] = tag.slice(eqIdx + 1);
        });

        const isMod = tags["mod"] === "1";
        const badgesStr = tags["badges"] || "";
        const isBroadcaster =
          badgesStr.includes("broadcaster") ||
          userStr.toLowerCase() === this.channel.toLowerCase();

        const twitchMsg: TwitchMessage = {
          username: tags["display-name"] || userStr,
          message: msg,
          color: tags["color"] || "#9146FF",
          timestamp: Date.now(),
          isMod,
          isBroadcaster,
          // Pass through the raw emotes tag for rendering
          emotesTag: tags["emotes"] || "",
          // Parse badge CDN URLs (subscriber, bits, VIP, partner, etc.)
          badgeImages: parseBadgeImages(badgesStr),
        };

        // Commands — only mods and broadcaster
        if ((isMod || isBroadcaster) && msg.trim().startsWith("!")) {
          const command = msg.trim().split(/\s+/)[0].toLowerCase();
          this.commandHandlers.forEach((h) => h(command, twitchMsg));
        }

        this.handlers.forEach((h) => h(twitchMsg));
        continue;
      }

      // ── Untagged PRIVMSG fallback ───────────────────────────────────────
      const simpleMatch = line.match(/:(\S+)!.*PRIVMSG #(\S+) :(.+)$/);
      if (simpleMatch) {
        const twitchMsg: TwitchMessage = {
          username: simpleMatch[1],
          message: simpleMatch[3],
          color: "#9146FF",
          timestamp: Date.now(),
          isMod: false,
          isBroadcaster:
            simpleMatch[1].toLowerCase() === this.channel.toLowerCase(),
          emotesTag: "",
          badgeImages: [],
        };

        if (
          twitchMsg.isBroadcaster &&
          simpleMatch[3].trim().startsWith("!")
        ) {
          const command = simpleMatch[3].trim().split(/\s+/)[0].toLowerCase();
          this.commandHandlers.forEach((h) => h(command, twitchMsg));
        }

        this.handlers.forEach((h) => h(twitchMsg));
      }
    }
  }
}

export const twitchClient = new TwitchClient();
