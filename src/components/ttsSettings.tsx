import React, { useCallback } from "react";
import {
  TTSConfig,
  TTS_PROVIDERS,
  QWEN_SPEAKERS,
  ELEVENLABS_MODELS,
  ElevenLabsModel,
} from "@/features/tts/ttsConfig";
import { Link } from "./link";

type Props = {
  ttsConfig: TTSConfig;
  onChangeTTSConfig: (config: TTSConfig) => void;
  koeiroParam: { speakerX: number; speakerY: number };
  onChangeKoeiroParam: (x: number, y: number) => void;
};

const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam" },
];

const CREDIT_TIER_BADGE: Record<string, { label: string; className: string }> = {
  low:    { label: "💚 Low cost",    className: "text-green-700 bg-green-500/10 border-green-500/30" },
  medium: { label: "🟡 Medium cost", className: "text-yellow-700 bg-yellow-500/10 border-yellow-500/30" },
  high:   { label: "🔴 High cost",   className: "text-red-700 bg-red-500/10 border-red-500/30" },
};

const MAX_KEYS = 5;

export const TTSSettings = ({
  ttsConfig,
  onChangeTTSConfig,
  koeiroParam,
  onChangeKoeiroParam,
}: Props) => {
  const update = useCallback(
    (partial: Partial<TTSConfig>) => {
      onChangeTTSConfig({ ...ttsConfig, ...partial });
    },
    [ttsConfig, onChangeTTSConfig]
  );

  const normaliseKeys = (keys?: string[]): string[] => {
    const base = Array.isArray(keys) ? [...keys] : [];
    while (base.length < MAX_KEYS) base.push("");
    return base.slice(0, MAX_KEYS);
  };

  const currentKeys = normaliseKeys(ttsConfig.elevenLabsKeys);

  const handleKeyChange = (index: number, value: string) => {
    const next = [...currentKeys];
    next[index] = value;
    const updates: Partial<TTSConfig> = { elevenLabsKeys: next };
    if (index === 0) updates.elevenLabsKey = value;
    update(updates);
  };

  const handleModelChange = (model: ElevenLabsModel) => {
    update({ elevenLabsModel: model });
  };

  const activeKeyCount = currentKeys.filter(Boolean).length;

  // Providers to show in the grid — koeiromap is excluded from selection
  // but shown as a disabled "discontinued" tile if it's the current provider
  // (so users who had it saved can see why it no longer works).
  const availableProviders = TTS_PROVIDERS.filter((p) => p.value !== "koeiromap");

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">Voice / TTS</div>

      {/* ── Koeiromap discontinued banner (only shown if still selected) ── */}
      {ttsConfig.provider === "koeiromap" && (
        <div className="mb-16 p-14 bg-red-500/10 border border-red-500/30 rounded-8 text-sm text-red-700 leading-relaxed">
          <div className="font-bold mb-4">⚠️ Koeiromap is no longer available</div>
          <p>
            Rinna Co., Ltd. discontinued all services in 2024, including the Koeiromap
            TTS API. The virtual YouTuber Rinna also retired and closed all her social
            media accounts. Please switch to another TTS provider below.
          </p>
        </div>
      )}

      {/* Provider selector */}
      <div className="my-8">
        <div className="font-bold mb-4">TTS Provider</div>
        <div className="grid grid-cols-2 gap-2">
          {availableProviders.map((p) => (
            <button
              key={p.value}
              onClick={() => update({ provider: p.value })}
              className={`p-8 rounded-8 border-2 text-left transition-all ${
                ttsConfig.provider === p.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-surface3 bg-surface1 hover:border-primary/50"
              }`}
            >
              <div className="font-bold text-sm">{p.label}</div>
              <div className="text-xs text-text-primary/60 mt-1">{p.description}</div>
            </button>
          ))}

          {/* Koeiromap — always shown as a disabled discontinued tile */}
          <button
            disabled
            className="p-8 rounded-8 border-2 border-surface3 bg-surface1 text-left opacity-50 cursor-not-allowed relative"
          >
            <div className="font-bold text-sm line-through text-text-primary/40">Koeiromap</div>
            <div className="text-xs text-red-500 mt-1 font-bold">🚫 Discontinued — service shut down</div>
          </button>
        </div>
      </div>

      {/* ── ElevenLabs ────────────────────────────────────────────────────── */}
      {ttsConfig.provider === "elevenlabs" && (
        <div className="my-16 p-16 bg-surface1 rounded-8 flex flex-col gap-16">

          {/* Model selector */}
          <div>
            <div className="font-bold mb-8">Model</div>
            <div className="flex flex-col gap-6">
              {ELEVENLABS_MODELS.map((m) => {
                const badge = CREDIT_TIER_BADGE[m.creditCostTier];
                const isSelected = (ttsConfig.elevenLabsModel ?? "eleven_flash_v2_5") === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => handleModelChange(m.value)}
                    className={`p-10 rounded-8 border-2 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-surface3 bg-surface3 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-8">
                      <span className="font-bold text-sm">{m.label}</span>
                      <span className={`text-xs px-8 py-2 rounded-oval border font-bold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs text-text-primary/60 mt-2">{m.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-10 p-10 bg-blue-500/10 border border-blue-500/20 rounded-8 text-xs text-blue-700 leading-relaxed">
              <strong>Credit guide:</strong> Flash 2.5 costs roughly <strong>~60% less</strong> than
              Turbo 2.5 per character. For conversational chat, Flash 2.5 sounds excellent and will
              stretch your 5 × 10,000 = <strong>50,000 credits</strong> much further.
              Turbo 2.5 is best when you notice quality differences on emotional lines.
            </div>
          </div>

          {/* API key rotation pool */}
          <div>
            <div className="font-bold mb-4 flex items-center gap-8">
              <span>API Keys</span>
              <span className="text-xs font-normal text-text-primary/60 bg-surface3 px-8 py-2 rounded-oval">
                {activeKeyCount} / {MAX_KEYS} configured
              </span>
            </div>

            <div className="text-xs text-text-primary/60 mb-10 leading-relaxed">
              Add up to {MAX_KEYS} keys (one per account). If a key runs out of credits or
              hits its rate limit the system automatically rotates to the next available key.
              Key&nbsp;1 is the primary — it is used first.
            </div>

            <div className="flex flex-col gap-8">
              {currentKeys.map((key, index) => (
                <div key={index} className="flex items-center gap-8">
                  <span className="text-xs font-bold text-text-primary/50 w-14 flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="relative flex-1">
                    <input
                      className="text-ellipsis px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 pr-32 text-sm"
                      type="password"
                      placeholder={
                        index === 0
                          ? "sk_… (primary key — used first)"
                          : `sk_… (rotation key ${index + 1})`
                      }
                      value={key}
                      onChange={(e) => handleKeyChange(index, e.target.value)}
                    />
                    <span
                      className="absolute right-10 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full"
                      style={{ background: key.trim() ? "#22c55e" : "#d1d5db" }}
                      title={key.trim() ? "Key configured" : "Empty"}
                    />
                  </div>
                </div>
              ))}
            </div>

            {activeKeyCount > 1 && (
              <div className="mt-10 flex items-center gap-6 text-xs text-green-700 bg-green-500/10 border border-green-500/20 rounded-8 px-10 py-8">
                <span>🔄</span>
                <span>
                  <strong>{activeKeyCount} keys active.</strong> Auto-rotation enabled — keys
                  cycle round-robin and skip any that return a quota or auth error.
                </span>
              </div>
            )}

            <div className="mt-8 text-xs text-text-primary/60">
              Get keys at{" "}
              <Link url="https://elevenlabs.io" label="elevenlabs.io" />.
              Keys are stored locally in your browser and never sent to any server other
              than ElevenLabs.
            </div>
          </div>

          {/* Voice selector */}
          <div>
            <div className="font-bold mb-8">Voice</div>
            <select
              className="px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 mb-8"
              value={ttsConfig.elevenLabsVoiceId || ""}
              onChange={(e) => update({ elevenLabsVoiceId: e.target.value })}
            >
              {ELEVENLABS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <div className="font-bold mb-4 text-sm">Custom Voice ID</div>
            <input
              className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              type="text"
              placeholder="Paste any ElevenLabs voice ID"
              value={ttsConfig.elevenLabsVoiceId || ""}
              onChange={(e) => update({ elevenLabsVoiceId: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* ── Qwen Remote ───────────────────────────────────────────────────── */}
      {ttsConfig.provider === "qwen-remote" && (
        <div className="my-16 p-16 bg-surface1 rounded-8">
          <div className="font-bold mb-4">Remote URL (ngrok)</div>
          <input
            className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 mb-12"
            type="text"
            placeholder="https://xxxx.ngrok-free.app"
            value={ttsConfig.qwenRemoteUrl || ""}
            onChange={(e) => update({ qwenRemoteUrl: e.target.value })}
          />
          <div className="font-bold mb-8">Speaker</div>
          <select
            className="px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
            value={ttsConfig.qwenSpeaker || "Vivian"}
            onChange={(e) => update({ qwenSpeaker: e.target.value })}
          >
            {QWEN_SPEAKERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="text-sm text-text-primary/60 mt-8">
            Run the Qwen3-TTS Colab/Kaggle notebook and paste the ngrok URL here.
          </div>
        </div>
      )}

      {/* ── GPT-SoVITS ────────────────────────────────────────────────────── */}
      {ttsConfig.provider === "gpt-sovits" && (
        <div className="my-16 p-16 bg-surface1 rounded-8">
          <div className="font-bold mb-4">Remote URL (ngrok)</div>
          <input
            className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
            type="text"
            placeholder="https://xxxx.ngrok-free.app"
            value={ttsConfig.gptsovitsRemoteUrl || ""}
            onChange={(e) => update({ gptsovitsRemoteUrl: e.target.value })}
          />
          <div className="text-sm text-text-primary/60 mt-8">
            Run the GPT-SoVITS Kaggle/Colab notebook and paste the ngrok URL here.
          </div>
        </div>
      )}
    </div>
  );
};
