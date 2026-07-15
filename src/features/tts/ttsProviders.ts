import { TalkStyle } from "../messages/messages";
import { TTSConfig, ElevenLabsModel } from "./ttsConfig";
import { reduceTalkStyle } from "@/utils/reduceTalkStyle";
import { koeiromapFreeV1 } from "../koeiromap/koeiromap";
import { stripEmojisForTTS, stripUnspokenSymbolsForTTS } from "../messages/messages";

// ── Koeiromap ─────────────────────────────────────────────────────────────────
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

// ── ElevenLabs key rotation state ────────────────────────────────────────────
// Tracks which key index to use next, and which keys have failed this session.
let _elevenLabsKeyIndex = 0;
const _elevenLabsFailedKeys = new Set<string>();

/**
 * Returns the list of non-empty ElevenLabs keys from the config,
 * deduplicating so the primary key (elevenLabsKey) and the rotation pool
 * (elevenLabsKeys) don't double-count.
 */
function getElevenLabsKeyPool(config: TTSConfig): string[] {
  const pool: string[] = [];
  const seen = new Set<string>();

  // elevenLabsKeys[0] is kept in sync with elevenLabsKey in the settings UI,
  // so just iterate the array.
  const keys = config.elevenLabsKeys ?? [];
  // Fallback: if rotation pool is empty/not set, use the single key field.
  if (keys.filter(Boolean).length === 0 && config.elevenLabsKey) {
    return [config.elevenLabsKey];
  }

  for (const k of keys) {
    const trimmed = k?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      pool.push(trimmed);
    }
  }
  return pool;
}

/**
 * Credit-saving optimisation: trim leading/trailing whitespace and collapse
 * multiple consecutive spaces/newlines into one space. ElevenLabs charges per
 * character, so removing redundant whitespace reduces the character count
 * without changing how the speech sounds.
 */
function optimizeTextForCredits(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")           // collapse whitespace runs
    .replace(/([.!?])\s+/g, "$1 "); // normalise post-punctuation spacing
}

// ── ElevenLabs TTS with key rotation ─────────────────────────────────────────
export async function synthesizeElevenLabs(
  message: string,
  voiceId: string,
  apiKey: string,
  model: ElevenLabsModel = "eleven_flash_v2_5"
): Promise<ArrayBuffer> {
  const optimized = optimizeTextForCredits(message);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: optimized,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          // style is not needed for flash/turbo — saves processing time
          ...(model === "eleven_multilingual_v2" ? { style: 0.3 } : {}),
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error: ${res.status} — ${err}`);
  }
  return res.arrayBuffer();
}

/**
 * Synthesizes with automatic key rotation.
 * Tries each key in the pool in round-robin order.
 * If a key fails (quota exceeded / 401 / 429), it marks it as failed
 * and tries the next one.
 * Resets the failed-keys set when all keys have been exhausted so it can
 * retry after the accounts refill.
 */
export async function synthesizeElevenLabsWithRotation(
  message: string,
  config: TTSConfig
): Promise<ArrayBuffer> {
  const voiceId = config.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM";
  const model = config.elevenLabsModel ?? "eleven_flash_v2_5";
  const pool = getElevenLabsKeyPool(config);

  if (pool.length === 0) {
    throw new Error("No ElevenLabs API keys configured.");
  }

  // Filter out keys already known to be exhausted this session
  const available = pool.filter((k) => !_elevenLabsFailedKeys.has(k));

  // If all keys failed this session, reset and try again from scratch
  if (available.length === 0) {
    console.warn("[ElevenLabs] All keys exhausted — resetting rotation pool.");
    _elevenLabsFailedKeys.clear();
    available.push(...pool);
  }

  // Round-robin: pick the next available key
  _elevenLabsKeyIndex = _elevenLabsKeyIndex % available.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < available.length; attempt++) {
    const keyIndex = (_elevenLabsKeyIndex + attempt) % available.length;
    const key = available[keyIndex];

    try {
      const result = await synthesizeElevenLabs(message, voiceId, key, model);
      // Success — advance the index for next call (round-robin)
      _elevenLabsKeyIndex = (keyIndex + 1) % available.length;
      return result;
    } catch (err: any) {
      const statusMatch = err.message?.match(/error: (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 0;

      // Mark the key as failed on quota (402), auth (401), or rate limit (429)
      if (status === 401 || status === 402 || status === 429) {
        console.warn(
          `[ElevenLabs] Key ending in …${key.slice(-6)} failed (${status}). Rotating.`
        );
        _elevenLabsFailedKeys.add(key);
        lastError = err;
        continue;
      }

      // Other errors (5xx, network) — don't blacklist the key, just throw
      throw err;
    }
  }

  throw lastError ?? new Error("All ElevenLabs keys failed.");
}

// ── Fish Audio ───────────────────────────────────────────────────────────────
// Routed through /api/fish-tts since Fish Audio's API doesn't support being
// called directly from a browser (no CORS headers on their end).
export async function synthesizeFishAudio(
  message: string,
  config: TTSConfig
): Promise<ArrayBuffer> {
  if (!config.fishAudioKey) {
    throw new Error("No Fish Audio API key configured.");
  }

  const res = await fetch("/api/fish-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message,
      apiKey: config.fishAudioKey,
      model: config.fishAudioModel || "s2.1-pro-free",
      referenceId: config.fishAudioReferenceId || undefined,
      format: config.fishAudioFormat || "mp3",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fish Audio error: ${res.status} — ${err}`);
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
// stripEmojisForTTS/stripUnspokenSymbolsForTTS are applied here as a final
// safety net regardless of which provider is used — this catches any call
// path that bypasses textsToScreenplay.
export async function synthesizeWithProvider(
  message: string,
  style: TalkStyle,
  speakerX: number,
  speakerY: number,
  config: TTSConfig
): Promise<ArrayBuffer> {
  // Always strip emojis and unspoken symbols before sending to any TTS engine
  const cleanMessage = stripUnspokenSymbolsForTTS(stripEmojisForTTS(message));

  switch (config.provider) {
    case "koeiromap":
      return synthesizeKoeiromap(
        cleanMessage,
        speakerX,
        speakerY,
        style,
        config.koeiromapKey || ""
      );
    case "elevenlabs":
      return synthesizeElevenLabsWithRotation(cleanMessage, config);
    case "fish-audio":
      return synthesizeFishAudio(cleanMessage, config);
    case "qwen-remote":
      if (!config.qwenRemoteUrl)
        throw new Error("Qwen Remote URL not configured");
      return synthesizeQwenRemote(cleanMessage, config.qwenRemoteUrl, config.qwenSpeaker);
    case "gpt-sovits":
      if (!config.gptsovitsRemoteUrl)
        throw new Error("GPT-SoVITS Remote URL not configured");
      return synthesizeGPTSoVITS(cleanMessage, config.gptsovitsRemoteUrl);
    default:
      throw new Error(`Unknown TTS provider: ${config.provider}`);
  }
}
