import React, { useEffect, useState } from "react";
import {
  CaptureResolution,
  DEFAULT_STREAMER_CONFIG,
  EncoderChoice,
  RESOLUTIONS,
  RTMP_PRESETS,
  STREAM_FPS_OPTIONS,
  StreamerConfig,
  resolveStreamProfile,
} from "@/features/streamer/streamerConfig";
import { BroadcastState } from "@/features/streamer/rtmpBroadcaster";
import { HardwareInfo, detectHardware } from "@/features/graphics/graphicsConfig";

type Props = {
  config: StreamerConfig;
  onChangeConfig: (config: StreamerConfig) => void;
  broadcast: BroadcastState;
  /** "Go Live" was pressed here but the capture prompt is waiting for a click in the streamer window. */
  awaitingClick?: boolean;
  onGoLive: () => void;
  onStop: () => void;
};

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
};

const ENCODER_LABELS: Record<EncoderChoice, string> = {
  x264: "x264 (CPU) — works everywhere",
  nvenc: "NVENC (NVIDIA GPU)",
  qsv: "Quick Sync (Intel GPU)",
  amf: "AMF (AMD GPU)",
  videotoolbox: "VideoToolbox (Mac)",
};

export const StreamerSettings = ({ config, onChangeConfig, broadcast, awaitingClick, onGoLive, onStop }: Props) => {
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => setHardware(detectHardware()), []);

  const update = (partial: Partial<StreamerConfig>) => onChangeConfig({ ...config, ...partial });
  const live = broadcast.status === "live";
  const busy = broadcast.status === "capturing" || broadcast.status === "connecting" || broadcast.status === "stopping";
  const profile = hardware ? resolveStreamProfile(config, hardware.tier) : null;
  const encoderKnown = (e: EncoderChoice) =>
    broadcast.relayEncoders.length === 0 || broadcast.relayEncoders.includes(e);

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold flex items-center gap-8">
        <span>Broadcast (RTMP)</span>
        <span
          className={`inline-block w-10 h-10 rounded-full ${
            live ? "bg-red-500 animate-pulse" : busy ? "bg-yellow-400" : "bg-surface3"
          }`}
        />
        <span className="text-sm font-normal text-text-primary/60">
          {live ? `LIVE ${fmtTime(broadcast.stats.seconds)}` : busy ? "Starting…" : "Offline"}
        </span>
      </div>

      {/* Go live / stop */}
      <div className="p-16 bg-surface1 rounded-8 mb-16">
        <div className="flex flex-wrap items-center gap-12">
          {!live ? (
            <button
              onClick={onGoLive}
              disabled={busy}
              className="px-24 py-8 bg-red-500 hover:bg-red-600 text-white font-bold rounded-oval disabled:opacity-40"
            >
              ● Go Live
            </button>
          ) : (
            <button
              onClick={onStop}
              className="px-24 py-8 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-oval"
            >
              ■ End Stream
            </button>
          )}
          {live && (
            <div className="text-sm flex flex-wrap gap-x-16 gap-y-4 text-text-primary/80">
              <span><b>{broadcast.stats.kbps}</b> kbps</span>
              <span><b>{broadcast.stats.sentMB}</b> MB sent</span>
              {broadcast.stats.captureSize && <span>capture {broadcast.stats.captureSize}</span>}
              <span className={broadcast.stats.bufferKB > 4096 ? "text-secondary font-bold" : ""}>
                buffer {broadcast.stats.bufferKB} KB
              </span>
              {!broadcast.stats.hasAudio && (
                <span className="text-secondary font-bold">⚠ no audio captured</span>
              )}
            </div>
          )}
        </div>
        {awaitingClick && (
          <div className="mt-12 text-sm bg-yellow-100 rounded-8 px-12 py-8">
            👉 Switch to the <b>streamer window</b> and click <b>Start capture</b> — the browser only
            allows screen capture to start from a click in the window being captured.
          </div>
        )}
        {broadcast.error && (
          <div className="mt-12 text-sm text-secondary bg-secondary/10 rounded-8 px-12 py-8 break-words">
            {broadcast.error}
          </div>
        )}
        {broadcast.status === "idle" && !broadcast.error && (
          <div className="mt-12 text-xs text-text-primary/60">
            When you click <b>Go Live</b>, Chrome/Edge asks what to share: choose{" "}
            <b>This tab</b> (the streamer window) and tick <b>Share tab audio</b> so the
            character&apos;s voice is in the stream.
          </div>
        )}
        {live && !broadcast.stats.hasAudio && (
          <div className="mt-8 text-xs text-secondary">
            The stream is silent. End it and start again with &quot;Share tab audio&quot; ticked
            (Chrome / Edge only).
          </div>
        )}
      </div>

      {/* Destination */}
      <div className="p-16 bg-surface1 rounded-8 mb-16">
        <div className="font-bold mb-8">Destination</div>
        <div className="flex flex-wrap gap-8 mb-8">
          {RTMP_PRESETS.map((p) => (
            <button
              key={p.label}
              disabled={live}
              onClick={() => p.url && update({ rtmpUrl: p.url })}
              className={`px-12 py-4 rounded-oval border-2 text-sm font-bold ${
                p.url && config.rtmpUrl === p.url
                  ? "border-primary text-primary"
                  : "border-surface3 hover:bg-surface3"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          className="px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 mb-8"
          type="text"
          placeholder="rtmp://live.twitch.tv/app"
          value={config.rtmpUrl}
          disabled={live}
          onChange={(e) => update({ rtmpUrl: e.target.value })}
        />
        <div className="flex gap-8 mb-4">
          <input
            className="px-16 py-8 flex-1 bg-surface3 hover:bg-surface3-hover rounded-8"
            type={showKey ? "text" : "password"}
            placeholder="Stream key"
            value={config.streamKey}
            disabled={live}
            autoComplete="off"
            onChange={(e) => update({ streamKey: e.target.value })}
          />
          <button
            className="px-12 rounded-8 bg-surface3 hover:bg-surface3-hover text-sm font-bold"
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
        <div className="text-xs text-text-primary/60">
          Get it from Twitch Creator Dashboard → Settings → Stream. Never share it — it&apos;s only
          sent to your own local relay.
        </div>
      </div>

      {/* Quality */}
      <div className="p-16 bg-surface1 rounded-8 mb-16">
        <label className="flex items-start gap-8 cursor-pointer mb-12">
          <input
            type="checkbox"
            checked={config.autoProfile}
            disabled={live}
            onChange={(e) => update({ autoProfile: e.target.checked })}
            className="w-16 h-16 accent-primary mt-2"
          />
          <span>
            <span className="font-bold">Automatic stream quality</span>
            <span className="block text-xs text-text-primary/60">
              Chooses resolution, FPS and bitrate from your hardware
              {hardware ? ` (detected ${hardware.tier.toUpperCase()} tier)` : ""}.
            </span>
          </span>
        </label>

        {profile && (
          <div className="mb-12 text-sm px-12 py-8 rounded-8 bg-surface3">
            {config.autoProfile ? "Will stream" : "Streaming at"}:{" "}
            <b>
              {RESOLUTIONS[profile.resolution].label} · {profile.fps} FPS · {profile.videoBitrateKbps} kbps
            </b>{" "}
            + {profile.audioBitrateKbps} kbps audio
          </div>
        )}

        {!config.autoProfile && (
          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <div className="font-bold mb-4 text-sm">Resolution</div>
              <select
                value={config.resolution}
                disabled={live}
                onChange={(e) => update({ resolution: e.target.value as CaptureResolution })}
                className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              >
                {(Object.keys(RESOLUTIONS) as CaptureResolution[]).map((r) => (
                  <option key={r} value={r}>{RESOLUTIONS[r].label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="font-bold mb-4 text-sm">Frame rate</div>
              <select
                value={config.fps}
                disabled={live}
                onChange={(e) => update({ fps: Number(e.target.value) })}
                className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              >
                {STREAM_FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f} FPS</option>
                ))}
              </select>
            </div>
            <div>
              <div className="font-bold mb-4 text-sm">Video bitrate (kbps)</div>
              <input
                type="number" min={500} max={20000} step={100}
                value={config.videoBitrateKbps}
                disabled={live}
                onChange={(e) => update({ videoBitrateKbps: Number(e.target.value) })}
                className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              />
            </div>
            <div>
              <div className="font-bold mb-4 text-sm">Audio bitrate (kbps)</div>
              <input
                type="number" min={64} max={320} step={32}
                value={config.audioBitrateKbps}
                disabled={live}
                onChange={(e) => update({ audioBitrateKbps: Number(e.target.value) })}
                className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              />
            </div>
          </div>
        )}

        <div className="font-bold mb-4 text-sm">Encoder</div>
        <select
          value={config.encoder}
          disabled={live}
          onChange={(e) => update({ encoder: e.target.value as EncoderChoice })}
          className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
        >
          {(Object.keys(ENCODER_LABELS) as EncoderChoice[]).map((e) => (
            <option key={e} value={e} disabled={!encoderKnown(e)}>
              {ENCODER_LABELS[e]}{encoderKnown(e) ? "" : " — not in your ffmpeg"}
            </option>
          ))}
        </select>
        <div className="text-xs text-text-primary/60 mt-4">
          If your PC struggles while streaming, a GPU encoder (NVENC / QuickSync / AMF) moves the load
          off the CPU. The list is checked against your ffmpeg once you&apos;ve connected to the relay.
        </div>
      </div>

      {/* Relay */}
      <div className="p-16 bg-surface1 rounded-8">
        <div className="font-bold mb-4">Relay address</div>
        <input
          className="px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 mb-8"
          type="text"
          value={config.relayUrl}
          disabled={live}
          onChange={(e) => update({ relayUrl: e.target.value })}
        />
        <div className="text-xs text-text-primary/70 leading-relaxed">
          Browsers can&apos;t send RTMP directly, so a tiny helper on your PC converts the capture:
          <pre className="bg-surface3 rounded-8 px-12 py-8 mt-8 mb-8 overflow-x-auto text-[11px]">
{`cd tools/rtmp-relay
npm install
npm start`}
          </pre>
          Prefer OBS? Skip all this: add the streamer window as a <b>Window Capture</b> /{" "}
          <b>Browser Source</b> and stream from OBS as usual — the 3D, FPS and background settings
          here still apply.
        </div>
        <button
          onClick={() => onChangeConfig({ ...DEFAULT_STREAMER_CONFIG, streamKey: config.streamKey })}
          disabled={live}
          className="mt-12 px-16 py-6 rounded-oval border-2 border-surface3 bg-surface1 hover:bg-surface3 text-sm font-bold disabled:opacity-40"
        >
          Reset stream settings
        </button>
      </div>
    </div>
  );
};
