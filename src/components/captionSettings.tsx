import React, { useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types & defaults
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
  // Typewriter
  typewriterEnabled: boolean;
  typewriterSpeed: number;
  // Linger / disappear
  lingerDuration: number;   // seconds (0 = stay forever until next message)
  fadeOut: boolean;         // true = fade, false = instant disappear
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
  typewriterEnabled: true,
  typewriterSpeed: 18,
  lingerDuration: 5,
  fadeOut: true,
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

/** Small toggle button pair */
const TogglePair = ({
  value,
  onChange,
  labelOn,
  labelOff,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  labelOn: string;
  labelOff: string;
}) => (
  <div className="grid grid-cols-2 gap-6">
    {[true, false].map((v) => (
      <button
        key={String(v)}
        onClick={() => onChange(v)}
        className={`py-6 rounded-8 text-sm border-2 transition-all font-bold ${
          value === v
            ? "border-primary bg-primary/10"
            : "border-surface3 bg-surface3 hover:border-primary/40"
        }`}
      >
        {v ? labelOn : labelOff}
      </button>
    ))}
  </div>
);

export const CaptionSettings = ({ style, onChangeStyle }: Props) => {
  const update = useCallback(
    (partial: Partial<CaptionStyle>) => onChangeStyle({ ...style, ...partial }),
    [style, onChangeStyle]
  );

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">Caption / Subtitles</div>

      <div className="p-16 bg-surface1 rounded-8 flex flex-col gap-16">

        {/* ── Live preview ──────────────────────────────────────────────── */}
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
              paintOrder: "stroke fill" as React.CSSProperties["paintOrder"],
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

        {/* ── Position ──────────────────────────────────────────────────── */}
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

        {/* ── Font family ───────────────────────────────────────────────── */}
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

        {/* ── Font size ─────────────────────────────────────────────────── */}
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

        {/* ── Colors ────────────────────────────────────────────────────── */}
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

        {/* ── Stroke width ──────────────────────────────────────────────── */}
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

        {/* ── Shadow blur ───────────────────────────────────────────────── */}
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

        {/* ── Background opacity ────────────────────────────────────────── */}
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

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="border-t border-surface3" />

        {/* ── Typewriter ────────────────────────────────────────────────── */}
        <div>
          <div className="font-bold mb-6 text-sm">Typewriter Effect</div>
          <TogglePair
            value={style.typewriterEnabled}
            onChange={(v) => update({ typewriterEnabled: v })}
            labelOn="✍ Enabled"
            labelOff="⚡ Disabled (instant)"
          />
        </div>

        {style.typewriterEnabled && (
          <div>
            <div className="font-bold mb-4 text-sm flex justify-between">
              <span>Typing Speed</span>
              <span className="font-normal text-text-primary/60">
                {style.typewriterSpeed}ms / character
              </span>
            </div>
            <input
              type="range" min={2} max={80} step={2}
              value={style.typewriterSpeed}
              className="input-range w-full"
              onChange={(e) => update({ typewriterSpeed: Number(e.target.value) })}
            />
            <div className="text-xs text-text-primary/50 mt-4">
              Lower = faster typing · Higher = slower typing
            </div>
          </div>
        )}

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="border-t border-surface3" />

        {/* ── Linger duration ───────────────────────────────────────────── */}
        <div>
          <div className="font-bold mb-4 text-sm flex justify-between">
            <span>Caption Display Duration</span>
            <span className="font-normal text-text-primary/60">
              {style.lingerDuration === 0
                ? "Stay until next message"
                : `${style.lingerDuration}s`}
            </span>
          </div>
          <input
            type="range" min={0} max={30} step={0.5}
            value={style.lingerDuration}
            className="input-range w-full"
            onChange={(e) => update({ lingerDuration: Number(e.target.value) })}
          />
          <div className="text-xs text-text-primary/50 mt-4">
            0 = stay on screen until the next message arrives
          </div>
        </div>

        {/* ── Fade out ──────────────────────────────────────────────────── */}
        {style.lingerDuration > 0 && (
          <div>
            <div className="font-bold mb-6 text-sm">Disappear Style</div>
            <TogglePair
              value={style.fadeOut}
              onChange={(v) => update({ fadeOut: v })}
              labelOn="🌫 Fade Out"
              labelOff="✂ Instant Cut"
            />
          </div>
        )}

        {/* ── Reset ─────────────────────────────────────────────────────── */}
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
