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

export type TTSConfig = {
  provider: TTSProvider;
  // Koeiromap
  koeiromapKey?: string;
  // ElevenLabs
  elevenLabsKey?: string;
  elevenLabsVoiceId?: string;
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
  elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
  qwenRemoteUrl: "",
  qwenSpeaker: "Vivian",
  gptsovitsRemoteUrl: "",
};

export const QWEN_SPEAKERS = ["Vivian", "Chelsie", "Cherry", "Ethan", "Aiden", "Ryan"];
