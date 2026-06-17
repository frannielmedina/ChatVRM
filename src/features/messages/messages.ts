import { VRMExpressionPresetName } from "@pixiv/three-vrm";
import { KoeiroParam } from "../constants/koeiroParam";
import { ALL_POSE_TAGS } from "../emoteController/poseController";

export type Message = {
  role: "assistant" | "system" | "user";
  content: string;
};

const talkStyles = ["talk", "happy", "sad", "angry", "fear", "surprised"] as const;
export type TalkStyle = (typeof talkStyles)[number];

export type Talk = {
  style: TalkStyle;
  speakerX: number;
  speakerY: number;
  message: string;
};

const emotions = ["neutral", "happy", "angry", "sad", "relaxed"] as const;
type EmotionType = (typeof emotions)[number] & VRMExpressionPresetName;

export type Screenplay = {
  expression: EmotionType;
  talk: Talk;
  /** Pose tag to trigger (e.g. "bow", "wave", "shy") — undefined if none */
  pose?: string;
};

// ── Asterisk-action stripper ──────────────────────────────────────────────────
// Removes *action text* patterns so TTS never reads them aloud.
// Examples: *giggles*, *nods*, *winks*, *catches the coin and gasps*
// Also strips standalone asterisks left over.
function stripAsteriskActions(text: string): string {
  // Remove *...* blocks (greedy false so nested * don't merge)
  let clean = text.replace(/\*[^*\r\n]+\*/g, "");
  // Remove any lone asterisks remaining
  clean = clean.replace(/\*/g, "");
  // Collapse extra whitespace that may result
  clean = clean.replace(/\s{2,}/g, " ").trim();
  return clean;
}

// ── Emoji stripper ────────────────────────────────────────────────────────────
// Removes all emoji and pictographic characters so TTS engines never attempt
// to vocalise them (which can cause garbled output, robotic speech, or audio
// glitches with ElevenLabs, Qwen TTS, GPT-SoVITS, etc.).
//
// Captions and the chat log display the ORIGINAL text with emojis preserved —
// only the message sent to the TTS audio pipeline is stripped.
export function stripEmojisForTTS(text: string): string {
  let clean = text
    // Extended pictographic covers virtually all modern emoji (🐾🌸😻🤣❤️ etc.)
    // The optional variation selector \uFE0F and combining enclosing keycap \u20E3
    // are consumed in the same pass to avoid leaving orphan characters behind.
    .replace(/\p{Extended_Pictographic}[\uFE0F\u20E3]?/gu, "")
    // Regional indicator symbols — flag emoji come in pairs (e.g. 🇺🇸)
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    // Variation selectors that may linger after removing the base character
    .replace(/[\uFE00-\uFE0F]/g, "")
    // Zero-width joiner used to compose family / profession emoji sequences
    .replace(/\u200D/g, "")
    // Combining enclosing keycap (e.g. 1️⃣)
    .replace(/\u20E3/g, "")
    // Collapse whitespace runs left by removed emoji
    .replace(/\s{2,}/g, " ")
    .trim();
  return clean;
}

// ── Sentence splitter ─────────────────────────────────────────────────────────
// Splits on Japanese/Chinese/general punctuation.
// For CJK text (no sentence-final punctuation), we buffer the entire response
// and emit it as one segment to avoid word-by-word TTS fragmentation.
export const splitSentence = (text: string): string[] => {
  // Strip asterisk actions from the whole text first
  const cleaned = stripAsteriskActions(text);
  if (!cleaned) return [];

  const splitMessages = cleaned.split(/(?<=[。．！？\n])/g);
  return splitMessages.filter((msg) => msg.trim() !== "");
};

export const textsToScreenplay = (
  texts: string[],
  koeiroParam: KoeiroParam
): Screenplay[] => {
  const screenplays: Screenplay[] = [];
  let prevExpression = "neutral";

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    // Extract ALL bracket tags from the text
    const allTags = [...text.matchAll(/\[([a-zA-Z_]*?)\]/g)].map((m) => m[1]);

    // Split emotion tags from pose tags
    const emotionTag = allTags.find((t) => emotions.includes(t as any));
    const poseTag = allTags.find((t) => ALL_POSE_TAGS.includes(t));

    // Remove bracket tags AND asterisk actions from the spoken text,
    // then also strip emojis so TTS engines receive clean plain text.
    let message = text.replace(/\[[a-zA-Z_]*?\]/g, "").trim();
    message = stripAsteriskActions(message);
    message = stripEmojisForTTS(message);

    let expression = prevExpression;
    if (emotionTag && emotions.includes(emotionTag as any)) {
      expression = emotionTag;
      prevExpression = emotionTag;
    }

    if (!message) continue; // skip if nothing left after stripping

    screenplays.push({
      expression: expression as EmotionType,
      talk: {
        style: emotionToTalkStyle(expression as EmotionType),
        speakerX: koeiroParam.speakerX,
        speakerY: koeiroParam.speakerY,
        message: message,
      },
      pose: poseTag,
    });
  }
  return screenplays;
};

const emotionToTalkStyle = (emotion: EmotionType): TalkStyle => {
  switch (emotion) {
    case "angry":   return "angry";
    case "happy":   return "happy";
    case "sad":     return "sad";
    default:        return "talk";
  }
};
