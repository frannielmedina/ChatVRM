// Matches emoji-presentation and extended-pictographic characters. Good
// enough heuristic for "did this chat message contain emoji" without
// pulling in a whole emoji-data package.
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

export function extractEmojis(text: string): string[] {
  const matches = text.match(EMOJI_REGEX);
  return matches ?? [];
}
