import React, { useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types & defaults — exported so index.tsx, menu.tsx, assistantText.tsx can
// all import from this single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export type CaptionStyle = {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowBlur: number;
  shadowColor: string;
  bgOpacity: number;
  position: "bottom" | "top" | "middle";
  typewriterSpeed: number;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 28,
  fontFamily: "Montserrat",
  textColor: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 6,
  shadowBlur: 8,
  shadowColor: "rgba(0,0,0,0.9)",
  bgOpacity: 0,
  position: "bottom",
  typewriterSpeed: 18,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  style: CaptionStyle;
  onChangeStyle: (s: CaptionStyle) => void;
};

const FONT_OPTIONS = [
  "Montserrat",
  "Arial Black",
  "Impact",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Comic Sans MS",
];

const POSITION_OPTIONS: { value: CaptionStyle["position"]; label: string }[] = [
  { value: "bottom", label: "⬇ Bottom" },
  { value: "middle", label: "⬛ Middle" },
  { value: "top", label: "⬆ Top" },
];

export const CaptionSettings = ({ style, onChangeStyle }: Props) => {
  const update = useCallback(
    (partial: Partial<CaptionStyle>) => onChangeStyle({ ...style, ...partial }),
    [style, onChangeStyle]
  );

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">Caption / Subtitles</div>

      <div className="p-16 bg-surface1 rounded-8 flex flex-col gap-16">

        {/* Live preview */}
        <div
          className="relative flex items-center justify-center rounded-8 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", height: 96 }}
        >
          <p
            style={{
              fontSize: `${Math.min(style.fontSize, 22)}px`,
              fontFamily: `'${style.fontFamily}', sans-serif`,
              fontWeight: 800,
              color: style.textColor,
              WebkitTextStroke: `${style.strokeWidth}px ${style.strokeColor}`,
              paintOrder: "stroke fill" as any,
              textShadow: `0 0 ${style.shadowBlur}px ${style.shadowColor}`,
              background:
                style.bgOpacity > 0
                  ? `rgba(0,0,0,${style.bgOpacity})`
                  : "transparent",
              padding: style.bgOpacity > 0 ? "4px 10px" : undefined,
              borderRadius: style.bgOpacity > 0 ? "6px" : undefined,
            }}
          >
            Preview caption text here!
          </p>
        </div>

        {/* Position */}
        <div>
          <div className="font-bold mb-6 text-sm">Position</div>
          <div className="grid grid-cols-3 gap-6">
            {POSITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update({ position: opt.value })}
                className={`py-6 rounded-8 text-sm border-2 transition-all font-bold ${
                  style.position === opt.value
                    ? "border-primary bg-primary/10"
                    : "border-surface3 bg-surface3 hover:border-primary/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font family */}
        <div>
          <div className="font-bold mb-4 text-sm">Font Family</div>
          <select
            className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 text-sm"
            value={style.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value })}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Font size */}
        <div>
          <div className="font-bold mb-4 text-sm flex justify-between">
            <span>Font Size</span>
            <span className="font-normal text-text-primary/60">{style.fontSize}px</span>
          </div>
          <input
            type="range" min={14} max={60} step={1}
            value={style.fontSize}
            className="input-range w-full"
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
          />
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-12">
          <div>
            <div className="font-bold mb-4 text-sm">Text Color</div>
            <div className="flex items-center gap-8">
              <input
                type="color"
                value={style.textColor}
                onChange={(e) => update({ textColor: e.target.value })}
                className="w-40 h-32 rounded-4 cursor-pointer border-0"
              />
              <span className="text-xs text-text-primary/60">{style.textColor}</span>
            </div>
          </div>
          <div>
            <div className="font-bold mb-4 text-sm">Stroke Color</div>
            <div className="flex items-center gap-8">
              <input
                type="color"
                value={style.strokeColor}
                onChange={(e) => update({ strokeColor: e.target.value })}
                className="w-40 h-32 rounded-4 cursor-pointer border-0"
              />
              <span className="text-xs text-text-primary/60">{style.strokeColor}</span>
            </div>
          </div>
        </div>

        {/* Stroke width */}
        <div>
          <div className="font-bold mb-4 text-sm flex justify-between">
            <span>Stroke / Outline Width</span>
            <span className="font-normal text-text-primary/60">{style.strokeWidth}px</span>
          </div>
          <input
            type="range" min={0} max={16} step={1}
            value={style.strokeWidth}
            className="input-range w-full"
            onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
          />
        </div>

        {/* Shadow blur */}
        <div>
          <div className="font-bold mb-4 text-sm flex justify-between">
            <span>Shadow Blur</span>
            <span className="font-normal text-text-primary/60">{style.shadowBlur}px</span>
          </div>
          <input
            type="range" min={0} max={32} step={1}
            value={style.shadowBlur}
            className="input-range w-full"
            onChange={(e) => update({ shadowBlur: Number(e.target.value) })}
          />
        </div>

        {/* Background opacity */}
        <div>
          <div className="font-bold mb-4 text-sm flex justify-between">
            <span>Background Opacity</span>
            <span className="font-normal text-text-primary/60">
              {style.bgOpacity === 0 ? "Transparent" : `${Math.round(style.bgOpacity * 100)}%`}
            </span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05}
            value={style.bgOpacity}
            className="input-range w-full"
            onChange={(e) => update({ bgOpacity: Number(e.target.value) })}
          />
        </div>

        {/* Typewriter speed */}
        <div>
          <div className="font-bold mb-4 text-sm flex justify-between">
            <span>Typewriter Speed</span>
            <span className="font-normal text-text-primary/60">
              {style.typewriterSpeed === 0 ? "Instant" : `${style.typewriterSpeed}ms/char`}
            </span>
          </div>
          <input
            type="range" min={0} max={80} step={2}
            value={style.typewriterSpeed}
            className="input-range w-full"
            onChange={(e) => update({ typewriterSpeed: Number(e.target.value) })}
          />
          <div className="text-xs text-text-primary/50 mt-4">
            0 = instant · higher = slower typewriter effect
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={() => onChangeStyle({ ...DEFAULT_CAPTION_STYLE })}
          className="px-16 py-6 rounded-8 border-2 border-surface3 bg-surface3 hover:border-primary/40 text-sm font-bold self-start"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};
