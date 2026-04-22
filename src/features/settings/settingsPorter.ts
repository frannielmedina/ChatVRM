import { AIProviderConfig, DEFAULT_AI_CONFIG } from "@/features/chat/aiProviders";
import { TTSConfig, DEFAULT_TTS_CONFIG } from "@/features/tts/ttsConfig";
import { BackgroundConfig, DEFAULT_BACKGROUND_CONFIG } from "@/features/background/backgroundConfig";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";

export const SETTINGS_FILE_VERSION = "1.0";

/** Everything that gets saved / loaded */
export type SettingsSnapshot = {
  _version: string;
  _savedAt: string;
  systemPrompt: string;
  aiConfig: AIProviderConfig;
  ttsConfig: TTSConfig;
  koeiroParam: KoeiroParam;
  backgroundConfig: Omit<BackgroundConfig, "imageUrl">; // skip large base64 blobs by default
};

export type LoadSettingsResult =
  | { ok: true; snapshot: SettingsSnapshot }
  | { ok: false; error: string };

/** Build a snapshot from current app state */
export function buildSnapshot(params: {
  systemPrompt: string;
  aiConfig: AIProviderConfig;
  ttsConfig: TTSConfig;
  koeiroParam: KoeiroParam;
  backgroundConfig: BackgroundConfig;
}): SettingsSnapshot {
  // Strip the (potentially huge) base64 image URL — user must re-upload on load
  const { imageUrl: _imageUrl, ...bgWithoutImage } = params.backgroundConfig;

  return {
    _version: SETTINGS_FILE_VERSION,
    _savedAt: new Date().toISOString(),
    systemPrompt: params.systemPrompt,
    aiConfig: params.aiConfig,
    ttsConfig: params.ttsConfig,
    koeiroParam: params.koeiroParam,
    backgroundConfig: bgWithoutImage,
  };
}

/** Download snapshot as a .json file */
export function downloadSettings(snapshot: SettingsSnapshot, filename?: string): void {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `chatvrm-settings-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse and validate a JSON string from file */
export function parseSettingsFile(jsonText: string): LoadSettingsResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "File does not contain a settings object." };
  }

  const obj = parsed as Record<string, unknown>;

  // Loose validation — we fill missing keys with defaults
  const snapshot: SettingsSnapshot = {
    _version: (obj._version as string) ?? SETTINGS_FILE_VERSION,
    _savedAt: (obj._savedAt as string) ?? "",
    systemPrompt:
      typeof obj.systemPrompt === "string" ? obj.systemPrompt : SYSTEM_PROMPT,
    aiConfig:
      obj.aiConfig && typeof obj.aiConfig === "object"
        ? { ...DEFAULT_AI_CONFIG, ...(obj.aiConfig as Partial<AIProviderConfig>) }
        : DEFAULT_AI_CONFIG,
    ttsConfig:
      obj.ttsConfig && typeof obj.ttsConfig === "object"
        ? { ...DEFAULT_TTS_CONFIG, ...(obj.ttsConfig as Partial<TTSConfig>) }
        : DEFAULT_TTS_CONFIG,
    koeiroParam:
      obj.koeiroParam && typeof obj.koeiroParam === "object"
        ? { ...DEFAULT_PARAM, ...(obj.koeiroParam as Partial<KoeiroParam>) }
        : DEFAULT_PARAM,
    backgroundConfig:
      obj.backgroundConfig && typeof obj.backgroundConfig === "object"
        ? {
            ...DEFAULT_BACKGROUND_CONFIG,
            ...(obj.backgroundConfig as Partial<BackgroundConfig>),
            imageUrl: "", // always clear — images aren't saved in the file
          }
        : DEFAULT_BACKGROUND_CONFIG,
  };

  return { ok: true, snapshot };
}

/** Read a File object and parse it */
export async function loadSettingsFromFile(
  file: File
): Promise<LoadSettingsResult> {
  return new Promise((resolve) => {
    if (!file.name.endsWith(".json")) {
      resolve({ ok: false, error: "Please select a .json settings file." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(parseSettingsFile(text));
    };
    reader.onerror = () =>
      resolve({ ok: false, error: "Could not read the file." });
    reader.readAsText(file);
  });
}
