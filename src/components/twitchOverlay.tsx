import { TwitchMessage } from "@/features/twitch/twitchClient";
import { useEffect, useRef } from "react";

type Props = {
  messages: TwitchMessage[];
  isConnected: boolean;
  channel: string;
};

export const TwitchOverlay = ({ messages, isConnected, channel }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isConnected || messages.length === 0) return null;

  return (
    <div className="absolute left-0 bottom-80 z-20 w-72 max-h-64 overflow-hidden pointer-events-none select-none">
      <div className="px-8 py-4 bg-black/70 rounded-tr-8 rounded-br-8">
        <div className="text-xs text-[#9146FF] font-bold mb-4 flex items-center gap-4">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#9146FF">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
          </svg>
          #{channel}
        </div>
        <div className="flex flex-col gap-4 max-h-48 overflow-y-auto scroll-hidden">
          {messages.slice(-8).map((msg, i) => (
            <div key={i} className="flex gap-4 text-xs leading-tight">
              <span
                className="font-bold whitespace-nowrap"
                style={{ color: msg.color || "#9146FF" }}
              >
                {msg.username}:
              </span>
              <span className="text-white/90 break-words">{msg.message}</span>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </div>
    </div>
  );
};
