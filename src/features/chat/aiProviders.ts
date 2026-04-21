export type AIProvider =
  | "groq"
  | "mistral"
  | "google"
  | "openrouter"
  | "fireworks"
  | "ollama"
  | "lmstudio";

export type AIProviderConfig = {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string; // for ollama / lmstudio
};

export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  provider: "groq",
  apiKey: "",
  model: "",
  baseUrl: "",
};

export type ProviderMeta = {
  value: AIProvider;
  label: string;
  description: string;
  requiresKey: boolean;
  requiresBaseUrl: boolean;
  keyPlaceholder?: string;
  keyLink?: string;
  keyLinkLabel?: string;
  defaultBaseUrl?: string;
  models: { value: string; label: string }[];
};

export const AI_PROVIDERS: ProviderMeta[] = [
  {
    value: "groq",
    label: "Groq",
    description: "Ultra-fast LPU inference — free tier available",
    requiresKey: true,
    requiresBaseUrl: false,
    keyPlaceholder: "gsk_...",
    keyLink: "https://console.groq.com/keys",
    keyLinkLabel: "console.groq.com",
    models: [
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
      { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
      { value: "llama3-70b-8192", label: "Llama 3 70B" },
      { value: "llama3-8b-8192", label: "Llama 3 8B" },
      { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
      { value: "gemma2-9b-it", label: "Gemma 2 9B" },
    ],
  },
  {
    value: "mistral",
    label: "Mistral AI",
    description: "European AI — strong multilingual models",
    requiresKey: true,
    requiresBaseUrl: false,
    keyPlaceholder: "...",
    keyLink: "https://console.mistral.ai/api-keys",
    keyLinkLabel: "console.mistral.ai",
    models: [
      { value: "mistral-large-latest", label: "Mistral Large" },
      { value: "mistral-medium-latest", label: "Mistral Medium" },
      { value: "mistral-small-latest", label: "Mistral Small" },
      { value: "open-mistral-nemo", label: "Mistral Nemo (free)" },
      { value: "open-mistral-7b", label: "Mistral 7B (free)" },
      { value: "open-mixtral-8x7b", label: "Mixtral 8x7B (free)" },
    ],
  },
  {
    value: "google",
    label: "Google AI Studio",
    description: "Gemini models — generous free quota",
    requiresKey: true,
    requiresBaseUrl: false,
    keyPlaceholder: "AIza...",
    keyLink: "https://aistudio.google.com/app/apikey",
    keyLinkLabel: "aistudio.google.com",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { value: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "Access 200+ models from one API",
    requiresKey: true,
    requiresBaseUrl: false,
    keyPlaceholder: "sk-or-...",
    keyLink: "https://openrouter.ai/keys",
    keyLinkLabel: "openrouter.ai",
    models: [
      { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
      { value: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (free)" },
      { value: "mistralai/mistral-nemo", label: "Mistral Nemo (free)" },
      { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { value: "openai/gpt-4o", label: "GPT-4o" },
      { value: "deepseek/deepseek-chat", label: "DeepSeek V3" },
    ],
  },
  {
    value: "fireworks",
    label: "Fireworks AI",
    description: "Fast inference, affordable pricing",
    requiresKey: true,
    requiresBaseUrl: false,
    keyPlaceholder: "fw_...",
    keyLink: "https://fireworks.ai/account/api-keys",
    keyLinkLabel: "fireworks.ai",
    models: [
      { value: "accounts/fireworks/models/llama-v3p3-70b-instruct", label: "Llama 3.3 70B" },
      { value: "accounts/fireworks/models/llama-v3p1-8b-instruct", label: "Llama 3.1 8B" },
      { value: "accounts/fireworks/models/mixtral-8x7b-instruct", label: "Mixtral 8x7B" },
      { value: "accounts/fireworks/models/gemma2-9b-it", label: "Gemma 2 9B" },
      { value: "accounts/fireworks/models/qwen2p5-72b-instruct", label: "Qwen 2.5 72B" },
    ],
  },
  {
    value: "ollama",
    label: "Ollama",
    description: "Run models locally — no API key needed",
    requiresKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
    models: [
      { value: "llama3.2", label: "Llama 3.2" },
      { value: "llama3.1", label: "Llama 3.1" },
      { value: "mistral", label: "Mistral" },
      { value: "gemma2", label: "Gemma 2" },
      { value: "qwen2.5", label: "Qwen 2.5" },
      { value: "phi3", label: "Phi-3" },
    ],
  },
  {
    value: "lmstudio",
    label: "LM Studio",
    description: "Local models via LM Studio server",
    requiresKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:1234",
    models: [
      { value: "local-model", label: "Active model in LM Studio" },
    ],
  },
];

export function getProviderMeta(provider: AIProvider): ProviderMeta {
  return AI_PROVIDERS.find((p) => p.value === provider)!;
}

export function getDefaultModel(provider: AIProvider): string {
  const meta = getProviderMeta(provider);
  return meta.models[0]?.value ?? "";
}
