import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  stream: MediaStream | null;
  vdoninjaUrl?: string;
  mode: "chrome" | "vdoninja";
  active: boolean;
};

// ── Adaptive quality helper ────────────────────────────────────────────────
function buildAdaptiveVdoUrl(baseUrl: string): string {
  if (!baseUrl) return baseUrl;

  const url = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);

  // VDO.Ninja params that improve stability / audio sync:
  // &buffer=200        → larger jitter buffer for audio
  // &sync              → enforce A/V sync
  // &nopush            → viewer-only, no upstream bandwidth waste
  // &novideo=0         → keep video but allow degradation
  // &audiobitrate=32   → lower audio bitrate = more stable
  // &maxframerate=30   → cap fps
  // &quality=0         → adaptive quality
  // &scale=50          → start at 50% resolution, adapts up

  const params: Record<string, string> = {
    buffer: "300",
    sync: "1",
    nopush: "1",
    audiobitrate: "32",
    maxframerate: "30",
    quality: "0",
    scale: "75",
    cleanoutput: "1",
    transparent: "1",
  };

  Object.entries(params).forEach(([k, v]) => {
    if (!url.searchParams.has(k)) url.searchParams.set(k, v);
  });

  return url.toString();
}

// ── Chrome screen share adaptive quality ──────────────────────────────────
function useAdaptiveScreenShare(stream: MediaStream | null) {
  const [quality, setQuality] = useState<"high" | "medium" | "low">("high");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    if (!track) return;

    // Apply constraints based on quality
    const applyConstraints = async (q: "high" | "medium" | "low") => {
      const presets = {
        high:   { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
        medium: { frameRate: 24, width: { ideal: 1280 }, height: { ideal: 720 } },
        low:    { frameRate: 15, width: { ideal: 854  }, height: { ideal: 480 } },
      };
      try {
        await track.applyConstraints(presets[q]);
        console.log(`[ScreenShare] Quality set to: ${q}`);
      } catch (e) {
        console.warn("[ScreenShare] Could not apply constraints:", e);
      }
    };

    // Monitor performance via requestAnimationFrame counting
    let animId: number;
    let measuring = true;

    const measureFps = () => {
      if (!measuring) return;
      frameCountRef.current++;
      animId = requestAnimationFrame(measureFps);
    };
    animId = requestAnimationFrame(measureFps);

    intervalRef.current = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastTimeRef.current) / 1000;
      const fps = frameCountRef.current / elapsed;
      frameCountRef.current = 0;
      lastTimeRef.current = now;

      let nextQuality: "high" | "medium" | "low" = "high";
      if (fps < 20) nextQuality = "low";
      else if (fps < 26) nextQuality = "medium";

      setQuality((prev) => {
        if (prev !== nextQuality) {
          applyConstraints(nextQuality);
          return nextQuality;
        }
        return prev;
      });
    }, 5000); // check every 5s

    return () => {
      measuring = false;
      cancelAnimationFrame(animId);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stream]);

  return quality;
}

// ── Component ──────────────────────────────────────────────────────────────
export const ScreenShareBackground = ({ stream, vdoninjaUrl, mode, active }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const quality = useAdaptiveScreenShare(mode === "chrome" ? stream : null);
  const [adaptiveUrl, setAdaptiveUrl] = useState("");

  // Build adaptive VDO.Ninja URL once
  useEffect(() => {
    if (mode === "vdoninja" && vdoninjaUrl) {
      try {
        setAdaptiveUrl(buildAdaptiveVdoUrl(vdoninjaUrl));
      } catch {
        setAdaptiveUrl(vdoninjaUrl);
      }
    }
  }, [vdoninjaUrl, mode]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!active) return null;

  // ── VDO.Ninja mode ────────────────────────────────────────────────────────
  if (mode === "vdoninja" && (adaptiveUrl || vdoninjaUrl)) {
    return (
      <div className="absolute top-0 left-0 w-screen h-[100svh] -z-20">
        <iframe
          src={adaptiveUrl || vdoninjaUrl}
          className="w-full h-full border-0"
          allow="camera;microphone;display-capture;autoplay;encrypted-media"
          allowFullScreen
          title="VDO.Ninja Screen Share"
          // Prevents iframe from freezing on tab visibility change
          style={{ display: "block" }}
        />
        {/* Quality badge (top-right, unobtrusive) */}
        <div
          className="absolute top-8 right-8 text-xs font-bold px-8 py-3 rounded-oval opacity-40 hover:opacity-90 transition-opacity pointer-events-none select-none"
          style={{
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 10,
          }}
        >
          VDO.Ninja • Adaptive
        </div>
      </div>
    );
  }

  // ── Chrome screen share mode ───────────────────────────────────────────────
  if (mode === "chrome" && stream) {
    const qualityColors = { high: "#22c55e", medium: "#eab308", low: "#ef4444" };
    return (
      <div className="absolute top-0 left-0 w-screen h-[100svh] -z-20 bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        {/* Adaptive quality badge */}
        <div
          className="absolute top-8 right-8 text-xs font-bold px-8 py-3 rounded-oval opacity-40 hover:opacity-90 transition-opacity pointer-events-none select-none flex items-center gap-4"
          style={{ background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10 }}
        >
          <span
            className="inline-block w-6 h-6 rounded-full"
            style={{ background: qualityColors[quality] }}
          />
          Screen • {quality.toUpperCase()}
        </div>
      </div>
    );
  }

  return null;
};
