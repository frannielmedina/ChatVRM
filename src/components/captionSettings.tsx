import React, { useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types & defaults
// ─────────────────────────────────────────────────────────────────────────────

export type CaptionStyle = {
  // Master on/off switch for the whole caption/subtitle overlay.
  enabled: boolean;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowBlur: number;
  shadowColor: string;
  bgOpacity: number;
  position: "bottom" | "top" | "middle";
  // Font style toggles (can be combined)
  bold: boolean;
  italic: boolean;     // "cursive" / slanted
  strike: boolean;     // "slashed" / strikethrough
  // Boxed caption (rounded colored box around the text)
  boxed: boolean;
  boxColor: string;
  boxOpacity: number;  // 0..1
  // Word-by-word fade-in (replaces the old typewriter)
  wordFade: boolean;
  wordFadeSpeed: number; // ms between words
  // Linger / disappear
  lingerDuration: number;   // seconds (0 = stay forever until next message)
  fadeOut: boolean;         // true = fade, false = instant disappear
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  enabled: true,
  fontSize: 28,
  fontFamily: "Hachi Maru Pop",
  textColor: "#ffffff",
  strokeColor: "#c2185b",
  strokeWidth: 0,
  shadowBlur: 0,
  shadowColor: "rgba(120,0,60,0.45)",
  bgOpacity: 0,
  position: "bottom",
  bold: true,
  italic: false,
  strike: false,
  boxed: true,
  boxColor: "#ff8fc7",
  boxOpacity: 0.92,
  wordFade: true,
  wordFadeSpeed: 140,
  lingerDuration: 5,
  fadeOut: false,
};

export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Shared font styling (family + bold / italic / strikethrough) for captions and overlays. */
export function captionFontStyle(s: CaptionStyle): React.CSSProperties {
  return {
    fontFamily: `'${s.fontFamily}', Arial, sans-serif`,
    fontWeight: s.bold ? 800 : 400,
    fontStyle: s.italic ? "italic" : "normal",
    textDecoration: s.strike ? "line-through" : "none",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  style: CaptionStyle;
  onChangeStyle: (s: CaptionStyle) => void;
};

const FONT_OPTIONS = [
  "Hachi Maru Pop",
  "Arial",
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

        {/* ── Master on/off ─────────────────────────────────────────────── */}
        <div>
          <div className="font-bold mb-6 text-sm">Show Captions</div>
          <TogglePair
            value={style.enabled}
            onChange={(v) => update({ enabled: v })}
            labelOn="💬 Enabled"
            labelOff="🚫 Disabled"
          />
        </div>

        <div
          className={`flex flex-col gap-16 transition-opacity ${
            style.enabled ? "" : "opacity-40 pointer-events-none"
          }`}
        >

        {/* ── Live preview ──────────────────────────────────────────────── */}
        <div
          className="relative flex items-center justify-center rounded-8 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", height: 120 }}
        >
          <div
            style={{
              background: style.boxed
                ? hexToRgba(style.boxColor, style.boxOpacity)
                : style.bgOpacity > 0
                ? `rgba(0,0,0,${style.bgOpacity})`
                : "transparent",
              borderRadius: style.boxed ? 14 : style.bgOpacity > 0 ? 6 : undefined,
              border: style.boxed ? "2px solid rgba(255,255,255,0.7)" : undefined,
              padding: style.boxed || style.bgOpacity > 0 ? "6px 14px" : undefined,
              textAlign: "center",
            }}
          >
            {style.boxed && (
              <div
                style={{
                  ...captionFontStyle(style),
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.85)",
                  marginBottom: 2,
                }}
              >
                RESPONDING TO USERNAME:
              </div>
            )}
            <p
              style={{
                ...captionFontStyle(style),
                fontSize: `${Math.min(style.fontSize, 22)}px`,
                color: style.textColor,
                WebkitTextStroke: style.strokeWidth ? `${style.strokeWidth}px ${style.strokeColor}` : undefined,
                paintOrder: "stroke fill" as React.CSSProperties["paintOrder"],
                textShadow: `0 0 ${style.shadowBlur}px ${style.shadowColor}`,
              }}
            >
              Preview caption text here!
            </p>
          </div>
        </div>

        {/* ── Boxed caption ─────────────────────────────────────────────── */}
        <div>
          <div className="font-bold mb-6 text-sm">Caption Box</div>
          <TogglePair
            value={style.boxed}
            onChange={(v) => update({ boxed: v })}
            labelOn="🎀 Boxed"
            labelOff="▭ No box"
          />
        </div>

        {style.boxed && (
          <div className="grid grid-cols-2 gap-12">
            <div>
              <div className="font-bold mb-4 text-sm">Box Color</div>
              <div className="flex items-center gap-8">
                <input
                  type="color"
                  value={style.boxColor}
                  onChange={(e) => update({ boxColor: e.target.value })}
                  className="w-40 h-32 rounded-4 cursor-pointer border-0"
                />
                <span className="text-xs text-text-primary/60">{style.boxColor}</span>
              </div>
            </div>
            <div>
              <div className="font-bold mb-4 text-sm flex justify-between">
                <span>Box Opacity</span>
                <span className="font-normal text-text-primary/60">{Math.round(style.boxOpacity * 100)}%</span>
              </div>
              <input
                type="range" min={0.2} max={1} step={0.05}
                value={style.boxOpacity}
                className="input-range w-full"
                onChange={(e) => update({ boxOpacity: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

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

        {/* ── Font style ────────────────────────────────────────────────── */}
        <div>
          <div className="font-bold mb-6 text-sm">Font Style</div>
          <div className="grid grid-cols-3 gap-6">
            {([
              { key: "bold", label: "B  Bold", css: { fontWeight: 800 } },
              { key: "italic", label: "I  Cursive", css: { fontStyle: "italic" } },
              { key: "strike", label: "S  Slashed", css: { textDecoration: "line-through" } },
            ] as const).map((o) => (
              <button
                key={o.key}
                onClick={() => update({ [o.key]: !style[o.key] } as Partial<CaptionStyle>)}
                style={o.css}
                className={`py-6 rounded-8 text-sm border-2 transition-all ${
                  style[o.key]
                    ? "border-primary bg-primary/10"
                    : "border-surface3 bg-surface3 hover:border-primary/40"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
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

        {/* ── Word-by-word fade ─────────────────────────────────────────── */}
        <div>
          <div className="font-bold mb-6 text-sm">Word-by-word Fade</div>
          <TogglePair
            value={style.wordFade}
            onChange={(v) => update({ wordFade: v })}
            labelOn="✨ Enabled"
            labelOff="⚡ Disabled (instant)"
          />
        </div>

        {style.wordFade && (
          <div>
            <div className="font-bold mb-4 text-sm flex justify-between">
              <span>Word Speed</span>
              <span className="font-normal text-text-primary/60">{style.wordFadeSpeed}ms / word</span>
            </div>
            <input
              type="range" min={40} max={500} step={10}
              value={style.wordFadeSpeed}
              className="input-range w-full"
              onChange={(e) => update({ wordFadeSpeed: Number(e.target.value) })}
            />
            <div className="text-xs text-text-primary/50 mt-4">
              Captions show 2 lines at a time; when they fill up, the next 2 lines fade in.
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

        </div>

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
