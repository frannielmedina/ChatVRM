// ── Vision configuration ──────────────────────────────────────────────────────

export type VisionConfig = {
  enabled: boolean;
  intervalSeconds: number; // How often to capture (default 420 = 7 min)
  model: string;           // llama-4-scout-17b-16e-instruct
  groqApiKey: string;      // Uses same Groq key as chat by default
};

export const DEFAULT_VISION_CONFIG: VisionConfig = {
  enabled: false,
  intervalSeconds: 420, // 7 minutes
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
  groqApiKey: "",
};

export const VISION_INTERVALS = [
  { label: "30 segundos", value: 30 },
  { label: "1 minuto", value: 60 },
  { label: "2 minutos", value: 120 },
  { label: "5 minutos", value: 300 },
  { label: "7 minutos", value: 420 },
  { label: "10 minutos", value: 600 },
  { label: "15 minutos", value: 900 },
];
