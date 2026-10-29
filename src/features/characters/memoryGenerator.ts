import { Message } from "@/features/messages/messages";
import { getChatResponseStream } from "@/features/chat/multiProviderChat";
import { AIProviderConfig } from "@/features/chat/aiProviders";
import { CharacterCard, MemoryEntry, uid } from "./characterCard";

const MAX_TRANSCRIPT_MESSAGES = 24;
const MAX_NEW_MEMORIES = 5;

const stripTags = (s: string) =>
  s.replace(/\[[a-zA-Z_ ]+?\]/g, "").replace(/\s{2,}/g, " ").trim();

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function isDuplicate(candidate: string, existing: string[]): boolean {
  const c = normalize(candidate);
  return existing.some((e) => {
    const n = normalize(e);
    return n === c || n.includes(c) || c.includes(n);
  });
}

/** Pulls a JSON string array out of an LLM reply, falling back to "- bullet" lines. */
export function parseMemoryList(raw: string): string[] {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(arr)) {
        return arr.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean);
      }
    } catch {
      /* fall through to bullets */
    }
  }
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 3 && !l.startsWith("[") && !l.startsWith("{"));
}

async function collect(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  let out = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) out += value;
    }
  } finally {
    reader.releaseLock();
  }
  return out;
}

export type MemoryGenResult =
  | { ok: true; added: MemoryEntry[] }
  | { ok: false; error: string };

/**
 * Asks the card's LLM to extract durable facts from the recent conversation.
 * Returns only entries that aren't already in the card's memory.
 */
export async function generateMemories(
  card: CharacterCard,
  chatLog: Message[],
  aiConfig: AIProviderConfig
): Promise<MemoryGenResult> {
  const transcript = chatLog
    .filter((m) => m.role !== "system")
    .slice(-MAX_TRANSCRIPT_MESSAGES)
    .map((m) => `${m.role === "user" ? "User" : card.name || "Character"}: ${stripTags(m.content)}`)
    .join("\n");

  if (!transcript.trim()) return { ok: false, error: "There's no conversation to remember yet." };

  const existing = card.memory.entries.map((e) => e.text);
  const system =
    `You maintain the long-term memory of the character "${card.name || "Character"}". ` +
    `Read the conversation and extract durable facts worth remembering later: the user's name, ` +
    `preferences, plans, promises, important events, running jokes, relationship details. ` +
    `Ignore small talk and anything already remembered.\n\n` +
    `Reply with ONLY a JSON array of at most ${MAX_NEW_MEMORIES} short, self-contained sentences ` +
    `(e.g. ["The user's favourite game is Sonic 3.", "The user streams on Twitch."]). ` +
    `Return [] if there is nothing new worth remembering. No commentary, no tags.`;

  const user =
    (existing.length ? `Already remembered:\n${existing.map((t) => `- ${t}`).join("\n")}\n\n` : "") +
    `Conversation:\n${transcript}`;

  try {
    const stream = await getChatResponseStream(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      aiConfig
    );
    const raw = await collect(stream);
    const fresh: string[] = [];
    for (const t of parseMemoryList(raw)) {
      if (!isDuplicate(t, [...existing, ...fresh])) fresh.push(t);
      if (fresh.length >= MAX_NEW_MEMORIES) break;
    }
    const now = Date.now();
    return {
      ok: true,
      added: fresh.map((text) => ({ id: uid(), text, createdAt: now, source: "ai" as const })),
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "The LLM request failed." };
  }
}
