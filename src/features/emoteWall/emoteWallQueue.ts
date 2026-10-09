import { getThirdPartyChannelPool } from "@/features/twitch/thirdPartyEmotes";

export type EmoteDrop = {
  id: string;
  // Either a single emoji character or an image URL (Twitch / 7TV / BTTV / FFZ emote).
  content: string;
  isImage: boolean;
};

type Listener = (drops: EmoteDrop[]) => void;

// Safety valve: a raid spamming emotes shouldn't be able to bury the page in
// hundreds of animated DOM nodes.
const MAX_ON_SCREEN = 70;
// Max drops produced by a single chat message.
const MAX_PER_MESSAGE = 8;

class EmoteWallQueue {
  private drops: EmoteDrop[] = [];
  private listeners: Set<Listener> = new Set();

  spawnOne(content: string, isImage: boolean) {
    if (this.drops.length >= MAX_ON_SCREEN) return;
    const id = `emote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.drops = [...this.drops, { id, content, isImage }];
    this.emit();
  }

  remove(id: string) {
    const before = this.drops.length;
    this.drops = this.drops.filter((d) => d.id !== id);
    if (this.drops.length !== before) this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.drops);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l(this.drops));
  }
}

export const emoteWallQueue = new EmoteWallQueue();

// ── Convenience spawners ────────────────────────────────────────────────────

const FALLBACK_EMOJIS = ["🎉", "✨", "🔥", "💜", "⭐", "🎊", "💫"];

let channelEmoteUrls: string[] = [];
// Emotes viewers actually used recently — gives alert walls something
// channel-flavoured even when no Client ID / token is configured.
const recentChatEmoteUrls: string[] = [];
const RECENT_LIMIT = 40;

// Called once we've resolved the broadcaster's Twitch app credentials.
export function setChannelEmotes(urls: string[]) {
  channelEmoteUrls = urls;
}

function rememberRecent(urls: string[]) {
  for (const u of urls) {
    if (!recentChatEmoteUrls.includes(u)) recentChatEmoteUrls.push(u);
  }
  while (recentChatEmoteUrls.length > RECENT_LIMIT) recentChatEmoteUrls.shift();
}

export type ChatEmoteItem = { content: string; isImage: boolean };

// A chat message arrived: drop its emote images and any unicode emoji.
export function spawnFromChat(items: ChatEmoteItem[]) {
  if (items.length === 0) return;
  rememberRecent(items.filter((i) => i.isImage).map((i) => i.content));
  items.slice(0, MAX_PER_MESSAGE).forEach((item, i) => {
    setTimeout(() => emoteWallQueue.spawnOne(item.content, item.isImage), i * 120);
  });
}

// Kept for backwards compatibility with callers that only have emoji.
export function spawnEmojiFromChat(emojis: string[]) {
  spawnFromChat(emojis.map((content) => ({ content, isImage: false })));
}

// Bits cheered — drop a handful of gem emoji, scaled lightly with bit count.
export function spawnBitsWall(bits: number) {
  const count = Math.min(12, Math.max(2, Math.round(bits / 100)));
  for (let i = 0; i < count; i++) {
    setTimeout(() => emoteWallQueue.spawnOne("💎", false), i * 90);
  }
}

// A follow/raid/sub/resub/streak alert fired — drop a "wall" of the
// broadcaster's own emotes. Pool order of preference: the channel's uploaded
// Twitch emotes + 7TV/BTTV/FFZ channel emotes, then whatever chat has been
// using lately, then a festive emoji fallback.
export function spawnAlertEmoteWall(count = 14) {
  const imagePool = Array.from(
    new Set([...channelEmoteUrls, ...getThirdPartyChannelPool(), ...recentChatEmoteUrls])
  );
  const useImages = imagePool.length > 0;
  const pool = useImages ? imagePool : FALLBACK_EMOJIS;
  for (let i = 0; i < count; i++) {
    const content = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => emoteWallQueue.spawnOne(content, useImages), i * 70);
  }
}
