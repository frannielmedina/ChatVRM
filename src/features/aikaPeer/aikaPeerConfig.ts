// ── Aika collab (AIVTL peer protocol) configuration ──────────────────────────
// The token is a password. It lives ONLY in this browser's localStorage —
// never hard-code it, never commit it, never put it in a widget URL.

export type AikaMood =
  | "happy" | "sad" | "angry" | "surprised" | "embarrassed" | "mischievous"
  | "smug" | "pout" | "shy" | "excited" | "nervous" | "sleepy" | "neutral";

export type AikaPeerConfig = {
  token: string;
  /** Dry-run connection (?test=1): nothing reaches Aika's stream. KEEP ON until Samy agrees a live session. */
  testMode: boolean;
  /** Knock automatically (ai_talk_start) whenever Aika has budget (ai_talk_ready). */
  autoSession: boolean;
  serverUrl: string;
  /** Public URL of Miko's .vrm (Aika's OBS can't read your local files). Empty = bundled sample. */
  vrmUrl: string;
  /** Also play Miko's voice in THIS tab (monitoring). Off = only the widget plays it. */
  monitorLocally: boolean;
};

export const AIKA_PEER_STORAGE_KEY = "chatVRM_aikaPeer_v1";

export const DEFAULT_AIKA_PEER_CONFIG: AikaPeerConfig = {
  token: "",
  testMode: true,
  autoSession: false,
  serverUrl: "wss://aika-core.samyserver.de/api/peer/ws",
  vrmUrl: "",
  monitorLocally: false,
};

export function loadAikaPeerConfig(): AikaPeerConfig {
  if (typeof window === "undefined") return DEFAULT_AIKA_PEER_CONFIG;
  try {
    const raw = window.localStorage.getItem(AIKA_PEER_STORAGE_KEY);
    return raw ? { ...DEFAULT_AIKA_PEER_CONFIG, ...JSON.parse(raw) } : DEFAULT_AIKA_PEER_CONFIG;
  } catch {
    return DEFAULT_AIKA_PEER_CONFIG;
  }
}

export function saveAikaPeerConfig(c: AikaPeerConfig) {
  try {
    window.localStorage.setItem(AIKA_PEER_STORAGE_KEY, JSON.stringify(c));
  } catch {}
}

/** Miko's emotion tag → the closest Aika mood. */
export function emotionToAikaMood(expression: string): AikaMood {
  switch (expression) {
    case "happy": return "happy";
    case "sad": return "sad";
    case "angry": return "angry";
    case "surprised": return "surprised";
    case "relaxed": return "smug";
    default: return "neutral";
  }
}

/** Aika's mood → Miko's expression + talk style. */
export function aikaMoodToExpression(mood?: string): "neutral" | "happy" | "angry" | "sad" | "relaxed" {
  switch (mood) {
    case "happy": case "excited": case "mischievous": return "happy";
    case "sad": case "nervous": return "sad";
    case "angry": case "pout": return "angry";
    case "smug": case "shy": case "sleepy": return "relaxed";
    default: return "neutral";
  }
}
