import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  stream: MediaStream | null;
  vdoninjaUrl?: string;
  mode: "chrome" | "vdoninja";
  active: boolean;
};

// ── Fixed-quality VDO.Ninja URL builder ───────────────────────────────────────
// No adaptive quality params — forces full resolution to avoid blurriness.
// This is better for potato PCs because the blur was caused by VDO.Ninja's
// server-side adaptive downscaling, not local rendering.
function buildFixedVdoUrl(baseUrl: string): string {
  if (!baseUrl) return baseUrl;

  let urlStr = baseUrl;
  if (!urlStr.startsWith("http")) urlStr = "https://" + urlStr;

  const url = new URL(urlStr);

  // Remove any existing quality-degrading params that cause blur
  const blurCausingParams = [
    "quality", "scale", "maxframerate", "audiobitrate",
    "buffer", "sync", "nopush", "novideo",
  ];
  blurCausingParams.forEach((p) => url.searchParams.delete(p));

  // Only add params that improve visual quality / stability WITHOUT scaling down
  const fixedParams: Record<string, string> = {
    cleanoutput: "1",   // removes VDO.Ninja UI chrome
    transparent: "1",   // transparent background
    nopush: "1",        // viewer-only — saves upload bandwidth on potato PC
    // DO NOT add scale, quality, or maxframerate — these cause the blur
  };

  Object.entries(fixedParams).forEach(([k, v]) => {
    if (!url.searchParams.has(k)) url.searchParams.set(k, v);
  });

  return url.toString();
}

// ── Component ──────────────────────────────────────────────────────────────
export const ScreenShareBackground = ({ stream, vdoninjaUrl, mode, active }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fixedUrl, setFixedUrl] = useState("");

  // Build fixed (non-adaptive) VDO.Ninja URL once
  useEffect(() => {
    if (mode === "vdoninja" && vdoninjaUrl) {
      try {
        setFixedUrl(buildFixedVdoUrl(vdoninjaUrl));
      } catch {
        setFixedUrl(vdoninjaUrl);
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
  if (mode === "vdoninja" && (fixedUrl || vdoninjaUrl)) {
    return (
      <div className="absolute top-0 left-0 w-screen h-[100svh] -z-20">
        <iframe
          src={fixedUrl || vdoninjaUrl}
          className="w-full h-full border-0"
          allow="camera;microphone;display-capture;autoplay;encrypted-media"
          allowFullScreen
          title="VDO.Ninja Screen Share"
          style={{
            display: "block",
            // Prevent browser from sub-pixel blurring the iframe
            imageRendering: "crisp-edges",
          }}
        />
        <div
          className="absolute top-8 right-8 text-xs font-bold px-8 py-3 rounded-oval opacity-40 hover:opacity-90 transition-opacity pointer-events-none select-none"
          style={{ background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10 }}
        >
          VDO.Ninja • Fixed Quality
        </div>
      </div>
    );
  }

  // ── Chrome screen share mode ───────────────────────────────────────────────
  if (mode === "chrome" && stream) {
    return (
      <div className="absolute top-0 left-0 w-screen h-[100svh] -z-20 bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return null;
};
