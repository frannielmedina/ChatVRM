import { useEffect } from "react";
import { CLAIM_ON_LOAD_KEY, STANDBY_KEY, createLink } from "@/features/streamer/streamerLink";

/** Shown in a tab that handed control to another tab (see streamerLink.ts). */
export const StandbyScreen = () => {
  useEffect(() => {
    // When the tab that took over closes, wake up automatically.
    const link = createLink((msg) => {
      if (msg.type === "released") {
        window.sessionStorage.removeItem(STANDBY_KEY);
        window.location.reload();
      }
    });
    return () => link.close();
  }, []);

  const resume = () => {
    window.sessionStorage.removeItem(STANDBY_KEY);
    window.sessionStorage.setItem(CLAIM_ON_LOAD_KEY, "1");
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-base font-M_PLUS_2">
      <div className="max-w-md mx-16 p-32 bg-white rounded-16 shadow-2xl text-center text-text-primary">
        <div className="typography-24 font-bold mb-8">🎬 Running in another tab</div>
        <div className="text-sm text-text-primary/70 mb-20">
          Streamer Mode (or another ChatVRM tab) is in control, including Twitch chat and voice.
          This tab is paused so the AI doesn&apos;t answer twice. It wakes up by itself when that tab closes.
        </div>
        <button
          onClick={resume}
          className="px-24 py-8 bg-primary hover:bg-primary-hover text-white font-bold rounded-oval"
        >
          Take control here instead
        </button>
      </div>
    </div>
  );
};
