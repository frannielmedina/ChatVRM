export type PollPredictionDirective = {
  kind: "poll" | "prediction";
  question: string;
  options: string[];
};

function parsePipeList(raw: string): PollPredictionDirective | null {
  const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return null; // question + at least 2 options
  const [question, ...options] = parts;
  return { kind: "poll", question, options }; // kind overwritten by caller
}

// Broadcaster typed "/poll Question? | Option A | Option B" (or /prediction)
// into the local chat box.
export function parseSlashCommand(text: string): PollPredictionDirective | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^\/(poll|prediction)\s+(.+)$/i);
  if (!match) return null;
  const kind = match[1].toLowerCase() as "poll" | "prediction";
  const parsed = parsePipeList(match[2]);
  if (!parsed) return null;
  return { ...parsed, kind };
}

// The AI wrote "[POLL: Question? | Option A | Option B]" (or [PREDICTION: ...])
// somewhere in its reply. Returns the directive plus the text with the tag
// removed, so it isn't spoken aloud verbatim.
export function extractAiDirective(text: string): {
  cleanedText: string;
  directive: PollPredictionDirective | null;
} {
  const match = text.match(/\[(POLL|PREDICTION):\s*([^\]]+)\]/i);
  if (!match) return { cleanedText: text, directive: null };

  const kind = match[1].toLowerCase() as "poll" | "prediction";
  const parsed = parsePipeList(match[2]);
  const cleanedText = text.replace(match[0], "").replace(/\s{2,}/g, " ").trim();

  if (!parsed) return { cleanedText, directive: null };
  return { cleanedText, directive: { ...parsed, kind } };
}
