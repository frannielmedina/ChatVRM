import { TwitchMessage } from "@/features/twitch/twitchClient";
import { useEffect, useRef } from "react";

type Props = {
  messages: TwitchMessage[];
  isConnected: boolean;
  channel: string;
};

// ── Twitch emote rendering ────────────────────────────────────────────────────
// Twitch sends emote positions in the `emotes` IRC tag, e.g.:
//   "25:0-4,6-10/1902:12-16"
// Format: emoteId:startPos-endPos[,startPos-endPos][/emoteId:...]
// We parse this to replace text ranges with <img> elements.

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

function renderMessageWithEmotes(
  message: string,
  emotesTag?: string
): React.ReactNode[] {
  const emotes = emotesTag ? parseEmotesTag(emotesTag) : [];

  if (emotes.length === 0) {
    return [<span key="text">{message}</span>];
  }

  const nodes: React.ReactNode[] = [];
  // Use Array.from so multi-byte Unicode characters count as one position,
  // matching how Twitch counts character offsets.
  const chars = Array.from(message);
  let cursor = 0;

  for (const emote of emotes) {
    // Text before this emote
    if (emote.start > cursor) {
      const text = chars.slice(cursor, emote.start).join("");
      if (text) nodes.push(<span key={`t-${cursor}`}>{text}</span>);
    }
    // The emote image — Twitch CDN v2 supports light/dark and 1x/2x/3x
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

  // Text after last emote
  if (cursor < chars.length) {
    const text = chars.slice(cursor).join("");
    if (text) nodes.push(<span key={`t-end`}>{text}</span>);
  }

  return nodes;
}

// ── Badge SVG icons ───────────────────────────────────────────────────────────

const ModBadge = () => (
  <img
    src="https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1"
    alt="Mod"
    title="Moderator"
    style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle" }}
  />
);

const BroadcasterBadge = () => (
  <img
    src="https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcafa85b/1"
    alt="Broadcaster"
    title="Broadcaster"
    style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle" }}
  />
);

// ── Component ─────────────────────────────────────────────────────────────────

export const TwitchOverlay = ({ messages, isConnected, channel }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isConnected || messages.length === 0) return null;

  return (
    <div className="absolute left-0 bottom-80 z-20 w-80 max-h-72 overflow-hidden pointer-events-none select-none">
      <div className="px-8 py-4 bg-black/70 rounded-tr-8 rounded-br-8">
        {/* Channel header */}
        <div className="text-xs text-[#9146FF] font-bold mb-4 flex items-center gap-4">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#9146FF">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          #{channel}
        </div>

        {/* Messages */}
        <div className="flex flex-col gap-5 max-h-56 overflow-y-auto scroll-hidden">
          {messages.slice(-10).map((msg, i) => {
            const m = msg as TwitchMessage & {
              emotesTag?: string;
              badgeImages?: string[];
            };
            return (
              <div key={i} className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-snug items-center">
                {/* ── Badges ── */}
                {m.isBroadcaster && <BroadcasterBadge />}
                {m.isMod && !m.isBroadcaster && <ModBadge />}
                {/* Extra badge images from the parsed tags */}
                {m.badgeImages?.map((url, bi) => (
                  <img
                    key={bi}
                    src={url}
                    alt=""
                    style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle" }}
                  />
                ))}

                {/* ── Username ── */}
                <span
                  className="font-bold whitespace-nowrap"
                  style={{ color: m.color || "#9146FF" }}
                >
                  {m.username}:
                </span>

                {/* ── Message with inline emote images ── */}
                <span className="text-white/90 break-words flex flex-wrap items-center gap-0.5">
                  {renderMessageWithEmotes(m.message, m.emotesTag)}
                </span>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </div>
    </div>
  );
};
