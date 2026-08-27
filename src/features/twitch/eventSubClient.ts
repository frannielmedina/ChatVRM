// ── Twitch EventSub client ────────────────────────────────────────────────
// Connects to Twitch's EventSub WebSocket transport directly from the
// browser (no backend server needed) and subscribes to the events that
// power follow / raid / sub / resub / streak / bits alerts.
//
// Requires:
//  - A Twitch app Client ID (dev.twitch.tv/console/apps)
//  - A user access token for the broadcaster with these scopes:
//      moderator:read:followers   (follow alerts)
//      channel:read:subscriptions (sub / resub / streak alerts)
//      bits:read                  (bits / cheer alerts)
//      channel:manage:polls       (poll display + creation via /poll)
//      channel:manage:predictions (prediction display + creation via /prediction)
//    (raids need no extra scope beyond a valid user token)
//
// See Settings > Twitch in-app for the step-by-step to generate one.

const HELIX = "https://api.twitch.tv/helix";
const EVENTSUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws";

export type EventSubHandlers = {
  onFollow: (displayName: string) => void;
  onRaid: (fromDisplayName: string, viewers: number) => void;
  onSub: (displayName: string, tier: string) => void;
  // streakMonths is null if the subscriber chose not to share it — in that
  // case this fires as a plain resub instead of a streak alert.
  onResub: (displayName: string, cumulativeMonths: number, streakMonths: number | null) => void;
  onBits: (displayName: string, bits: number, message: string) => void;
  onStatus?: (status: "connecting" | "connected" | "error" | "disconnected", detail?: string) => void;
  // Fired once we've resolved the broadcaster's numeric Twitch user id —
  // useful for follow-up Helix calls like fetching channel emotes.
  onBroadcasterId?: (id: string) => void;
  // Polls/predictions — optional since not every caller cares about them.
  onPollBegin?: (id: string, title: string, options: string[]) => void;
  onPollProgress?: (id: string, options: { title: string; votes: number }[]) => void;
  onPollEnd?: (id: string, options: { title: string; votes: number }[], status: string) => void;
  onPredictionBegin?: (id: string, title: string, outcomes: string[]) => void;
  onPredictionProgress?: (
    id: string,
    outcomes: { title: string; users: number; points: number }[]
  ) => void;
  onPredictionLock?: (id: string, outcomes: { title: string; users: number; points: number }[]) => void;
  onPredictionEnd?: (
    id: string,
    outcomes: { title: string; users: number; points: number }[],
    winningOutcome: string | null,
    status: string
  ) => void;
};

type ConnectOpts = {
  clientId: string;
  accessToken: string; // raw token, no "oauth:" prefix
  channelLogin: string;
  handlers: EventSubHandlers;
};

function cleanToken(token: string): string {
  return token.replace(/^oauth:/i, "").trim();
}

async function helixFetch(path: string, clientId: string, token: string, init?: RequestInit) {
  const res = await fetch(`${HELIX}${path}`, {
    ...init,
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return res;
}

async function getBroadcasterId(
  clientId: string,
  token: string,
  login: string
): Promise<string | null> {
  const res = await helixFetch(`/users?login=${encodeURIComponent(login)}`, clientId, token);
  if (!res.ok) {
    console.error("[EventSub] Failed to look up broadcaster id", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data?.data?.[0]?.id ?? null;
}

async function createSubscription(
  clientId: string,
  token: string,
  sessionId: string,
  type: string,
  version: string,
  condition: Record<string, string>
) {
  const res = await helixFetch(`/eventsub/subscriptions`, clientId, token, {
    method: "POST",
    body: JSON.stringify({
      type,
      version,
      condition,
      transport: { method: "websocket", session_id: sessionId },
    }),
  });
  if (!res.ok) {
    // Don't hard-fail the whole connection if one subscription's scope is
    // missing (e.g. no bits:read yet) — just log it so the rest still work.
    console.error(`[EventSub] Could not subscribe to ${type}`, res.status, await res.text());
  }
}

export class EventSubClient {
  private ws: WebSocket | null = null;
  private handlers: EventSubHandlers | null = null;
  private manuallyClosed = false;

  async connect({ clientId, accessToken, channelLogin, handlers }: ConnectOpts) {
    this.disconnect();
    this.manuallyClosed = false;
    this.handlers = handlers;

    if (!clientId || !accessToken || !channelLogin) {
      handlers.onStatus?.("error", "Missing Client ID, access token, or channel name.");
      return;
    }

    const token = cleanToken(accessToken);
    handlers.onStatus?.("connecting");

    const broadcasterId = await getBroadcasterId(clientId, token, channelLogin);
    if (!broadcasterId) {
      handlers.onStatus?.(
        "error",
        "Couldn't resolve your channel to a Twitch user id — check the Client ID and token."
      );
      return;
    }
    handlers.onBroadcasterId?.(broadcasterId);

    this.openSocket(EVENTSUB_WS_URL, clientId, token, broadcasterId);
  }

  private openSocket(url: string, clientId: string, token: string, broadcasterId: string) {
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onmessage = async (event) => {
      let payload: any;
      try {
        payload = JSON.parse(event.data as string);
      } catch {
        return;
      }
      const msgType = payload?.metadata?.message_type;

      if (msgType === "session_welcome") {
        const sessionId = payload.payload.session.id;
        this.handlers?.onStatus?.("connected");
        await this.subscribeAll(clientId, token, sessionId, broadcasterId);
        return;
      }

      if (msgType === "session_reconnect") {
        const newUrl = payload.payload.session.reconnect_url;
        // Keep the old socket open until the new one is ready, per Twitch docs.
        const oldWs = this.ws;
        this.openSocket(newUrl, clientId, token, broadcasterId);
        setTimeout(() => oldWs?.close(), 5000);
        return;
      }

      if (msgType === "notification") {
        this.handleNotification(payload.payload);
        return;
      }

      if (msgType === "revocation") {
        console.warn("[EventSub] Subscription revoked", payload.payload);
      }
      // "session_keepalive" — nothing to do.
    };

    ws.onerror = (e) => {
      console.error("[EventSub] WS error", e);
      this.handlers?.onStatus?.("error", "WebSocket error — see console.");
    };

    ws.onclose = () => {
      if (!this.manuallyClosed) {
        this.handlers?.onStatus?.("disconnected", "Connection closed.");
      }
    };
  }

  private async subscribeAll(
    clientId: string,
    token: string,
    sessionId: string,
    broadcasterId: string
  ) {
    const modCondition = { broadcaster_user_id: broadcasterId, moderator_user_id: broadcasterId };
    const broadcasterCondition = { broadcaster_user_id: broadcasterId };
    const raidCondition = { to_broadcaster_user_id: broadcasterId };

    await Promise.all([
      createSubscription(clientId, token, sessionId, "channel.follow", "2", modCondition),
      createSubscription(clientId, token, sessionId, "channel.raid", "1", raidCondition),
      createSubscription(clientId, token, sessionId, "channel.subscribe", "1", broadcasterCondition),
      createSubscription(
        clientId,
        token,
        sessionId,
        "channel.subscription.message",
        "1",
        broadcasterCondition
      ),
      createSubscription(clientId, token, sessionId, "channel.cheer", "1", broadcasterCondition),
      createSubscription(clientId, token, sessionId, "channel.poll.begin", "1", broadcasterCondition),
      createSubscription(clientId, token, sessionId, "channel.poll.progress", "1", broadcasterCondition),
      createSubscription(clientId, token, sessionId, "channel.poll.end", "1", broadcasterCondition),
      createSubscription(
        clientId,
        token,
        sessionId,
        "channel.prediction.begin",
        "1",
        broadcasterCondition
      ),
      createSubscription(
        clientId,
        token,
        sessionId,
        "channel.prediction.progress",
        "1",
        broadcasterCondition
      ),
      createSubscription(clientId, token, sessionId, "channel.prediction.lock", "1", broadcasterCondition),
      createSubscription(clientId, token, sessionId, "channel.prediction.end", "1", broadcasterCondition),
    ]);
  }

  private handleNotification(payload: any) {
    const type = payload?.subscription?.type;
    const event = payload?.event;
    if (!event || !this.handlers) return;

    switch (type) {
      case "channel.follow":
        this.handlers.onFollow(event.user_name);
        break;
      case "channel.raid":
        this.handlers.onRaid(event.from_broadcaster_user_name, Number(event.viewers) || 0);
        break;
      case "channel.subscribe":
        // Gift subs also fire channel.subscribe — skip those here, gifted
        // sub alerts are a separate feature.
        if (!event.is_gift) {
          this.handlers.onSub(event.user_name, event.tier);
        }
        break;
      case "channel.subscription.message": {
        const streak: number | null =
          typeof event.streak_months === "number" && event.streak_months > 0
            ? event.streak_months
            : null;
        this.handlers.onResub(event.user_name, Number(event.cumulative_months) || 0, streak);
        break;
      }
      case "channel.cheer":
        this.handlers.onBits(
          event.is_anonymous ? "Anonymous" : event.user_name,
          Number(event.bits) || 0,
          event.message || ""
        );
        break;
      case "channel.poll.begin": {
        const options = (event.choices || []).map((c: any) => c.title);
        this.handlers.onPollBegin?.(event.id, event.title, options);
        break;
      }
      case "channel.poll.progress": {
        const options = (event.choices || []).map((c: any) => ({
          title: c.title,
          votes: Number(c.votes) || 0,
        }));
        this.handlers.onPollProgress?.(event.id, options);
        break;
      }
      case "channel.poll.end": {
        const options = (event.choices || []).map((c: any) => ({
          title: c.title,
          votes: Number(c.votes) || 0,
        }));
        this.handlers.onPollEnd?.(event.id, options, event.status || "completed");
        break;
      }
      case "channel.prediction.begin": {
        const outcomes = (event.outcomes || []).map((o: any) => o.title);
        this.handlers.onPredictionBegin?.(event.id, event.title, outcomes);
        break;
      }
      case "channel.prediction.progress": {
        const outcomes = (event.outcomes || []).map((o: any) => ({
          title: o.title,
          users: Number(o.users) || 0,
          points: Number(o.channel_points) || 0,
        }));
        this.handlers.onPredictionProgress?.(event.id, outcomes);
        break;
      }
      case "channel.prediction.lock": {
        const outcomes = (event.outcomes || []).map((o: any) => ({
          title: o.title,
          users: Number(o.users) || 0,
          points: Number(o.channel_points) || 0,
        }));
        this.handlers.onPredictionLock?.(event.id, outcomes);
        break;
      }
      case "channel.prediction.end": {
        const outcomes = (event.outcomes || []).map((o: any) => ({
          title: o.title,
          users: Number(o.users) || 0,
          points: Number(o.channel_points) || 0,
        }));
        const winner =
          (event.outcomes || []).find((o: any) => o.id === event.winning_outcome_id)?.title ??
          null;
        this.handlers.onPredictionEnd?.(event.id, outcomes, winner, event.status || "resolved");
        break;
      }
      default:
        break;
    }
  }

  disconnect() {
    this.manuallyClosed = true;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.handlers = null;
  }
}

export const eventSubClient = new EventSubClient();
