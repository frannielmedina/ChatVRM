export type TwitchMessage = {
  username: string;
  message: string;
  color: string;
  timestamp: number;
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

export class TwitchClient {
  private ws: WebSocket | null = null;
  private channel = "";
  private reconnectTimer: any = null;
  private handlers: MessageHandler[] = [];
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
      this.ws!.send("CAP REQ :twitch.tv/tags");
      console.log(`[Twitch] Connected to #${this.channel}`);

      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send("PING :tmi.twitch.tv");
        }
      }, 60_000);
    };

    this.ws.onmessage = (event) => {
      const raw = event.data as string;
      // Handle PONG
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

  private parseMessage(raw: string) {
    // Parse Twitch IRC with tags
    const lines = raw.split("\r\n").filter(Boolean);
    for (const line of lines) {
      // Tags line: @key=value;key=value :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
      const tagMatch = line.match(/^@([^ ]+) :(\S+)!.*PRIVMSG #\S+ :(.+)$/);
      if (tagMatch) {
        const tagsStr = tagMatch[1];
        const userStr = tagMatch[2];
        const msg = tagMatch[3];

        const tags: Record<string, string> = {};
        tagsStr.split(";").forEach((tag) => {
          const [k, v] = tag.split("=");
          tags[k] = v;
        });

        const twitchMsg: TwitchMessage = {
          username: tags["display-name"] || userStr,
          message: msg,
          color: tags["color"] || "#9146FF",
          timestamp: Date.now(),
        };

        this.handlers.forEach((h) => h(twitchMsg));
        return;
      }

      // No-tag line
      const simpleMatch = line.match(/:(\S+)!.*PRIVMSG #\S+ :(.+)$/);
      if (simpleMatch) {
        const twitchMsg: TwitchMessage = {
          username: simpleMatch[1],
          message: simpleMatch[2],
          color: "#9146FF",
          timestamp: Date.now(),
        };
        this.handlers.forEach((h) => h(twitchMsg));
      }
    }
  }
}

export const twitchClient = new TwitchClient();
