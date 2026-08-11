// ── Alert Queue ────────────────────────────────────────────────────────────
// A single, app-wide place that any feature (Twitch alerts, ad countdown,
// polls/predictions, emote wall, etc.) can push a "thing to show in the
// top-right corner" into. Nothing in this file knows about Twitch, ads, or
// anything else — it's deliberately generic so later phases can plug in
// without touching this file again.
//
// Usage from anywhere in the app:
//   import { alertQueue } from "@/features/alerts/alertQueue";
//   alertQueue.push({ kind: "test", title: "Hello!", durationMs: 5000 });

export type AlertKind =
  | "test"
  | "ad_countdown"
  | "follow"
  | "raid"
  | "sub"
  | "resub"
  | "bits"
  | "streak"
  | "poll"
  | "prediction";

export type AlertItem = {
  // Unique id, auto-assigned if not supplied.
  id: string;
  kind: AlertKind;
  // Big bold line, e.g. "New Follower!" or "AD STARTS IN:"
  title: string;
  // Optional smaller line under the title, e.g. the username.
  subtitle?: string;
  // Optional image/emote/badge to show next to the text.
  imageUrl?: string;
  // How long the alert stays on screen before auto-dismissing.
  // Pass 0 / omit for alerts that manage their own lifetime (e.g. a
  // countdown component that removes itself when it hits zero).
  durationMs?: number;
  // Higher priority alerts are inserted before lower priority ones that
  // haven't started yet. Default 0.
  priority?: number;
  // Arbitrary payload a specific alert renderer can use
  // (e.g. { username, months } for a resub, or emote list for bits).
  data?: Record<string, unknown>;
};

type Listener = (queue: AlertItem[]) => void;

class AlertQueueSingleton {
  private queue: AlertItem[] = [];
  private listeners: Set<Listener> = new Set();

  push(alert: Omit<AlertItem, "id"> & { id?: string }): string {
    const id = alert.id ?? `${alert.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: AlertItem = { ...alert, id };
    const priority = item.priority ?? 0;

    // Insert ordered by priority (higher first), stable among equals.
    const insertAt = this.queue.findIndex((a) => (a.priority ?? 0) < priority);
    if (insertAt === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertAt, 0, item);
    }
    this.emit();
    return id;
  }

  remove(id: string) {
    const before = this.queue.length;
    this.queue = this.queue.filter((a) => a.id !== id);
    if (this.queue.length !== before) this.emit();
  }

  clear() {
    this.queue = [];
    this.emit();
  }

  getAll(): AlertItem[] {
    return this.queue;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.queue);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l(this.queue));
  }
}

export const alertQueue = new AlertQueueSingleton();

// Convenience helper used by the Settings > Twitch "Test Alert" button, and
// by any future "Test" button — every alert type is reachable through the
// same push() API so test buttons are one-liners.
export function pushTestAlert() {
  alertQueue.push({
    kind: "test",
    title: "Test Alert",
    subtitle: "This is what an alert looks like",
    durationMs: 5000,
  });
}
