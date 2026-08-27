export type EmoteDrop = {
  id: string;
  // Either a single emoji character or an image URL (Twitch custom emote).
  content: string;
  isImage: boolean;
};

type Listener = (drops: EmoteDrop[]) => void;

class EmoteWallQueue {
  private drops: EmoteDrop[] = [];
  private listeners: Set<Listener> = new Set();

  spawnOne(content: string, isImage: boolean) {
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

// Called once we've resolved the broadcaster's Twitch app credentials — see
// twitchEmotes.ts. Falls back to plain emoji if this is never called (e.g.
// testing the wall before Twitch alerts are fully connected).
export function setChannelEmotes(urls: string[]) {
  channelEmoteUrls = urls;
}

// A user typed emoji in chat — drop each one individually.
export function spawnEmojiFromChat(emojis: string[]) {
  emojis.slice(0, 6).forEach((e, i) => {
    setTimeout(() => emoteWallQueue.spawnOne(e, false), i * 120);
  });
}

// Bits cheered — drop a handful of gem emoji, scaled lightly with bit count.
export function spawnBitsWall(bits: number) {
  const count = Math.min(12, Math.max(2, Math.round(bits / 100)));
  for (let i = 0; i < count; i++) {
    setTimeout(() => emoteWallQueue.spawnOne("💎", false), i * 90);
  }
}

// A follow/raid/sub/resub/streak alert fired — drop a "wall" of the
// broadcaster's own uploaded Twitch emotes (or a festive fallback if we
// haven't fetched those yet).
export function spawnAlertEmoteWall(count = 14) {
  const pool = channelEmoteUrls.length > 0 ? channelEmoteUrls : FALLBACK_EMOJIS;
  const isImage = channelEmoteUrls.length > 0;
  for (let i = 0; i < count; i++) {
    const content = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => emoteWallQueue.spawnOne(content, isImage), i * 70);
  }
}
