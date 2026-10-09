import { BroadcastState } from "@/features/streamer/rtmpBroadcaster";

type Props = {
  visible: boolean;
  broadcast: BroadcastState;
  fps: number;
  onGoLive: () => void;
  onStop: () => void;
};

// Floating bar in the streamer window. Auto-hides with the rest of the UI,
// so it doesn't appear in the captured stream unless you move the mouse.
export const StreamerToolbar = ({ visible, broadcast, fps, onGoLive, onStop }: Props) => {
  const live = broadcast.status === "live";
  const busy = broadcast.status === "capturing" || broadcast.status === "connecting";
  return (
    <div
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-8 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="px-12 py-6 rounded-oval bg-black/70 text-white text-xs font-bold">{fps} FPS</div>
      {live ? (
        <button onClick={onStop} className="px-16 py-6 rounded-oval bg-red-500 text-white text-sm font-bold animate-pulse">
          ■ End stream · {broadcast.stats.kbps} kbps
        </button>
      ) : (
        <button
          onClick={onGoLive}
          disabled={busy}
          className="px-16 py-6 rounded-oval bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Starting…" : "● Go Live"}
        </button>
      )}
      {broadcast.error && (
        <div className="px-12 py-6 rounded-oval bg-secondary text-white text-xs font-bold max-w-[360px] truncate" title={broadcast.error}>
          {broadcast.error}
        </div>
      )}
    </div>
  );
};
