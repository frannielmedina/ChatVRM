import React, { useCallback, useRef } from "react";
import {
  BackgroundConfig,
  PRESET_COLORS,
  BackgroundType,
} from "@/features/background/backgroundConfig";
import { buildUrl } from "@/utils/buildUrl";

type Props = {
  config: BackgroundConfig;
  onChangeConfig: (c: BackgroundConfig) => void;
};

export const BackgroundSettings = ({ config, onChangeConfig }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    (partial: Partial<BackgroundConfig>) =>
      onChangeConfig({ ...config, ...partial }),
    [config, onChangeConfig]
  );

  const handleTypeChange = (type: BackgroundType) => update({ type });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      update({ type: "image", imageUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">Background</div>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-8 mb-16">
        {(
          [
            { value: "image" as BackgroundType, label: "🖼️ Image", desc: "Default or custom image" },
            { value: "color" as BackgroundType, label: "🎨 Solid Color", desc: "Choose any color" },
            { value: "greenscreen" as BackgroundType, label: "🟩 Green Screen", desc: "Pure chroma-key green" },
            { value: "none" as BackgroundType, label: "✨ None", desc: "Transparent background" },
          ] as { value: BackgroundType; label: string; desc: string }[]
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleTypeChange(opt.value)}
            className={`p-12 rounded-8 border-2 text-left transition-all ${
              config.type === opt.value
                ? "border-primary bg-primary/10"
                : "border-surface3 bg-surface1 hover:border-primary/50"
            }`}
          >
            <div className="font-bold text-sm">{opt.label}</div>
            <div className="text-xs text-text-primary/60 mt-1">{opt.desc}</div>
          </button>
        ))}
      </div>

      {/* Color picker */}
      {config.type === "color" && (
        <div className="p-16 bg-surface1 rounded-8">
          <div className="font-bold mb-8">Pick a Color</div>
          <div className="flex flex-wrap gap-8 mb-12">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => update({ color: c.value })}
                className={`w-32 h-32 rounded-full border-4 transition-all ${
                  config.color === c.value
                    ? "border-primary scale-110"
                    : "border-surface3"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <div className="flex items-center gap-8">
            <label className="font-bold text-sm">Custom:</label>
            <input
              type="color"
              value={config.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-40 h-32 rounded-4 cursor-pointer border-0"
            />
            <span className="text-sm text-text-primary/60">{config.color}</span>
          </div>
        </div>
      )}

      {/* Image upload */}
      {config.type === "image" && (
        <div className="p-16 bg-surface1 rounded-8">
          <div className="font-bold mb-8">Background Image</div>
          <div className="flex items-center gap-8 mb-12">
            <button
              onClick={() => update({ imageUrl: "", builtinImage: "bg-c.png" })}
              className={`px-12 py-6 rounded-8 text-sm border-2 transition-all ${
                !config.imageUrl
                  ? "border-primary bg-primary/10"
                  : "border-surface3 bg-surface3"
              }`}
            >
              Default
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-12 py-6 rounded-8 text-sm border-2 border-surface3 bg-surface3 hover:border-primary/50"
            >
              📁 Upload Image
            </button>
          </div>
          {config.imageUrl && (
            <div className="relative">
              <img
                src={config.imageUrl}
                alt="Background preview"
                className="w-full h-32 object-cover rounded-8 mb-8"
              />
              <button
                onClick={() => update({ imageUrl: "" })}
                className="absolute top-4 right-4 bg-black/50 text-white rounded-full w-20 h-20 text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <div className="text-xs text-text-primary/60">
            Upload JPG, PNG, GIF, or WebP. Large files may affect performance.
          </div>
        </div>
      )}

      {/* Green screen info */}
      {config.type === "greenscreen" && (
        <div className="p-16 bg-green-500/10 border border-green-500/30 rounded-8">
          <div className="font-bold text-green-700 mb-4">🟩 Chroma Key Green Screen</div>
          <div className="text-sm text-green-800">
            Background is set to <strong>#00B140</strong> — the standard broadcast chroma-key green.
            Use OBS or any streaming software with a chroma key filter to remove it.
          </div>
          <div className="mt-8 text-xs text-green-700">
            Tip: In OBS, add a <em>Chroma Key</em> filter to this browser source and set the color to green.
          </div>
        </div>
      )}

      {/* None info */}
      {config.type === "none" && (
        <div className="p-16 bg-surface1 rounded-8 text-sm text-text-primary/60">
          Background is fully transparent. The VRM character will float over whatever is behind the browser window.
        </div>
      )}
    </div>
  );
};
