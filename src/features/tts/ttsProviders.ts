import { TalkStyle } from "../messages/messages";
import { TTSConfig } from "./ttsConfig";
import { reduceTalkStyle } from "@/utils/reduceTalkStyle";
import { koeiromapFreeV1 } from "../koeiromap/koeiromap";

// ── Koeiromap (original) ─────────────────────────────────────────────────────
export async function synthesizeKoeiromap(
  message: string,
  speakerX: number,
  speakerY: number,
  style: TalkStyle,
  apiKey: string
): Promise<ArrayBuffer> {
  const reducedStyle = reduceTalkStyle(style);
  const body = {
    message,
    speakerX,
    speakerY,
    style: reducedStyle,
    apiKey,
  };
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as any;
  const audioUrl = data.audio;
  const audioRes = await fetch(audioUrl);
  return audioRes.arrayBuffer();
}

// ── ElevenLabs ───────────────────────────────────────────────────────────────
export async function synthesizeElevenLabs(
  message: string,
  voiceId: string,
  apiKey: string
): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: message,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error: ${res.status} — ${err}`);
  }
  return res.arrayBuffer();
}

// ── Qwen3-TTS Remote ─────────────────────────────────────────────────────────
export async function synthesizeQwenRemote(
  message: string,
  remoteUrl: string,
  speaker = "Vivian"
): Promise<ArrayBuffer> {
  const url = remoteUrl.replace(/\/$/, "") + "/tts";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message, speaker }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qwen TTS error: ${res.status} — ${err}`);
  }
  return res.arrayBuffer();
}

// ── GPT-SoVITS Remote ────────────────────────────────────────────────────────
export async function synthesizeGPTSoVITS(
  message: string,
  remoteUrl: string
): Promise<ArrayBuffer> {
  const url = remoteUrl.replace(/\/$/, "") + "/tts";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message, language: "auto" }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GPT-SoVITS error: ${res.status} — ${err}`);
  }
  return res.arrayBuffer();
}

// ── Unified synthesizer ───────────────────────────────────────────────────────
export async function synthesizeWithProvider(
  message: string,
  style: TalkStyle,
  speakerX: number,
  speakerY: number,
  config: TTSConfig
): Promise<ArrayBuffer> {
  switch (config.provider) {
    case "koeiromap":
      return synthesizeKoeiromap(
        message,
        speakerX,
        speakerY,
        style,
        config.koeiromapKey || ""
      );
    case "elevenlabs":
      return synthesizeElevenLabs(
        message,
        config.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM",
        config.elevenLabsKey || ""
      );
    case "qwen-remote":
      if (!config.qwenRemoteUrl)
        throw new Error("Qwen Remote URL not configured");
      return synthesizeQwenRemote(
        message,
        config.qwenRemoteUrl,
        config.qwenSpeaker
      );
    case "gpt-sovits":
      if (!config.gptsovitsRemoteUrl)
        throw new Error("GPT-SoVITS Remote URL not configured");
      return synthesizeGPTSoVITS(message, config.gptsovitsRemoteUrl);
    default:
      throw new Error(`Unknown TTS provider: ${config.provider}`);
  }
}
