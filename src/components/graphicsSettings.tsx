import React, { useContext, useEffect, useState } from "react";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import {
  DEFAULT_GRAPHICS_CONFIG,
  FPS_OPTIONS,
  GraphicsConfig,
  HardwareInfo,
  PerfStats,
  QUALITY_PRESETS,
  QualityPreset,
  autoProfileFor,
  detectHardware,
} from "@/features/graphics/graphicsConfig";

type Props = {
  config: GraphicsConfig;
  onChangeConfig: (config: GraphicsConfig) => void;
};

const Slider = ({
  label, value, min, max, step, format, onChange, hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}) => (
  <div className="mb-16">
    <div className="font-bold mb-4 flex justify-between">
      <span>{label}</span>
      <span className="text-text-primary/60 font-normal">{format ? format(value) : value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      className="input-range w-full"
      onChange={(e) => onChange(Number(e.target.value))}
    />
    {hint && <div className="text-xs text-text-primary/60 mt-4">{hint}</div>}
  </div>
);

export const GraphicsSettings = ({ config, onChangeConfig }: Props) => {
  const { viewer } = useContext(ViewerContext);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [stats, setStats] = useState<PerfStats | null>(null);

  useEffect(() => {
    setHardware(detectHardware());
    const id = setInterval(() => setStats(viewer.getPerfStats()), 1000);
    setStats(viewer.getPerfStats());
    return () => clearInterval(id);
  }, [viewer]);

  const update = (partial: Partial<GraphicsConfig>) => onChangeConfig({ ...config, ...partial });

  const applyPreset = (preset: QualityPreset) => {
    const p = QUALITY_PRESETS[preset];
    update({
      autoQuality: false,
      fpsLimit: p.fpsLimit,
      resolutionScale: p.resolutionScale,
      maxPixelRatio: p.maxPixelRatio,
      antialias: p.antialias,
    });
  };

  const rec = hardware ? autoProfileFor(hardware.tier) : null;
  // antialias is baked into the WebGL context when the canvas is created
  const aaNeedsReload = config.antialias !== viewer.antialiasActive;

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">3D &amp; Performance</div>

      {/* Hardware + live stats */}
      <div className="p-16 bg-surface1 rounded-8 mb-16 text-sm">
        <div className="flex flex-wrap gap-x-24 gap-y-4">
          <div>
            <span className="text-text-primary/60">Detected: </span>
            <b>{hardware ? `${hardware.tier.toUpperCase()} tier` : "…"}</b>
            {hardware && (
              <span className="text-text-primary/60"> — {hardware.reason}</span>
            )}
          </div>
        </div>
        {hardware && (
          <div className="text-xs text-text-primary/60 mt-4 break-all">
            GPU: {hardware.gpu} · {hardware.cores} CPU threads
            {hardware.memoryGB ? ` · ${hardware.memoryGB}GB RAM` : ""}
          </div>
        )}
        {stats && (
          <div className="mt-8 flex flex-wrap gap-8">
            <span className="px-8 py-2 rounded-8 bg-surface3 font-bold">{stats.fps} FPS</span>
            <span className="px-8 py-2 rounded-8 bg-surface3">
              resolution ×{stats.resolutionScale} (pixel ratio {stats.pixelRatio})
            </span>
            <span className="px-8 py-2 rounded-8 bg-surface3">
              cap {stats.fpsTarget > 0 ? `${stats.fpsTarget} FPS` : "none"}
            </span>
            {config.autoQuality && stats.autoAdjusted && (
              <span className="px-8 py-2 rounded-8 bg-primary/20 text-primary font-bold">auto-adjusted</span>
            )}
          </div>
        )}
      </div>

      <div className="p-16 bg-surface1 rounded-8">
        {/* Auto */}
        <label className="flex items-start gap-8 cursor-pointer mb-16">
          <input
            type="checkbox"
            checked={config.autoQuality}
            onChange={(e) => update({ autoQuality: e.target.checked })}
            className="w-16 h-16 accent-primary mt-2"
          />
          <span>
            <span className="font-bold">Automatic quality</span>
            <span className="block text-xs text-text-primary/60">
              Picks a starting resolution for your hardware
              {rec ? ` (${rec.label}: ×${rec.resolutionScale})` : ""} and keeps adjusting it while the
              avatar runs so the frame rate holds steady — it lowers resolution when the GPU struggles
              (e.g. while you&apos;re streaming or gaming) and raises it again when there&apos;s room.
              The FPS limit and resolution below act as maximums.
            </span>
          </span>
        </label>

        {/* Presets */}
        <div className="mb-16">
          <div className="font-bold mb-4">Quick presets</div>
          <div className="flex flex-wrap gap-8">
            {(Object.keys(QUALITY_PRESETS) as QualityPreset[]).map((k) => (
              <button
                key={k}
                onClick={() => applyPreset(k)}
                className="px-16 py-6 rounded-oval border-2 border-surface3 bg-surface1 hover:bg-surface3 text-sm font-bold"
                title={`${QUALITY_PRESETS[k].fpsLimit} FPS · ×${QUALITY_PRESETS[k].resolutionScale} resolution`}
              >
                {QUALITY_PRESETS[k].label}
              </button>
            ))}
          </div>
          <div className="text-xs text-text-primary/60 mt-4">
            Presets set the values below and switch Automatic quality off.
          </div>
        </div>

        {/* FPS */}
        <div className="mb-16">
          <div className="font-bold mb-4">FPS limit</div>
          <select
            value={config.fpsLimit}
            onChange={(e) => update({ fpsLimit: Number(e.target.value) })}
            className="px-16 py-8 bg-surface3 hover:bg-surface3-hover rounded-8"
          >
            {FPS_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f === 0 ? "Unlimited (match monitor)" : `${f} FPS`}
              </option>
            ))}
          </select>
          <div className="text-xs text-text-primary/60 mt-4">
            Lower = less GPU/CPU use, leaving more headroom for your game and the stream encoder.
          </div>
        </div>

        <Slider
          label={config.autoQuality ? "Maximum resolution scale" : "Resolution scale"}
          value={config.resolutionScale}
          min={0.4}
          max={2}
          step={0.05}
          format={(v) => `×${v.toFixed(2)}`}
          onChange={(v) => update({ resolutionScale: v })}
          hint="Render resolution relative to your screen's native pixels. 1.0 = native."
        />
        <Slider
          label="Max pixel ratio"
          value={config.maxPixelRatio}
          min={0.5}
          max={3}
          step={0.25}
          format={(v) => v.toFixed(2)}
          onChange={(v) => update({ maxPixelRatio: v })}
          hint="Caps the final resolution on high-DPI / 4K screens."
        />

        <label className="flex items-center gap-8 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={config.antialias}
            onChange={(e) => update({ antialias: e.target.checked })}
            className="w-16 h-16 accent-primary"
          />
          <span className="font-bold">Anti-aliasing (smooth edges)</span>
        </label>
        {aaNeedsReload && (
          <div className="mb-16 text-xs text-secondary">
            Anti-aliasing is fixed when the canvas is created — reload the page to apply it.{" "}
            <button
              className="underline font-bold"
              onClick={() => {
                // make sure the new value is on disk before reloading
                window.setTimeout(() => window.location.reload(), 150);
              }}
            >
              Reload now
            </button>
          </div>
        )}
        {!aaNeedsReload && <div className="mb-16" />}

        {/* Lighting */}
        <div className="font-bold mb-8 pt-8 border-t border-surface3">Lighting</div>
        <Slider label="Key light" value={config.lightIntensity} min={0} max={2} step={0.05}
          format={(v) => v.toFixed(2)} onChange={(v) => update({ lightIntensity: v })} />
        <Slider label="Ambient light" value={config.ambientIntensity} min={0} max={2} step={0.05}
          format={(v) => v.toFixed(2)} onChange={(v) => update({ ambientIntensity: v })} />
        <Slider label="Key light direction (left ↔ right)" value={config.lightAzimuth} min={-180} max={180} step={5}
          format={(v) => `${v}°`} onChange={(v) => update({ lightAzimuth: v })} />
        <Slider label="Key light height" value={config.lightElevation} min={0} max={90} step={5}
          format={(v) => `${v}°`} onChange={(v) => update({ lightElevation: v })} />

        <button
          onClick={() => onChangeConfig({ ...DEFAULT_GRAPHICS_CONFIG })}
          className="px-16 py-6 rounded-oval border-2 border-surface3 bg-surface1 hover:bg-surface3 text-sm font-bold"
        >
          Reset 3D settings
        </button>
      </div>
    </div>
  );
};
