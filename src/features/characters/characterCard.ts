import { AIProviderConfig, DEFAULT_AI_CONFIG } from "@/features/chat/aiProviders";
import { TTSConfig, DEFAULT_TTS_CONFIG } from "@/features/tts/ttsConfig";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { withEmotionInstructions } from "./emotionPrompt";

export type KnowledgeEntry = { id: string; title: string; content: string };
export type MemoryEntry = {
  id: string;
  text: string;
  createdAt: number;
  source: "manual" | "ai";
};

export type CharacterCard = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  /** Edited from the LLM / TTS tabs while this card is the active one. */
  aiConfig: AIProviderConfig;
  ttsConfig: TTSConfig;
  koeiroParam: KoeiroParam;
  knowledge: KnowledgeEntry[];
  memory: {
    /** Let the LLM write new memories on its own as the conversation goes on. */
    autoGenerate: boolean;
    /** Generate after this many new user messages. */
    autoEvery: number;
    entries: MemoryEntry[];
  };
  /** The model itself lives in IndexedDB under the card id (see vrmStorage). */
  vrm: { source: "default" | "custom"; fileName?: string; version: number };
  createdAt: number;
  updatedAt: number;
};

export type CharacterLibrary = { cards: CharacterCard[]; activeId: string };

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function createCard(partial?: Partial<CharacterCard>): CharacterCard {
  const now = Date.now();
  return {
    id: uid(),
    name: "New Character",
    description: "",
    systemPrompt: SYSTEM_PROMPT,
    aiConfig: { ...DEFAULT_AI_CONFIG },
    ttsConfig: { ...DEFAULT_TTS_CONFIG },
    koeiroParam: { ...DEFAULT_PARAM },
    knowledge: [],
    memory: { autoGenerate: false, autoEvery: 6, entries: [] },
    vrm: { source: "default", version: 0 },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Fills in anything missing so older / hand-edited files never crash the UI. */
export function normalizeCard(raw: any): CharacterCard {
  const base = createCard();
  const card: CharacterCard = {
    ...base,
    ...raw,
    id: typeof raw?.id === "string" && raw.id ? raw.id : base.id,
    aiConfig: { ...DEFAULT_AI_CONFIG, ...(raw?.aiConfig ?? {}) },
    ttsConfig: { ...DEFAULT_TTS_CONFIG, ...(raw?.ttsConfig ?? {}) },
    koeiroParam: { ...DEFAULT_PARAM, ...(raw?.koeiroParam ?? {}) },
    knowledge: Array.isArray(raw?.knowledge) ? raw.knowledge : [],
    memory: {
      ...base.memory,
      ...(raw?.memory ?? {}),
      entries: Array.isArray(raw?.memory?.entries) ? raw.memory.entries : [],
    },
    vrm: { ...base.vrm, ...(raw?.vrm ?? {}) },
  };
  return card;
}

// ── Prompt assembly ───────────────────────────────────────────────────────────
const KNOWLEDGE_CHAR_BUDGET = 6000;
const MEMORY_CHAR_BUDGET = 3000;

const tokenize = (s: string) =>
  new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));

/** Keeps the knowledge base within budget, preferring entries related to what was just said. */
export function selectKnowledge(entries: KnowledgeEntry[], userText: string): KnowledgeEntry[] {
  const total = entries.reduce((n, e) => n + e.title.length + e.content.length, 0);
  if (total <= KNOWLEDGE_CHAR_BUDGET) return entries;
  const q = tokenize(userText);
  const scored = entries
    .map((e, i) => {
      const words = tokenize(`${e.title} ${e.content}`);
      let hits = 0;
      q.forEach((w) => words.has(w) && hits++);
      return { e, i, hits };
    })
    .sort((a, b) => b.hits - a.hits || a.i - b.i);
  const picked: typeof scored = [];
  let used = 0;
  for (const s of scored) {
    const size = s.e.title.length + s.e.content.length;
    if (used + size > KNOWLEDGE_CHAR_BUDGET) continue;
    picked.push(s);
    used += size;
  }
  return picked.sort((a, b) => a.i - b.i).map((s) => s.e);
}

export function buildSystemPrompt(card: CharacterCard, userText = ""): string {
  let prompt = card.systemPrompt.trim();
  if (card.name.trim()) prompt = `Your name is ${card.name.trim()}.\n\n${prompt}`;

  const knowledge = selectKnowledge(card.knowledge, userText);
  if (knowledge.length > 0) {
    prompt +=
      "\n\n## Knowledge base (facts you know; use them when relevant)\n" +
      knowledge.map((k) => `- ${k.title ? k.title + ": " : ""}${k.content}`).join("\n");
  }

  // Newest memories win when over budget.
  const memories: string[] = [];
  let used = 0;
  for (const m of [...card.memory.entries].reverse()) {
    if (used + m.text.length > MEMORY_CHAR_BUDGET) break;
    memories.unshift(m.text);
    used += m.text.length;
  }
  if (memories.length > 0) {
    prompt +=
      "\n\n## Long-term memory (things you remember from earlier conversations)\n" +
      memories.map((t) => `- ${t}`).join("\n");
  }

  return withEmotionInstructions(prompt);
}

// ── Export / import ───────────────────────────────────────────────────────────
// API keys are never written to files, so a shared character card can't leak them.
const SECRET_AI_KEYS = ["apiKey"] as const;
const SECRET_TTS_KEYS = ["koeiromapKey", "elevenLabsKey", "elevenLabsKeys", "fishAudioKey"] as const;

export function stripSecrets(card: CharacterCard): CharacterCard {
  const aiConfig: any = { ...card.aiConfig };
  SECRET_AI_KEYS.forEach((k) => delete aiConfig[k]);
  const ttsConfig: any = { ...card.ttsConfig };
  SECRET_TTS_KEYS.forEach((k) => delete ttsConfig[k]);
  return { ...card, aiConfig, ttsConfig };
}

export type CharacterFile = {
  _type: "chatvrm-character";
  _version: 1;
  _savedAt: string;
  card: CharacterCard;
  /** Present only when "include VRM model" was ticked. */
  vrmData?: string;
};

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> =>
  (await fetch(dataUrl)).blob();

export const safeFileName = (s: string) =>
  s.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "character";
