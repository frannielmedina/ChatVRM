import { ALL_POSE_TAGS } from "../emoteController/poseController";

const EMOTIONS = ["neutral", "happy", "angry", "sad", "relaxed"] as const;
export type EmotionName = (typeof EMOTIONS)[number];

/**
 * Appended to the character's system prompt on every request, so emotion and
 * pose tags work without the user writing them into the prompt (same idea as
 * aicompanion's EXPRESSION_SYSTEM_PROMPT_ADDITION).
 */
export const EMOTION_INSTRUCTIONS = `

## Emotion & pose tags (internal control codes, never spoken)
At the very start of EVERY response, place exactly ONE emotion tag that matches your mood:
[neutral] [happy] [angry] [sad] [relaxed]
You may also add ONE pose tag right after it when it fits naturally:
${ALL_POSE_TAGS.map((t) => `[${t}]`).join(" ")}

Rules:
- Tags go ONCE at the very beginning of the response — never in the middle of sentences.
- After the opening tag(s), write normally with no other square-bracket tags.
- Examples: "[happy] Hello there!"   "[sad] I forgot, sorry about that."   "[happy][wave] Hi! Nice to see you."`;

/** Prompts written for the old version already contain the tags — don't duplicate. */
export function withEmotionInstructions(prompt: string): string {
  if (/\[(happy|sad|angry|relaxed)\]/i.test(prompt)) return prompt;
  return prompt + EMOTION_INSTRUCTIONS;
}

// ── Fallback: infer an emotion when the model forgot the tag ─────────────────
const HAS_EMOTION_TAG = /\[(neutral|happy|angry|sad|relaxed)\]/i;

export function inferEmotion(text: string): EmotionName {
  if (/[😊😄😁😆😂🤣😍🥰😻😸😃🎉✨💖❤]/u.test(text)) return "happy";
  if (/[😢😭😞😔🥺💔😿]/u.test(text)) return "sad";
  if (/[😠😡🤬💢]/u.test(text)) return "angry";
  if (/[😌😴🍵☕🌿]/u.test(text)) return "relaxed";
  if (/\b(haha|hehe|yay|awesome|love it|so happy)\b/i.test(text)) return "happy";
  if (/\b(sorry|unfortunately|miss you|so sad)\b/i.test(text)) return "sad";
  return "neutral";
}

/** Guarantees the response starts with an emotion tag (adds an inferred one if missing). */
export function ensureEmotionTag(text: string): string {
  if (HAS_EMOTION_TAG.test(text)) return text;
  return `[${inferEmotion(text)}] ${text}`;
}
