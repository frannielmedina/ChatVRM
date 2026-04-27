import React, { useCallback } from "react";
import { DEFAULT_CAPTION_STYLE as _DEFAULT_CAPTION_STYLE } from "./assistantText";

export { DEFAULT_CAPTION_STYLE } from "./assistantText";

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
  lingerDuration: number;
  maxLines: number; // rolling caption window
};

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

const LINGER_PRESETS: { label: string; value: number }[] = [
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "∞", value: 0 },
];

const MAX_LINES_OPTIONS = [1, 2, 3, 4, 5];

export const CaptionSettings = ({ style, onChangeStyle }: Props) => {
  const update = useCallback(
    (partial: Partial<CaptionStyle>) => onChangeStyle({ ...style, ...partial }),
    [style, onChangeStyle]
  );

  const lingerSeconds = style.lingerDuration / 1000;

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">Caption / Subtitles</div>

      <div className="p-16 bg-surface1 rounded-8 flex flex-col gap-16">

        {/* Preview */}
        <div
          className="relative flex flex-col items-center justify-center gap-1 rounded-8 overflow-hidden py-12 px-16"
          style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", minHeight: 80 }}
        >
          {/* Show up to maxLines preview rows, fading older ones */}
          {Array.from({ length: Math.min(style.maxLines, 3) }).map((_, i, arr) => {
            const isNewest = i === arr.length - 1;
            const age = arr.length - 1 - i;
            const opacity = isNewest ? 1 : Math.max(0.35, 1 - age * 0.25);
            const texts = [
              "Previous caption here",
              "Another line before",
              "Preview caption text here!",
            ];
            const text = texts[texts.length - arr.length + i] ?? "Preview caption text here!";
            return (
              <p
                key={i}
                style={{
                  fontSize: `${Math.min(style.fontSize, 20)}px`,
                  fontFamily: `'${style.fontFamily}', sans-serif`,
                  fontWeight: 800,
                  color: style.textColor,
                  WebkitTextStroke: `${style.strokeWidth}px ${style.strokeColor}`,
                  paintOrder: "stroke fill",
                  textShadow: `0 0 ${style.shadowBlur}px ${style.shadowColor}`,
                  background:
                    style.bgOpacity > 0
                      ? `rgba(0,0,0,${style.bgOpacity})`
                      : "transparent",
                  padding: style.bgOpacity > 0 ? "2px 8px" : undefined,
                  borderRadius: style.bgOpacity > 0 ? "4px" : undefined,
                  opacity,
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {text}
              </p>
            );
          })}
        </div>

        {/* Rolling Lines */}
        <div>
          <div className="font-bold mb-6 text-sm flex justify-between">
            <span>Rolling Caption Lines</span>
            <span className="font-normal text-text-primary/60">{style.maxLines} line{style.maxLines !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex gap-6">
            {MAX_LINES_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => update({ maxLines: n })}
                className={`flex-1 py-8 rounded-8 text-sm font-bold border-2 transition-all ${
                  style.maxLines === n
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-surface3 bg-surface3 hover:border-primary/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="text-xs text-text-primary/50 mt-6">
            Number of caption lines visible at once. Oldest line disappears when a new one appears.
          </div>
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

        {/* Font */}
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

        {/* Colors row */}
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
            <div className="font-bold mb-4 text-sm">Stroke / Outline Color</div>
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
            <span>Outline / Stroke Width</span>
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
          <div className="text-xs text-text-primary/50 mt-4">0 = instant, higher = slower typewriter</div>
        </div>

        {/* Linger duration */}
        <div>
          <div className="font-bold mb-4 text-sm flex justify-between">
            <span>Caption Linger Duration</span>
            <span className="font-normal text-text-primary/60">
              {style.lingerDuration === 0 ? "Always visible" : `${lingerSeconds.toFixed(1)}s`}
            </span>
          </div>

          <div className="flex gap-6 mb-8">
            {LINGER_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => update({ lingerDuration: p.value })}
                className={`px-12 py-4 rounded-8 text-xs font-bold border-2 transition-all ${
                  style.lingerDuration === p.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-surface3 bg-surface3 hover:border-primary/40"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <input
            type="range" min={1} max={30} step={0.5}
            value={style.lingerDuration === 0 ? 30 : lingerSeconds}
            className="input-range w-full"
            onChange={(e) => update({ lingerDuration: Number(e.target.value) * 1000 })}
          />
          <div className="text-xs text-text-primary/50 mt-4">
            How long each caption line stays visible after typing finishes. Use ∞ to keep lines until the next message arrives.
          </div>
        </div>

        {/* Reset button */}
        <button
          onClick={() => onChangeStyle({ ..._DEFAULT_CAPTION_STYLE })}
          className="px-16 py-6 rounded-8 border-2 border-surface3 bg-surface3 hover:border-primary/40 text-sm font-bold self-start"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};
