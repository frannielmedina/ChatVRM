import { HardwareTier } from "@/features/graphics/graphicsConfig";

export type CaptureResolution = "480p" | "720p" | "1080p" | "1440p";
export type EncoderChoice = "x264" | "nvenc" | "qsv" | "amf" | "videotoolbox";

export const RESOLUTIONS: Record<CaptureResolution, { w: number; h: number; label: string }> = {
  "480p":  { w: 854,  h: 480,  label: "480p" },
  "720p":  { w: 1280, h: 720,  label: "720p" },
  "1080p": { w: 1920, h: 1080, label: "1080p" },
  "1440p": { w: 2560, h: 1440, label: "1440p" },
};

export const STREAM_FPS_OPTIONS = [15, 24, 30, 45, 60];

export type StreamerConfig = {
  /** WebSocket address of the local relay (tools/rtmp-relay) that turns the browser capture into RTMP. */
  relayUrl: string;
  /** RTMP ingest URL, e.g. rtmp://live.twitch.tv/app */
  rtmpUrl: string;
  streamKey: string;
  /** Pick resolution / fps / bitrate automatically from the detected hardware. */
  autoProfile: boolean;
  resolution: CaptureResolution;
  fps: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  encoder: EncoderChoice;
};

export const DEFAULT_STREAMER_CONFIG: StreamerConfig = {
  relayUrl: "ws://127.0.0.1:8787",
  rtmpUrl: "rtmp://live.twitch.tv/app",
  streamKey: "",
  autoProfile: true,
  resolution: "720p",
  fps: 30,
  videoBitrateKbps: 3500,
  audioBitrateKbps: 128,
  encoder: "x264",
};

export const RTMP_PRESETS = [
  { label: "Twitch", url: "rtmp://live.twitch.tv/app" },
  { label: "YouTube", url: "rtmp://a.rtmp.youtube.com/live2" },
  { label: "Kick", url: "rtmps://fa723fc1b171.global-contribute.live-video.net/app" },
  { label: "Custom", url: "" },
];

export type ResolvedStreamProfile = {
  resolution: CaptureResolution;
  fps: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  /** Exact output size (overrides `resolution`) — used when the stage is locked to a size. */
  width?: number;
  height?: number;
};

// Conservative, Twitch-friendly ladders (Twitch non-partner cap is ~6000 kbps).
const AUTO_PROFILES: Record<HardwareTier, ResolvedStreamProfile> = {
  low:    { resolution: "720p",  fps: 30, videoBitrateKbps: 2500, audioBitrateKbps: 128 },
  medium: { resolution: "720p",  fps: 30, videoBitrateKbps: 3500, audioBitrateKbps: 160 },
  high:   { resolution: "1080p", fps: 30, videoBitrateKbps: 4500, audioBitrateKbps: 160 },
  ultra:  { resolution: "1080p", fps: 60, videoBitrateKbps: 6000, audioBitrateKbps: 160 },
};

export function autoStreamProfile(tier: HardwareTier): ResolvedStreamProfile {
  return AUTO_PROFILES[tier];
}

export function resolveStreamProfile(cfg: StreamerConfig, tier: HardwareTier): ResolvedStreamProfile {
  if (cfg.autoProfile) return autoStreamProfile(tier);
  return {
    resolution: cfg.resolution,
    fps: cfg.fps,
    videoBitrateKbps: cfg.videoBitrateKbps,
    audioBitrateKbps: cfg.audioBitrateKbps,
  };
}
