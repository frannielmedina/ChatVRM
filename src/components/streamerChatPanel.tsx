import React, { useEffect, useRef, useState } from "react";
import { Message } from "@/features/messages/messages";
import { TwitchConfig, TwitchMessage } from "@/features/twitch/twitchClient";
import { twitchFeedStore } from "@/features/twitch/twitchFeedStore";
import { parseEmotesTag } from "@/features/twitch/twitchEmotes";

type Props = {
  chatLog: Message[];
  chatProcessing: boolean;
  twitchConfig: TwitchConfig;
  twitchConnected: boolean;
  onChangeTwitchConfig: (c: TwitchConfig) => void;
  onTwitchConnect: () => void;
  onTwitchDisconnect: () => void;
  /** Ask the AI. If `username` is set the message is handled as if that viewer had typed it in Twitch chat. */
  onSend: (text: string, username?: string) => void;
  /** Make the character say exactly this text (skips the LLM). */
  onOverride: (text: string) => void;
};

const stripTags = (t: string) => t.replace(/\[([a-zA-Z_ ]*?)\]/g, "").trim();

const renderTwitchText = (m: TwitchMessage) => {
  const ranges = parseEmotesTag(m.emotesTag || "");
  if (ranges.length === 0) return m.message;
  const chars = Array.from(m.message);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) out.push(chars.slice(cursor, r.start).join(""));
    out.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${r.id}-${i}`}
        src={`https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/1.0`}
        alt={chars.slice(r.start, r.end + 1).join("")}
        className="inline-block align-middle mx-2"
        style={{ width: 20, height: 20 }}
      />
    );
    cursor = r.end + 1;
  });
  if (cursor < chars.length) out.push(chars.slice(cursor).join(""));
  return out;
};

export const StreamerChatPanel = ({
  chatLog, chatProcessing, twitchConfig, twitchConnected, onChangeTwitchConfig,
  onTwitchConnect, onTwitchDisconnect, onSend, onOverride,
}: Props) => {
  const [view, setView] = useState<"conversation" | "twitch">("conversation");
  const [feed, setFeed] = useState<TwitchMessage[]>([]);
  const [text, setText] = useState("");
  const [username, setUsername] = useState("");
  const [override, setOverride] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => twitchFeedStore.subscribe(setFeed), []);

  // Stay pinned to the newest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatLog, feed, view]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    if (override) onOverride(t);
    else onSend(t, username.trim() || undefined);
    setText("");
  };

  const visibleLog = chatLog.filter((m) => m.role !== "system");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Twitch quick controls */}
      <div className="px-16 py-8 border-b border-surface3 bg-surface1/40 flex flex-wrap items-center gap-x-16 gap-y-4 text-sm">
        <button
          onClick={twitchConnected ? onTwitchDisconnect : onTwitchConnect}
          disabled={!twitchConnected && !twitchConfig.channel}
          title={!twitchConfig.channel ? "Set your channel in the Twitch tab first" : ""}
          className={`px-12 py-4 rounded-oval font-bold text-white disabled:opacity-40 ${
            twitchConnected ? "bg-secondary hover:bg-secondary-hover" : "bg-[#9146FF] hover:bg-[#a970ff]"
          }`}
        >
          {twitchConnected ? "Disconnect Twitch" : "Connect Twitch"}
        </button>
        <label className="flex items-center gap-6 cursor-pointer">
          <input type="checkbox" className="accent-primary" checked={twitchConfig.readChat}
            onChange={(e) => onChangeTwitchConfig({ ...twitchConfig, readChat: e.target.checked })} />
          Chat overlay
        </label>
        <label className="flex items-center gap-6 cursor-pointer">
          <input type="checkbox" className="accent-primary" checked={twitchConfig.respondToChat}
            onChange={(e) => onChangeTwitchConfig({ ...twitchConfig, respondToChat: e.target.checked })} />
          AI answers chat
        </label>
      </div>

      {/* View switch */}
      <div className="flex border-b border-surface3">
        {(["conversation", "twitch"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-8 text-sm font-bold border-b-2 ${
              view === v ? "border-primary text-primary" : "border-transparent text-text-primary/60"
            }`}
          >
            {v === "conversation" ? `Conversation (${visibleLog.length})` : `Twitch chat (${feed.length})`}
          </button>
        ))}
      </div>

      {/* History */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-16 py-12 bg-white">
        {view === "conversation" ? (
          visibleLog.length === 0 ? (
            <div className="text-sm text-text-primary/50 text-center mt-24">No messages yet.</div>
          ) : (
            visibleLog.map((m, i) => (
              <div key={i} className={`mb-8 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-12 py-8 rounded-12 text-sm break-words whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary/15" : "bg-surface1"
                  }`}
                >
                  {stripTags(m.content)}
                </div>
              </div>
            ))
          )
        ) : feed.length === 0 ? (
          <div className="text-sm text-text-primary/50 text-center mt-24">
            {twitchConnected ? "Waiting for chat…" : "Connect Twitch to see live chat here."}
          </div>
        ) : (
          feed.map((m, i) => (
            <div key={`${m.timestamp}-${i}`} className="text-sm mb-4 break-words">
              <span className="font-bold" style={{ color: m.color || "#9146FF" }}>{m.username}</span>
              <span className="text-text-primary/50">: </span>
              <span>{renderTwitchText(m)}</span>
            </div>
          ))
        )}
        {chatProcessing && <div className="text-xs text-text-primary/50 animate-pulse">thinking / speaking…</div>}
      </div>

      {/* Composer */}
      <div className="border-t border-surface3 p-12 bg-surface1/40">
        <div className="flex gap-8 mb-8">
          <input
            className="px-12 py-6 w-[34%] bg-surface3 hover:bg-surface3-hover rounded-8 text-sm disabled:opacity-40"
            placeholder="Send as… (optional)"
            title="Treat the message as if this viewer wrote it in Twitch chat"
            value={username}
            disabled={override}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label
            className="flex items-center gap-6 text-sm cursor-pointer"
            title="Skip the AI and make the character say exactly what you type (you can use [happy], [sad]… tags)"
          >
            <input type="checkbox" className="accent-primary" checked={override}
              onChange={(e) => setOverride(e.target.checked)} />
            <b>Override</b> <span className="text-text-primary/60">(say exactly this)</span>
          </label>
        </div>
        <div className="flex gap-8">
          <textarea
            rows={2}
            className="flex-1 px-12 py-8 bg-surface3 hover:bg-surface3-hover rounded-8 text-sm resize-none"
            placeholder={override ? "Text for the character to say…" : "Message to the AI…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            onClick={submit}
            disabled={!text.trim() || (chatProcessing && !override)}
            className="px-16 rounded-8 bg-primary hover:bg-primary-hover text-white font-bold disabled:bg-primary-disabled"
          >
            {override ? "Say" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};
