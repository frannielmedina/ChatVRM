import { TwitchBadge, TwitchMessage } from "@/features/twitch/twitchClient";
import { useEffect, useRef, useState } from "react";

type Props = {
  activeMessage: TwitchMessage | null;
  queuedCount: number;
  isConnected: boolean;
};

// ── Twitch emote rendering ────────────────────────────────────────────────────
interface EmoteRange {
  id: string;
  start: number;
  end: number;
}

function parseEmotesTag(emotesTag: string): EmoteRange[] {
  if (!emotesTag) return [];
  const ranges: EmoteRange[] = [];
  try {
    const emoteGroups = emotesTag.split("/");
    for (const group of emoteGroups) {
      const [id, positions] = group.split(":");
      if (!id || !positions) continue;
      for (const pos of positions.split(",")) {
        const [start, end] = pos.split("-").map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          ranges.push({ id, start, end });
        }
      }
    }
  } catch {
    // ignore malformed emote tags
  }
  return ranges.sort((a, b) => a.start - b.start);
}

// ── Link masking ──────────────────────────────────────────────────────────────
// Spambots often dodge naive URL regexes by adding a space before the dot
// (e.g. "streamboo .com"), so this matches "word[.]tld" with 0-2 spaces
// around the dot, plus regular http(s)/www links.
const LINK_REGEX =
  /\bhttps?:\/\/\S+|\bwww\.\S+\b|\b[a-zA-Z0-9-]{2,}\s{0,2}\.\s{0,2}(?:com|net|org|io|tv|gg|co|me|xyz|info|biz|live|stream|club|online|app|shop|store|link|us|uk|ca|de|ru|top|pro)\b/gi;

function maskLinks(text: string): string {
  return text.replace(LINK_REGEX, "[LINK]");
}

function renderMessageWithEmotes(
  message: string,
  emotesTag?: string
): React.ReactNode[] {
  const emotes = emotesTag ? parseEmotesTag(emotesTag) : [];

  if (emotes.length === 0) {
    return [<span key="text">{maskLinks(message)}</span>];
  }

  const nodes: React.ReactNode[] = [];
  const chars = Array.from(message);
  let cursor = 0;

  for (const emote of emotes) {
    if (emote.start > cursor) {
      const text = chars.slice(cursor, emote.start).join("");
      if (text) nodes.push(<span key={`t-${cursor}`}>{maskLinks(text)}</span>);
    }
    const altText = chars.slice(emote.start, emote.end + 1).join("");
    nodes.push(
      <img
        key={`e-${emote.id}-${emote.start}`}
        src={`https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`}
        alt={altText}
        title={altText}
        className="inline-block"
        style={{ width: 18, height: 18, verticalAlign: "middle", margin: "0 1px" }}
      />
    );
    cursor = emote.end + 1;
  }

  if (cursor < chars.length) {
    const text = chars.slice(cursor).join("");
    if (text) nodes.push(<span key="t-end">{maskLinks(text)}</span>);
  }

  return nodes;
}

// ── Badge rendering ────────────────────────────────────────────────────────────
// Badges come from a single source of truth (TwitchMessage.badgeImages, already
// de-duplicated in twitchClient.ts) so a user's broadcaster/mod badge never
// renders twice.
const Badge = ({ badge }: { badge: TwitchBadge }) => (
  <img
    src={badge.url}
    alt={badge.label}
    title={badge.label}
    style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle" }}
  />
);

// Accent color for the box's left border, based on the user's highest role
function accentColor(msg: TwitchMessage): string {
  if (msg.isBroadcaster) return "#FF617F"; // secondary
  if (msg.isMod) return "#3FCF6E"; // mod green
  if (msg.badgeImages?.some((b) => b.name === "vip")) return "#E5A6FF"; // vip pink-purple
  return "#9146FF"; // twitch purple default
}

// ── Component ─────────────────────────────────────────────────────────────────
// Boxed style: shows exactly one message at a time — the one Miko is currently
// replying to. It fades in when a new message starts being processed, and
// disappears the moment Miko finishes speaking (or is cleared early because
// the user got banned). If more messages are waiting, a small counter shows.

export const TwitchOverlay = ({ activeMessage, queuedCount, isConnected }: Props) => {
  const [displayed, setDisplayed] = useState<TwitchMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeMessage) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setDisplayed(activeMessage);
      // Next tick so the enter animation actually plays
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      // Keep rendering the box during the fade-out, then unmount
      hideTimer.current = setTimeout(() => setDisplayed(null), 200);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [activeMessage]);

  if (!isConnected || !displayed) return null;

  const m = displayed;

  return (
    <div
      className="absolute left-16 bottom-80 z-20 pointer-events-none select-none"
      style={{ maxWidth: 320 }}
    >
      <div
        className="px-12 py-8 bg-black/75 rounded-12 shadow-lg"
        style={{
          borderLeft: `4px solid ${accentColor(m)}`,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 200ms ease, transform 200ms ease",
        }}
      >
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs leading-snug items-center">
          {/* Badges */}
          {m.badgeImages?.map((badge) => (
            <Badge key={badge.name} badge={badge} />
          ))}

          {/* Username */}
          <span className="font-bold whitespace-nowrap" style={{ color: m.color || "#9146FF" }}>
            {m.username}:
          </span>

          {/* Message */}
          <span className="text-white/90 break-words flex flex-wrap items-center gap-0.5">
            {renderMessageWithEmotes(m.message, m.emotesTag)}
          </span>
        </div>
      </div>

      {queuedCount > 0 && (
        <div className="mt-4 px-8 py-2 bg-black/50 rounded-8 text-[10px] text-white/70 inline-block">
          +{queuedCount} more waiting
        </div>
      )}
    </div>
  );
};
