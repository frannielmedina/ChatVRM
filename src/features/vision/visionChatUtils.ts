// Vision observation messages use a special prefix [vision_observation]
// They are injected as user messages and the AI responds in character.
// Twitch messages use [Twitch chat] prefix and NEVER include images.
// Regular user messages are plain text.
//
// The vision analysis itself is handled entirely in visionProvider.ts
// via a SEPARATE Groq API call to llama-4-scout-17b-16e-instruct.
// That call returns a plain text description, which is then fed into
// the normal chat flow below as a special user message.

export const VISION_OBSERVATION_PREFIX = "[vision_observation]";
export const TWITCH_MESSAGE_PREFIX = "[Twitch chat]";

/**
 * Returns true if this message is a vision observation (not Twitch chat,
 * not a regular user message). Used to set the right context.
 */
export function isVisionObservation(text: string): boolean {
  return text.startsWith(VISION_OBSERVATION_PREFIX);
}

/**
 * Returns true if this is a Twitch chat message. Twitch messages never
 * include vision context — they're processed by the regular text model.
 */
export function isTwitchMessage(text: string): boolean {
  return text.startsWith(TWITCH_MESSAGE_PREFIX);
}

/**
 * Strips the vision or twitch prefix from a message for clean display
 * in the chat log.
 */
export function stripMessagePrefix(text: string): string {
  return text
    .replace(VISION_OBSERVATION_PREFIX, "")
    .replace(TWITCH_MESSAGE_PREFIX, "")
    .trim();
}
