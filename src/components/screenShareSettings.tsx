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
                Low-latency WebRTC link — ideal for streaming via OBS
              </div>
            </button>
          </div>
        </div>

        {config.mode === "vdoninja" && (
          <div className="mb-16">
            <div className="font-bold mb-4">VDO.Ninja Room ID</div>
            <input
              className="px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              type="text"
              placeholder="e.g. mystreamroom123"
              value={config.vdoninjaRoomId || ""}
              onChange={(e) => update({ vdoninjaRoomId: e.target.value })}
            />
            <div className="text-xs text-text-primary/60 mt-4">
              The viewer link will be:{" "}
              <code className="bg-surface3 px-4 rounded text-xs">
                https://vdo.ninja/?view={config.vdoninjaRoomId || "yourroom"}
              </code>
            </div>
          </div>
        )}

        <div className="flex gap-8">
          {!config.active ? (
            <button
              onClick={onStart}
              className="px-24 py-8 bg-primary hover:bg-primary-hover text-white font-bold rounded-oval"
            >
              {config.mode === "vdoninja" ? "Open VDO.Ninja" : "Start Screen Share"}
            </button>
          ) : (
            <button
              onClick={onStop}
              className="px-24 py-8 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-oval"
            >
              ✕ Stop / Disconnect
            </button>
          )}
        </div>

        <div className="text-xs text-text-primary/60 mt-12">
          When active, the background changes to the screen share feed — perfect for streaming.
          Click Stop to restore the original background.
        </div>
      </div>
    </div>
  );
};
