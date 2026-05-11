import { useCallback, useEffect, useRef, useState } from "react";
import { VisionConfig } from "./visionConfig";
import {
  captureFrameFromStream,
  analyzeFrameWithVision,
  canCaptureVisionFromConfig,
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
 * useVision — periodically captures the screen share stream and sends it
 * to Llama 4 Scout for a character commentary.
 *
 * @param config          Vision settings (enabled, interval, model, key)
 * @param stream          The active MediaStream from screen share (or null)
 * @param screenShareMode "chrome" | "vdoninja"
 * @param systemPrompt    The character's system prompt (injected into vision call)
 * @param onDescription   Callback called with the AI description — feed this into handleSendChat
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
  const configRef = useRef(config);
  const streamRef = useRef(stream);
  const systemPromptRef = useRef(systemPrompt);
  const onDescriptionRef = useRef(onDescription);
  const isRunningRef = useRef(false);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => { systemPromptRef.current = systemPrompt; }, [systemPrompt]);
  useEffect(() => { onDescriptionRef.current = onDescription; }, [onDescription]);

  const intervalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextCaptureTimeRef = useRef<number>(0);

  // ── Core capture function ──────────────────────────────────────────────────
  const runCapture = useCallback(async () => {
    if (isRunningRef.current) return; // prevent overlap
    const cfg = configRef.current;
    const activeStream = streamRef.current;
    const mode = screenShareMode;

    if (!canCaptureVisionFromConfig(mode, activeStream)) {
      setStatus("no_stream");
      setError(
        mode === "vdoninja"
          ? "VDO.Ninja mode no soporta captura de visión directamente. Usa el modo Chrome Screen Share para visión."
          : "No hay stream activo. Comparte la pantalla para activar la visión."
      );
      return;
    }

    isRunningRef.current = true;
    setError(null);

    try {
      // 1. Capture frame
      setStatus("capturing");
      const frame = await captureFrameFromStream(activeStream!, 0.65);
      if (!frame) {
        setStatus("error");
        setError("No se pudo capturar el frame. ¿El stream sigue activo?");
        isRunningRef.current = false;
        return;
      }

      // 2. Analyze with vision
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

        // Wrap the description with an emotion tag so the character reacts
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
  }, [screenShareMode]);

  // ── Manual trigger ────────────────────────────────────────────────────────
  const captureNow = useCallback(async () => {
    await runCapture();
    // Reset the interval timer after a manual capture
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
  useEffect(() => {
    // Clear existing timers
    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    intervalTimerRef.current = null;
    countdownTimerRef.current = null;

    if (!config.enabled) {
      setStatus("idle");
      setSecondsUntilNext(0);
      return;
    }

    // Run an initial capture shortly after enabling
    const initialDelay = setTimeout(() => {
      runCapture();
    }, 3000); // wait 3 seconds before first capture

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
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      intervalTimerRef.current = null;
      countdownTimerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.intervalSeconds]);

  return {
    status,
    lastDescription,
    lastCaptureTime,
    secondsUntilNext,
    captureNow,
    error,
  };
}
