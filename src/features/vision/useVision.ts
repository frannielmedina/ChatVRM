import { useCallback, useEffect, useRef, useState } from "react";
import { VisionConfig } from "./visionConfig";
import {
  captureFrameFromStream,
  captureFrameFromVideoElement,
  analyzeFrameWithVision,
} from "./visionProvider";

export type VisionStatus =
  | "idle"
  | "capturing"
  | "analyzing"
  | "ready"
  | "error"
  | "no_stream";

export type VisionHookResult = {
  status: VisionStatus;
  lastDescription: string;
  lastCaptureTime: Date | null;
  secondsUntilNext: number;
  captureNow: () => Promise<void>;
  error: string | null;
};

/**
 * useVision — periodically captures the screen share stream (or VDO.Ninja
 * iframe via a hidden video element) and sends it to Llama 4 Scout for
 * in-character commentary.
 */
export function useVision(
  config: VisionConfig,
  stream: MediaStream | null,
  screenShareMode: "chrome" | "vdoninja",
  systemPrompt: string,
  onDescription: (description: string) => void
): VisionHookResult {
  const [status, setStatus] = useState<VisionStatus>("idle");
  const [lastDescription, setLastDescription] = useState("");
  const [lastCaptureTime, setLastCaptureTime] = useState<Date | null>(null);
  const [secondsUntilNext, setSecondsUntilNext] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs to avoid stale closures in timers
  const configRef        = useRef(config);
  const streamRef        = useRef(stream);
  const modeRef          = useRef(screenShareMode);
  const systemPromptRef  = useRef(systemPrompt);
  const onDescriptionRef = useRef(onDescription);
  const isRunningRef     = useRef(false);

  useEffect(() => { configRef.current       = config;        }, [config]);
  useEffect(() => { streamRef.current       = stream;        }, [stream]);
  useEffect(() => { modeRef.current         = screenShareMode; }, [screenShareMode]);
  useEffect(() => { systemPromptRef.current = systemPrompt;  }, [systemPrompt]);
  useEffect(() => { onDescriptionRef.current = onDescription; }, [onDescription]);

  const intervalTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextCaptureTimeRef = useRef<number>(0);

  // ── Core capture function ──────────────────────────────────────────────────
  const runCapture = useCallback(async () => {
    if (isRunningRef.current) return;

    const cfg    = configRef.current;
    const mode   = modeRef.current;
    const active = streamRef.current;

    // For chrome mode, we need a live stream
    if (mode === "chrome" && (!active || !active.getVideoTracks()[0] || active.getVideoTracks()[0].readyState !== "live")) {
      setStatus("no_stream");
      setError("No active screen share stream. Start Chrome screen share first.");
      return;
    }

    isRunningRef.current = true;
    setError(null);

    try {
      setStatus("capturing");

      let frame: string | null = null;

      if (mode === "chrome" && active) {
        // Capture from the MediaStream directly
        frame = await captureFrameFromStream(active, 0.65);
      } else if (mode === "vdoninja") {
        // Capture from the VDO.Ninja iframe's video element
        frame = await captureFrameFromVideoElement();
      }

      if (!frame) {
        setStatus("error");
        setError(
          mode === "vdoninja"
            ? "Could not capture from VDO.Ninja. Make sure the iframe has loaded and a video is playing."
            : "Could not capture frame. Is the stream still active?"
        );
        isRunningRef.current = false;
        return;
      }

      setStatus("analyzing");
      const result = await analyzeFrameWithVision(
        frame,
        systemPromptRef.current,
        cfg
      );

      if (result.error) {
        setStatus("error");
        setError(result.error);
        isRunningRef.current = false;
        return;
      }

      if (result.description) {
        setLastDescription(result.description);
        setLastCaptureTime(new Date());
        setStatus("ready");
        const chatText = `[vision_observation] ${result.description}`;
        onDescriptionRef.current(chatText);
      } else {
        setStatus("idle");
      }
    } catch (e: any) {
      console.error("[vision] runCapture error:", e);
      setStatus("error");
      setError(e.message);
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  // ── Manual trigger ─────────────────────────────────────────────────────────
  const captureNow = useCallback(async () => {
    await runCapture();
    // Reset the interval after a manual capture
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
    if (configRef.current.enabled && configRef.current.intervalSeconds > 0) {
      const intervalMs = configRef.current.intervalSeconds * 1000;
      nextCaptureTimeRef.current = Date.now() + intervalMs;
      intervalTimerRef.current = setInterval(runCapture, intervalMs);
    }
  }, [runCapture]);

  // ── Countdown ticker ───────────────────────────────────────────────────────
  const startCountdown = useCallback((intervalSeconds: number) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    nextCaptureTimeRef.current = Date.now() + intervalSeconds * 1000;
    setSecondsUntilNext(intervalSeconds);

    countdownTimerRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((nextCaptureTimeRef.current - Date.now()) / 1000)
      );
      setSecondsUntilNext(remaining);
    }, 1000);
  }, []);

  // ── Main effect: start/stop interval ──────────────────────────────────────
  // Re-runs when enabled, interval, stream, or mode changes so that enabling
  // vision *before* starting screen share still works once the stream arrives.
  useEffect(() => {
    if (intervalTimerRef.current)  clearInterval(intervalTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    intervalTimerRef.current  = null;
    countdownTimerRef.current = null;

    if (!config.enabled) {
      setStatus("idle");
      setSecondsUntilNext(0);
      return;
    }

    // For chrome mode, don't start if we don't have a stream yet
    if (screenShareMode === "chrome" && !stream) {
      setStatus("no_stream");
      setError("Start Chrome screen share to enable real-time vision.");
      return;
    }

    // Clear any previous error now that we have what we need
    setError(null);

    // Initial capture after a short delay
    const initialDelay = setTimeout(() => {
      runCapture();
    }, 2000);

    const intervalMs = config.intervalSeconds * 1000;
    nextCaptureTimeRef.current = Date.now() + config.intervalSeconds * 1000;
    startCountdown(config.intervalSeconds);

    intervalTimerRef.current = setInterval(() => {
      runCapture();
      nextCaptureTimeRef.current = Date.now() + intervalMs;
      startCountdown(config.intervalSeconds);
    }, intervalMs);

    return () => {
      clearTimeout(initialDelay);
      if (intervalTimerRef.current)  clearInterval(intervalTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      intervalTimerRef.current  = null;
      countdownTimerRef.current = null;
    };
  // Re-run when stream becomes available or mode/enabled/interval changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.intervalSeconds, stream, screenShareMode]);

  return {
    status,
    lastDescription,
    lastCaptureTime,
    secondsUntilNext,
    captureNow,
    error,
  };
}
