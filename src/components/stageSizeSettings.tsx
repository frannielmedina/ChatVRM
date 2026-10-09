import React, { useState } from "react";
import { STAGE_SIZES, StageSizeId, parseStageSize, resizeWindowTo } from "@/features/stage/stageConfig";

type Props = {
  value: StageSizeId;
  onChange: (size: StageSizeId) => void;
};

export const StageSizeSettings = ({ value, onChange }: Props) => {
  const [msg, setMsg] = useState<string | null>(null);
  const dims = parseStageSize(value);

  const resizeWindow = async () => {
    if (!dims) return;
    const ok = await resizeWindowTo(dims.w, dims.h);
    setMsg(
      ok
        ? `Window resized to ${dims.w}×${dims.h}.`
        : "Your browser didn't allow resizing this window (normal tabs can't be resized by a page). The scene is still locked to this size, so what you capture is exact — or use “Open as window” in Settings → Twitch to get a resizable streamer window."
    );
  };

  return (
    <div className="my-24">
      <div className="my-16 typography-20 font-bold">🪟 Window / Stage Size</div>
      <div className="p-16 bg-surface1 rounded-8">
        <div className="text-sm text-text-primary/70 mb-12">
          Locks the whole scene — model, background, captions, overlays — to an exact size. If your
          browser window is smaller, it&apos;s scaled down to fit, so the layout always matches what you
          stream or capture.
        </div>
        <div className="flex flex-wrap gap-8">
          {STAGE_SIZES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setMsg(null);
                onChange(s.id);
              }}
              className={`px-12 py-6 rounded-8 border-2 text-sm font-bold ${
                value === s.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-surface3 bg-surface3 hover:border-primary/50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {dims && (
          <div className="mt-12">
            <button
              onClick={resizeWindow}
              className="px-16 py-6 rounded-oval border-2 border-surface3 bg-surface1 hover:bg-surface3 text-sm font-bold"
            >
              Also resize this browser window to {dims.w}×{dims.h}
            </button>
          </div>
        )}
        {msg && <div className="mt-8 text-xs text-text-primary/70">{msg}</div>}
      </div>
    </div>
  );
};
