import React, { useCallback } from "react";
import { VisionConfig, VISION_INTERVALS } from "@/features/vision/visionConfig";
import { VisionStatus } from "@/features/vision/useVision";

type Props = {
  config: VisionConfig;
  onChangeConfig: (c: VisionConfig) => void;
  onCaptureNow: () => void;
  status: VisionStatus;
  lastDescription: string;
  lastCaptureTime: Date | null;
  secondsUntilNext: number;
  error: string | null;
  screenShareActive: boolean;
  screenShareMode: "chrome" | "vdoninja";
  groqApiKey?: string;
};

const STATUS_INFO: Record<VisionStatus, { icon: string; label: string; color: string }> = {
  idle:       { icon: "⏸",  label: "Idle",         color: "text-text-primary/50" },
  capturing:  { icon: "📸", label: "Capturing...",  color: "text-blue-600" },
  analyzing:  { icon: "🔍", label: "Analyzing...",  color: "text-purple-600" },
  ready:      { icon: "✅", label: "Ready",         color: "text-green-600" },
  error:      { icon: "❌", label: "Error",         color: "text-red-600" },
  no_stream:  { icon: "🚫", label: "No stream",     color: "text-orange-600" },
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const VisionSettings = ({
  config,
  onChangeConfig,
  onCaptureNow,
  status,
  lastDescription,
  lastCaptureTime,
  secondsUntilNext,
  error,
  screenShareActive,
  screenShareMode,
  groqApiKey,
}: Props) => {
  const update = useCallback(
    (partial: Partial<VisionConfig>) => onChangeConfig({ ...config, ...partial }),
    [config, onChangeConfig]
  );

  const statusInfo = STATUS_INFO[status];

  // Vision is available in both chrome and vdoninja modes
  const canUseVision = screenShareActive;

  const effectiveKey = config.groqApiKey || groqApiKey || "";

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold flex items-center gap-8">
        <span>👁 Screen Vision</span>
        {config.enabled && (
          <span className="text-xs bg-purple-500 text-white px-8 py-2 rounded-oval font-normal">
            ACTIVE
          </span>
        )}
      </div>

      {/* Info box */}
      <div className="mb-16 p-12 bg-surface1 rounded-8 text-sm text-text-primary/70 leading-relaxed">
        <p>
          Uses <strong>Llama 4 Scout</strong> (Groq multimodal) to periodically analyze your
          screen and have the character comment on it in character. Works with both{" "}
          <strong>Chrome Screen Share</strong> and <strong>VDO.Ninja</strong> modes.
        </p>
      </div>

      {/* VDO.Ninja note */}
      {screenShareMode === "vdoninja" && screenShareActive && (
        <div className="mb-16 p-12 bg-blue-500/10 border border-blue-500/30 rounded-8 text-sm text-blue-700 leading-relaxed">
          <strong>ℹ VDO.Ninja mode:</strong> Because VDO.Ninja runs in a cross-origin
          iframe, vision captures the <strong>current browser tab</strong> instead.
          The <strong>first capture</strong> will open a browser prompt — select{" "}
          <strong>&ldquo;This Tab&rdquo;</strong> and click Share. After that the stream
          is cached and all future captures happen silently.
        </div>
      )}

      {!screenShareActive && (
        <div className="mb-16 p-12 bg-yellow-500/10 border border-yellow-500/30 rounded-8 text-sm text-yellow-700">
          <strong>⚠ No active screen share:</strong> Enable screen sharing (Chrome or
          VDO.Ninja mode) in the Screen Share section so vision can capture frames.
        </div>
      )}

      <div className="p-16 bg-surface1 rounded-8 flex flex-col gap-16">

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold">Periodic Vision</div>
            <div className="text-xs text-text-primary/60 mt-1">
              Automatically captures the screen and has the AI comment on what it sees.
              Also toggleable via the 👁 button in the toolbar.
            </div>
          </div>
          <button
            onClick={() => update({ enabled: !config.enabled })}
            disabled={!canUseVision}
            className={`relative w-48 h-24 rounded-full transition-all duration-300 ${
              config.enabled && canUseVision
                ? "bg-purple-500"
                : "bg-surface3"
            } ${!canUseVision ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`absolute top-2 w-20 h-20 bg-white rounded-full shadow transition-all duration-300 ${
                config.enabled && canUseVision ? "left-26" : "left-2"
              }`}
            />
          </button>
        </div>

        {/* Groq API Key */}
        <div>
          <div className="font-bold mb-4 text-sm">
            Groq API Key for Vision
            <span className="ml-6 text-xs font-normal text-text-primary/50">
              (leave empty to use the main Groq key)
            </span>
          </div>
          <input
            className="text-ellipsis px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 text-sm"
            type="password"
            placeholder={effectiveKey ? "Using Groq AI key (can be left empty)" : "gsk_..."}
            value={config.groqApiKey}
            onChange={(e) => update({ groqApiKey: e.target.value })}
          />
          {effectiveKey && !config.groqApiKey && (
            <div className="text-xs text-green-600 mt-4">
              ✓ Using the Groq API key configured in AI Provider
            </div>
          )}
        </div>

        {/* Model info */}
        <div>
          <div className="font-bold mb-4 text-sm">Vision Model</div>
          <div className="px-12 py-8 bg-surface3 rounded-8 text-sm flex items-center justify-between">
            <span className="font-mono text-xs">{config.model}</span>
            <span className="text-xs text-purple-600 font-bold">Groq Multimodal</span>
          </div>
          <div className="text-xs text-text-primary/50 mt-4">
            Llama 4 Scout 17B — optimized for fast visual analysis
          </div>
        </div>

        {/* Interval selector */}
        <div>
          <div className="font-bold mb-8 text-sm">Capture Frequency</div>
          <div className="grid grid-cols-2 gap-6">
            {VISION_INTERVALS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update({ intervalSeconds: opt.value })}
                className={`py-8 px-12 rounded-8 text-sm border-2 transition-all text-left ${
                  config.intervalSeconds === opt.value
                    ? "border-purple-500 bg-purple-500/10 text-purple-700 font-bold"
                    : "border-surface3 bg-surface3 hover:border-purple-400/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status panel */}
        <div className="border-t border-surface3 pt-12">
          <div className="font-bold mb-8 text-sm">Vision Status</div>
          <div className="flex items-center gap-8 mb-8">
            <span className="text-lg">{statusInfo.icon}</span>
            <span className={`font-bold text-sm ${statusInfo.color}`}>{statusInfo.label}</span>
            {config.enabled && status !== "error" && status !== "no_stream" && secondsUntilNext > 0 && (
              <span className="text-xs text-text-primary/50 ml-auto">
                Next capture in: <strong>{formatCountdown(secondsUntilNext)}</strong>
              </span>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-8 px-12 py-8 mb-8">
              {error}
            </div>
          )}

          {lastDescription && (
            <div className="bg-surface3 rounded-8 p-12 text-sm">
              <div className="text-xs text-text-primary/50 mb-4">
                Last observation
                {lastCaptureTime && (
                  <span className="ml-6">
                    &mdash; {lastCaptureTime.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <p className="text-text-primary leading-relaxed italic">
                &ldquo;{lastDescription}&rdquo;
              </p>
            </div>
          )}

          {/* Manual capture button */}
          <button
            onClick={onCaptureNow}
            disabled={!canUseVision || status === "capturing" || status === "analyzing"}
            className="mt-8 w-full py-8 rounded-8 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex items-center justify-center gap-8"
          >
            {(status === "capturing" || status === "analyzing") ? (
              <>
                <span className="animate-spin">⟳</span>
                {status === "capturing" ? "Capturing frame..." : "Analyzing..."}
              </>
            ) : (
              <>📸 Capture Now</>
            )}
          </button>
        </div>

        {/* How it works */}
        <details className="text-xs text-text-primary/50">
          <summary className="cursor-pointer font-bold hover:text-text-primary/70">
            How does it work?
          </summary>
          <div className="mt-8 space-y-4 leading-relaxed">
            <p>1. Every N seconds, a frame is captured from the active screen share (Chrome or VDO.Ninja).</p>
            <p>2. The frame is sent to <strong>Llama 4 Scout</strong> on Groq via its multimodal API.</p>
            <p>3. The model describes what it sees on screen, in character.</p>
            <p>4. The description becomes a normal chat message — your VTuber says it aloud.</p>
            <p>5. You can also click <strong>Capture Now</strong> for an instant observation, or use the 👁 toolbar button to toggle vision on/off without opening Settings.</p>
          </div>
        </details>
      </div>
    </div>
  );
};
