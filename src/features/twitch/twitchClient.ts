export type TwitchMessage = {
  username: string;
  message: string;
  color: string;
  timestamp: number;
  isMod?: boolean;
  isBroadcaster?: boolean;
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

export class TwitchClient {
  private ws: WebSocket | null = null;
  private channel = "";
  private reconnectTimer: any = null;
  private handlers: MessageHandler[] = [];
  private commandHandlers: CommandHandler[] = [];
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
      // Request tags for mod/broadcaster status
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

  private parseMessage(raw: string) {
    const lines = raw.split("\r\n").filter(Boolean);
    for (const line of lines) {
      const tagMatch = line.match(/^@([^ ]+) :(\S+)!.*PRIVMSG #(\S+) :(.+)$/);
      if (tagMatch) {
        const tagsStr = tagMatch[1];
        const userStr = tagMatch[2];
        const channelStr = tagMatch[3];
        const msg = tagMatch[4];

        const tags: Record<string, string> = {};
        tagsStr.split(";").forEach((tag) => {
          const [k, v] = tag.split("=");
          tags[k] = v;
        });

        const isMod = tags["mod"] === "1";
        const isBroadcaster =
          tags["badges"]?.includes("broadcaster") ||
          userStr.toLowerCase() === this.channel.toLowerCase();

        const twitchMsg: TwitchMessage = {
          username: tags["display-name"] || userStr,
          message: msg,
          color: tags["color"] || "#9146FF",
          timestamp: Date.now(),
          isMod,
          isBroadcaster,
        };

        // Check for commands (only for mods/broadcaster)
        if ((isMod || isBroadcaster) && msg.trim().startsWith("!")) {
          const command = msg.trim().split(/\s+/)[0].toLowerCase();
          this.commandHandlers.forEach((h) => h(command, twitchMsg));
        }

        this.handlers.forEach((h) => h(twitchMsg));
        return;
      }

      // No-tag fallback
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
        };

        if (twitchMsg.isBroadcaster && simpleMatch[3].trim().startsWith("!")) {
          const command = simpleMatch[3].trim().split(/\s+/)[0].toLowerCase();
          this.commandHandlers.forEach((h) => h(command, twitchMsg));
        }

        this.handlers.forEach((h) => h(twitchMsg));
      }
    }
  }
}

export const twitchClient = new TwitchClient();
