export type PollOption = { title: string; votes: number };
export type PredictionOutcome = { title: string; users: number; points: number };

export type ActivePollPrediction =
  | {
      kind: "poll";
      id: string;
      title: string;
      options: PollOption[];
      status: "active" | "ended";
    }
  | {
      kind: "prediction";
      id: string;
      title: string;
      outcomes: PredictionOutcome[];
      status: "active" | "locked" | "ended";
    };

type Listener = (state: ActivePollPrediction | null) => void;

class PollPredictionStore {
  private current: ActivePollPrediction | null = null;
  private listeners: Set<Listener> = new Set();
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  setState(next: ActivePollPrediction | null) {
    this.clearHideTimer();
    this.current = next;
    this.emit();
  }

  // Called when begin/progress events come in — keeps the same id, patches
  // fields (vote counts, status) without resetting the card's mount/animation.
  update(patch: Partial<ActivePollPrediction> & { id: string }) {
    if (!this.current || this.current.id !== patch.id) return;
    this.current = { ...this.current, ...patch } as ActivePollPrediction;
    this.emit();
  }

  // Keeps the final results on screen for `afterMs` (spec: 1 minute), then
  // clears automatically.
  finish(afterMs = 60000) {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.current = null;
      this.emit();
    }, afterMs);
  }

  clear() {
    this.clearHideTimer();
    this.current = null;
    this.emit();
  }

  getCurrent() {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private clearHideTimer() {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private emit() {
    this.listeners.forEach((l) => l(this.current));
  }
}

export const pollPredictionStore = new PollPredictionStore();
