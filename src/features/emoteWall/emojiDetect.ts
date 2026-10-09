// Pulls displayable emoji out of a chat message.
//
// The old version used a bare /\p{Extended_Pictographic}/ which treats every
// code point separately. That breaks anything built from several code points:
// 👨‍👩‍👧 (ZWJ family), 👍🏽 (skin tone), 🇯🇵 (flags), 1️⃣ (keycaps), ❤️ (VS16).
// Those came out as 2-5 separate (and often wrong) glyphs. We now match whole
// emoji sequences, using Intl.Segmenter when the browser has it and an
// equivalent sequence regex otherwise.

const PICTO = "\\p{Extended_Pictographic}";
const MOD = "\\p{Emoji_Modifier}";
// One pictograph, optional variation selector / skin tone, then any number of ZWJ-joined ones.
const SEQUENCE =
  `(?:${PICTO}(?:\\uFE0F|${MOD})?(?:\\u200D${PICTO}(?:\\uFE0F|${MOD})?)*)`;
const FLAG = "(?:\\p{Regional_Indicator}{2})";
const KEYCAP = "(?:[#*0-9]\\uFE0F?\\u20E3)";
const TAG_FLAG = "(?:\\u{1F3F4}[\\u{E0061}-\\u{E007A}]+\\u{E007F})"; // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 etc.

const EMOJI_SEQUENCE_REGEX = new RegExp(`${TAG_FLAG}|${FLAG}|${KEYCAP}|${SEQUENCE}`, "gu");
const SINGLE_EMOJI_TEST = new RegExp(`^(?:${TAG_FLAG}|${FLAG}|${KEYCAP}|${SEQUENCE})$`, "u");

// © and ® are Extended_Pictographic but are nearly always plain text in chat.
const BARE_TEXT_SYMBOL = /^[\u00A9\u00AE]$/;

export function extractEmojis(text: string): string[] {
  return extractAll(text).filter((e) => !BARE_TEXT_SYMBOL.test(e));
}

function extractAll(text: string): string[] {
  if (!text) return [];

  const Segmenter = (Intl as any)?.Segmenter;
  if (typeof Segmenter === "function") {
    try {
      const out: string[] = [];
      const seg = new Segmenter(undefined, { granularity: "grapheme" });
      for (const { segment } of seg.segment(text) as Iterable<{ segment: string }>) {
        if (SINGLE_EMOJI_TEST.test(segment)) out.push(segment);
      }
      return out;
    } catch {
      /* fall through to the regex path */
    }
  }
  return text.match(EMOJI_SEQUENCE_REGEX) ?? [];
}
