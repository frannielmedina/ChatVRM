import React, { useCallback } from "react";
import { ScreenShareConfig } from "@/features/screenShare/screenShare";

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
                Uses browser native getDisplayMedia — simplest option
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
