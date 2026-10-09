import React, { useCallback } from "react";
import { ScreenShareConfig, DEFAULT_SCREEN_SHARE_CONFIG } from "@/features/screenShare/screenShare";

const Slide = ({
  label, value, min, max, step, fmt, onChange, disabled,
}: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void; disabled?: boolean;
}) => (
  <div className={`mb-8 ${disabled ? "opacity-40" : ""}`}>
    <div className="text-sm font-bold flex justify-between">
      <span>{label}</span>
      <span className="font-normal text-text-primary/60">{fmt(value)}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      className="input-range w-full"
      onChange={(e) => onChange(Number(e.target.value))}
    />
  </div>
);

type Props = {
  config: ScreenShareConfig;
  onChangeConfig: (c: ScreenShareConfig) => void;
  onStart: () => void;
  onStop: () => void;
};

export const ScreenShareSettings = ({
  config,
  onChangeConfig,
  onStart,
  onStop,
}: Props) => {
  const update = useCallback(
    (partial: Partial<ScreenShareConfig>) => {
      onChangeConfig({ ...config, ...partial });
    },
    [config, onChangeConfig]
  );

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold flex items-center gap-8">
        <span>Screen Share</span>
        {config.active && (
          <span className="text-xs bg-green-500 text-white px-8 py-2 rounded-oval font-normal">
            LIVE
          </span>
        )}
      </div>

      <div className="p-16 bg-surface1 rounded-8">
        <div className="mb-16">
          <div className="font-bold mb-8">Mode</div>
          <div className="grid grid-cols-2 gap-8">
            <button
              onClick={() => update({ mode: "chrome" })}
              className={`p-12 rounded-8 border-2 text-left transition-all ${
                config.mode === "chrome"
                  ? "border-primary bg-primary/10"
                  : "border-surface3 bg-surface3 hover:border-primary/50"
              }`}
            >
              <div className="font-bold text-sm">🖥️ Chrome Screen Share</div>
              <div className="text-xs text-text-primary/60 mt-2">
                Share a screen, window or tab — Chrome, Edge &amp; Firefox
              </div>
            </button>
            <button
              onClick={() => update({ mode: "vdoninja" })}
              className={`p-12 rounded-8 border-2 text-left transition-all ${
                config.mode === "vdoninja"
                  ? "border-primary bg-primary/10"
                  : "border-surface3 bg-surface3 hover:border-primary/50"
              }`}
            >
              <div className="font-bold text-sm">🎥 VDO.Ninja</div>
              <div className="text-xs text-text-primary/60 mt-2">
                Embed any VDO.Ninja viewer URL as background
              </div>
            </button>
          </div>
        </div>

        <div className="mb-16">
          <div className="font-bold mb-8">Framing</div>
          <div className="grid grid-cols-2 gap-8">
            <button
              onClick={() => update({ fullBodyView: true })}
              className={`p-12 rounded-8 border-2 text-left transition-all ${
                config.fullBodyView || config.fullBodyView === undefined
                  ? "border-primary bg-primary/10"
                  : "border-surface3 bg-surface3 hover:border-primary/50"
              }`}
            >
              <div className="font-bold text-sm">🧍 Full Body</div>
              <div className="text-xs text-text-primary/60 mt-2">
                Auto-fits head to toe — nothing gets cropped
              </div>
            </button>
            <button
              onClick={() => update({ fullBodyView: false })}
              className={`p-12 rounded-8 border-2 text-left transition-all ${
                config.fullBodyView === false
                  ? "border-primary bg-primary/10"
                  : "border-surface3 bg-surface3 hover:border-primary/50"
              }`}
            >
              <div className="font-bold text-sm">🤏 Close-Up</div>
              <div className="text-xs text-text-primary/60 mt-2">
                Waist-up shot, measured from your model
              </div>
            </button>
          </div>
        </div>

        <div className="mb-16">
          <div className="font-bold mb-8">Character Position</div>
          <div className="grid grid-cols-3 gap-8">
            {([
              ["left", "⬅ Left"],
              ["center", "⬇ Center"],
              ["right", "Right ➡"],
            ] as const).map(([pos, label]) => (
              <button
                key={pos}
                onClick={() => update({ cornerPosition: pos })}
                className={`p-10 rounded-8 border-2 text-center transition-all text-sm font-bold ${
                  (config.cornerPosition ?? "right") === pos
                    ? "border-primary bg-primary/10"
                    : "border-surface3 bg-surface3 hover:border-primary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 mt-12">
            <Slide label="Box width" value={config.boxWidth} min={160} max={900} step={10}
              fmt={(v) => `${v}px`} onChange={(v) => update({ boxWidth: v })} />
            <Slide label="Box height" value={config.boxHeightPct} min={30} max={100} step={1}
              fmt={(v) => `${v}%`} onChange={(v) => update({ boxHeightPct: v })} />
            <Slide label="Distance from side" value={config.offsetX} min={0} max={600} step={4}
              fmt={(v) => `${v}px`} onChange={(v) => update({ offsetX: v })}
              disabled={config.cornerPosition === "center"} />
            <Slide label="Distance from bottom" value={config.offsetY} min={0} max={400} step={4}
              fmt={(v) => `${v}px`} onChange={(v) => update({ offsetY: v })} />
            <Slide label="Zoom" value={config.zoom} min={0.5} max={2} step={0.05}
              fmt={(v) => `×${v.toFixed(2)}`} onChange={(v) => update({ zoom: v })} />
            <Slide label="Camera height" value={config.shiftY} min={-0.5} max={0.5} step={0.02}
              fmt={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} m`} onChange={(v) => update({ shiftY: v })} />
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-text-primary/60">
              Where the character docks while screen share / gaming mode is active, and how it is framed.
            </div>
            <button
              className="text-xs font-bold underline whitespace-nowrap ml-8"
              onClick={() => update({
                boxWidth: DEFAULT_SCREEN_SHARE_CONFIG.boxWidth,
                boxHeightPct: DEFAULT_SCREEN_SHARE_CONFIG.boxHeightPct,
                offsetX: DEFAULT_SCREEN_SHARE_CONFIG.offsetX,
                offsetY: DEFAULT_SCREEN_SHARE_CONFIG.offsetY,
                zoom: 1,
                shiftY: 0,
              })}
            >
              Reset layout
            </button>
          </div>
        </div>

        {config.mode === "vdoninja" && (
          <div className="mb-16">
            <div className="font-bold mb-4">VDO.Ninja Viewer URL</div>
            <input
              className="px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              type="text"
              placeholder="https://vdo.ninja/?view=yourRoomID"
              value={config.vdoninjaRoomId || ""}
              onChange={(e) => update({ vdoninjaRoomId: e.target.value })}
            />
            <div className="text-xs text-text-primary/60 mt-4 leading-relaxed">
              Paste the <strong>viewer</strong> URL from VDO.Ninja (the <code className="bg-surface3 px-4 rounded">?view=</code> link).
              The page will embed it as a fullscreen background via iframe.{" "}
              <a
                href="https://vdo.ninja"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Open VDO.Ninja →
              </a>
            </div>
          </div>
        )}

        {config.mode === "chrome" && (
          <label className="flex items-start gap-8 cursor-pointer mb-16">
            <input
              type="checkbox"
              checked={!!config.shareAudio}
              disabled={config.active}
              onChange={(e) => update({ shareAudio: e.target.checked })}
              className="w-16 h-16 accent-primary mt-2"
            />
            <span className="text-sm">
              <b>Share audio too</b> (game / tab sound)
              <span className="block text-xs text-text-primary/60">
                Tick &quot;Share audio&quot; in the browser picker as well. It plays through this page so it
                ends up in a tab-capture stream. Don&apos;t use it when sharing this same tab (echo).
                Chrome/Edge can share tab and system audio; Firefox shares video only.
              </span>
            </span>
          </label>
        )}

        <div className="flex gap-8">
          {!config.active ? (
            <button
              onClick={onStart}
              disabled={config.mode === "vdoninja" && !config.vdoninjaRoomId?.trim()}
              className="px-24 py-8 bg-primary hover:bg-primary-hover disabled:bg-primary-disabled text-white font-bold rounded-oval"
            >
              {config.mode === "vdoninja" ? "▶ Start VDO.Ninja Background" : "▶ Start Screen Share"}
            </button>
          ) : (
            <button
              onClick={onStop}
              className="px-24 py-8 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-oval"
            >
              ✕ Stop
            </button>
          )}
        </div>

        <div className="text-xs text-text-primary/60 mt-12">
          {config.mode === "chrome"
            ? "The selected screen or window will appear as the background behind your character."
            : "The VDO.Ninja viewer will be embedded as a fullscreen background. Great for streaming with OBS."}
        </div>
      </div>
    </div>
  );
};
