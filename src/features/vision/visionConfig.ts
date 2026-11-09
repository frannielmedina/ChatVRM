// ── Vision configuration ──────────────────────────────────────────────────────

export type VisionConfig = {
  enabled: boolean;
  intervalSeconds: number; // How often to capture (default 420 = 7 min)
  model: string;           // typed by the user: a Groq model id ("qwen/qwen3.6-27b") or a friendly name ("Qwen 3.8 27b")
  groqApiKey: string;      // Uses same Groq key as chat by default
};

export const DEFAULT_VISION_CONFIG: VisionConfig = {
  enabled: false,
  intervalSeconds: 420, // 7 minutes
  model: "qwen/qwen3.6-27b",
  groqApiKey: "",
};

export const VISION_INTERVALS = [
  { label: "30 seconds", value: 30 },
  { label: "1 minute",   value: 60 },
  { label: "2 minutes",  value: 120 },
  { label: "5 minutes",  value: 300 },
  { label: "7 minutes",  value: 420 },
  { label: "10 minutes", value: 600 },
  { label: "15 minutes", value: 900 },
];

// Quick-pick suggestions shown in the model field's dropdown (any text can be typed instead).
export const VISION_MODEL_PRESETS = [
  "qwen/qwen3.6-27b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
];

/**
 * Turns whatever the user typed into the model id sent to Groq.
 *  - Already an id ("qwen/qwen3.8-27b", "org/model")      → used as typed
 *  - Friendly Qwen name ("Qwen 3.8 27b", "qwen3.8 27B")  → "qwen/qwen3.8-27b"
 *  - Any other text with spaces                           → lower-cased, spaces → "-"
 *  - Empty                                                → the default model
 */
export function resolveVisionModel(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return DEFAULT_VISION_CONFIG.model;
  if (raw.includes("/") && !/\s/.test(raw)) return raw;

  const lower = raw.toLowerCase();
  const qwen = /^qwen\s*-?\s*(\d+(?:\.\d+)?)[\s-]*(\d+(?:\.\d+)?b)(?:[\s-]*(.+))?$/.exec(lower);
  if (qwen) {
    const suffix = qwen[3] ? `-${qwen[3].trim().replace(/\s+/g, "-")}` : "";
    return `qwen/qwen${qwen[1]}-${qwen[2]}${suffix}`;
  }
  return lower.replace(/\s+/g, "-");
}
