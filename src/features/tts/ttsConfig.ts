export type TTSProvider = "koeiromap" | "elevenlabs" | "qwen-remote" | "gpt-sovits";

export const TTS_PROVIDERS: { value: TTSProvider; label: string; description: string }[] = [
  {
    value: "koeiromap",
    label: "Koeiromap",
    description: "Koeiromap API by rinna — anime-style voices",
  },
  {
    value: "elevenlabs",
    label: "ElevenLabs",
    description: "ElevenLabs API — realistic voice cloning",
  },
  {
    value: "qwen-remote",
    label: "Qwen3 TTS (Remote)",
    description: "Qwen3-TTS running on Colab/Kaggle — paste your ngrok URL",
  },
  {
    value: "gpt-sovits",
    label: "GPT-SoVITS (Remote)",
    description: "GPT-SoVITS running on Colab/Kaggle — paste your ngrok URL",
  },
];

// ── ElevenLabs model options ──────────────────────────────────────────────────
export type ElevenLabsModel =
  | "eleven_v3"
  | "eleven_flash_v2_5"
  | "eleven_turbo_v2_5"
  | "eleven_multilingual_v2"
  | "eleven_monolingual_v1";

export const ELEVENLABS_MODELS: {
  value: ElevenLabsModel;
  label: string;
  description: string;
  creditCostTier: "low" | "medium" | "high";
}[] = [
  {
    value: "eleven_v3",
    label: "Eleven v3 (alpha)",
    description:
      "Only model that understands audio tags like [laughs], [whispers], [artificial noises] · higher latency · 3,000 char limit",
    creditCostTier: "high",
  },
  {
    value: "eleven_flash_v2_5",
    label: "Eleven Flash 2.5",
    description: "Fastest · ~60% cheaper than Turbo · great for chat",
    creditCostTier: "low",
  },
  {
    value: "eleven_turbo_v2_5",
    label: "Eleven Turbo 2.5",
    description: "High quality · low latency · moderate credit cost",
    creditCostTier: "medium",
  },
  {
    value: "eleven_multilingual_v2",
    label: "Multilingual v2",
    description: "Best quality · highest credit cost · 29 languages",
    creditCostTier: "high",
  },
  {
    value: "eleven_monolingual_v1",
    label: "Monolingual v1",
    description: "Legacy English-only model",
    creditCostTier: "medium",
  },
];

export type TTSConfig = {
  provider: TTSProvider;
  // Koeiromap
  koeiromapKey?: string;
  // ElevenLabs — primary key + up to 4 rotation keys
  elevenLabsKey?: string;
  elevenLabsKeys?: string[];   // rotation pool (index 0 = primary, matches elevenLabsKey)
  elevenLabsVoiceId?: string;
  elevenLabsModel?: ElevenLabsModel;
  // Qwen Remote
  qwenRemoteUrl?: string;
  qwenSpeaker?: string;
  // GPT-SoVITS Remote
  gptsovitsRemoteUrl?: string;
};

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  provider: "koeiromap",
  koeiromapKey: "",
  elevenLabsKey: "",
  elevenLabsKeys: ["", "", "", "", ""],
  elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
  elevenLabsModel: "eleven_flash_v2_5",
  qwenRemoteUrl: "",
  qwenSpeaker: "Vivian",
  gptsovitsRemoteUrl: "",
};

export const QWEN_SPEAKERS = ["Vivian", "Chelsie", "Cherry", "Ethan", "Aiden", "Ryan"];
