import React, { useCallback } from "react";
import { TTSConfig, TTS_PROVIDERS, QWEN_SPEAKERS } from "@/features/tts/ttsConfig";
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

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">Voice / TTS</div>

      {/* Provider selector */}
      <div className="my-8">
        <div className="font-bold mb-4">TTS Provider</div>
        <div className="grid grid-cols-2 gap-2">
          {TTS_PROVIDERS.map((p) => (
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
        </div>
      </div>

      {/* Koeiromap settings */}
      {ttsConfig.provider === "koeiromap" && (
        <div className="my-16 p-16 bg-surface1 rounded-8">
          <div className="font-bold mb-8">Koeiromap API Key</div>
          <input
            className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 mb-8"
            type="text"
            placeholder="Your Koeiromap API key"
            value={ttsConfig.koeiromapKey || ""}
            onChange={(e) => update({ koeiromapKey: e.target.value })}
          />
          <div className="text-sm text-text-primary/60">
            Get your key at{" "}
            <Link
              url="https://developers.rinna.co.jp/product/#product=koeiromap-free"
              label="rinna Developers"
            />
          </div>
          <div className="mt-16 font-bold mb-8">Voice Parameters</div>
          <div className="select-none text-sm">X: {koeiroParam.speakerX.toFixed(2)}</div>
          <input
            type="range" min={-10} max={10} step={0.001}
            value={koeiroParam.speakerX}
            className="mt-4 mb-12 input-range"
            onChange={(e) => onChangeKoeiroParam(Number(e.target.value), koeiroParam.speakerY)}
          />
          <div className="select-none text-sm">Y: {koeiroParam.speakerY.toFixed(2)}</div>
          <input
            type="range" min={-10} max={10} step={0.001}
            value={koeiroParam.speakerY}
            className="mt-4 mb-12 input-range"
            onChange={(e) => onChangeKoeiroParam(koeiroParam.speakerX, Number(e.target.value))}
          />
        </div>
      )}

      {/* ElevenLabs settings */}
      {ttsConfig.provider === "elevenlabs" && (
        <div className="my-16 p-16 bg-surface1 rounded-8">
          <div className="font-bold mb-8">ElevenLabs API Key</div>
          <input
            className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 mb-12"
            type="text"
            placeholder="sk_..."
            value={ttsConfig.elevenLabsKey || ""}
            onChange={(e) => update({ elevenLabsKey: e.target.value })}
          />
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
          <div className="font-bold mb-4 mt-8">Custom Voice ID</div>
          <input
            className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
            type="text"
            placeholder="Paste any ElevenLabs voice ID"
            value={ttsConfig.elevenLabsVoiceId || ""}
            onChange={(e) => update({ elevenLabsVoiceId: e.target.value })}
          />
          <div className="text-sm text-text-primary/60 mt-8">
            Get an API key at{" "}
            <Link url="https://elevenlabs.io" label="elevenlabs.io" />
          </div>
        </div>
      )}

      {/* Qwen Remote settings */}
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

      {/* GPT-SoVITS settings */}
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
