import { useCallback, useRef } from "react";
import { alertQueue } from "@/features/alerts/alertQueue";
import { AdBreakConfig } from "./adBreakConfig";

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Params = {
  config: AdBreakConfig;
  // Whether Twitch is actually connected right now — the "subscribe" and
  // "we're back" lines only make sense to say if Twitch is configured and
  // live, per the request. The visual countdown still runs either way so
  // the Test button works without a live connection.
  isTwitchActive: () => boolean;
  sendPrompt: (text: string) => Promise<void>;
};

export function useAdBreak({ config, isTwitchActive, sendPrompt }: Params) {
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  const startAdCountdown = useCallback(
    (overrideSeconds?: number) => {
      if (!config.enabled || runningRef.current) return;
      runningRef.current = true;

      const duration = overrideSeconds ?? config.durationSeconds;
      let remaining = duration;

      const id = alertQueue.push({
        kind: "ad_countdown",
        title: "AD STARTS IN:",
        subtitle: formatMMSS(remaining),
      });

      if (isTwitchActive()) {
        sendPrompt(
          `[Ad Break] We're going to a short ad break in ${duration} seconds. Give viewers a quick, friendly reminder to subscribe to the channel before we go.`
        ).catch((e) => console.error("[AdBreak] subscribe line failed", e));
      }

      tickIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
          alertQueue.remove(id);
          runningRef.current = false;

          if (isTwitchActive()) {
            sendPrompt(
              "[Ad Break] The ad break just ended and we're back live. Welcome viewers back in your own words."
            ).catch((e) => console.error("[AdBreak] welcome-back line failed", e));
          }
          return;
        }
        alertQueue.update(id, { subtitle: formatMMSS(remaining) });
      }, 1000);
    },
    [config.enabled, config.durationSeconds, isTwitchActive, sendPrompt]
  );

  return { startAdCountdown };
}
