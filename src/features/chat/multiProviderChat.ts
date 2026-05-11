import { Message } from "../messages/messages";
import { AIProviderConfig } from "./aiProviders";

// ── Token limits per provider (free tier safe values) ─────────────────────────
const MAX_TOKENS_BY_PROVIDER: Partial<Record<string, number>> = {
  groq:       800,
  mistral:    1200,
  google:     2048,
  openrouter: 1200,
  fireworks:  1200,
  ollama:     2048,
  lmstudio:   2048,
};

const DEFAULT_MAX_TOKENS = 1000;

function getMaxTokens(provider: string): number {
  return MAX_TOKENS_BY_PROVIDER[provider] ?? DEFAULT_MAX_TOKENS;
}

const TEMPERATURE = 0.8;

// ── History truncation ────────────────────────────────────────────────────────
const MAX_HISTORY_PAIRS_BY_PROVIDER: Partial<Record<string, number>> = {
  groq:       8,
  mistral:    12,
  google:     20,
  openrouter: 12,
  fireworks:  12,
  ollama:     20,
  lmstudio:   20,
};

const DEFAULT_MAX_HISTORY_PAIRS = 10;

export function truncateHistory(
  messages: Message[],
  provider: string
): Message[] {
  const maxPairs =
    MAX_HISTORY_PAIRS_BY_PROVIDER[provider] ?? DEFAULT_MAX_HISTORY_PAIRS;

  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const maxMessages = maxPairs * 2;

  const truncated =
    conversationMessages.length > maxMessages
      ? conversationMessages.slice(-maxMessages)
      : conversationMessages;

  return [...systemMessages, ...truncated];
}

// ── Output sanitisation ───────────────────────────────────────────────────────

/**
 * Removes <think>…</think> blocks and *asterisk emotes*.
 * NOTE: Does NOT call .trim() — preserving leading/trailing spaces is
 * intentional so streamed chunks concatenate correctly with spaces intact.
 */
export function cleanModelOutput(text: string): string {
  // 1. Remove complete <think>...</think> blocks (possibly multi-line)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // 2. Remove an opening <think> tag that hasn't been closed yet
  clean = clean.replace(/<think>[\s\S]*/gi, "");

  // 3. Remove *asterisk actions*
  clean = clean.replace(/\*[^*]+\*/g, "");

  // 4. Collapse runs of 3+ blank lines (but do NOT trim edges — preserves spaces)
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBaseUrl(config: AIProviderConfig): string {
  switch (config.provider) {
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "mistral":
      return "https://api.mistral.ai/v1";
    case "google":
      return "https://generativelanguage.googleapis.com/v1beta";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "fireworks":
      return "https://api.fireworks.ai/inference/v1";
    case "ollama":
      return (config.baseUrl?.replace(/\/$/, "") || "http://localhost:11434") + "/v1";
    case "lmstudio":
      return (config.baseUrl?.replace(/\/$/, "") || "http://localhost:1234") + "/v1";
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

function getAuthHeader(config: AIProviderConfig): Record<string, string> {
  switch (config.provider) {
    case "google":
    case "ollama":
    case "lmstudio":
      return {};
    default:
      return { Authorization: `Bearer ${config.apiKey}` };
  }
}

function getExtraHeaders(config: AIProviderConfig): Record<string, string> {
  if (config.provider === "openrouter") {
    return {
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "ChatVRM",
    };
  }
  return {};
}

function getExtraBodyParams(config: AIProviderConfig): Record<string, unknown> {
  const model = config.model ?? "";
  if (
    config.provider === "groq" &&
    (model.includes("qwen3") || model.includes("qwen/qwen3"))
  ) {
    return { enable_thinking: false };
  }
  return {};
}

// ── SSE line parser ───────────────────────────────────────────────────────────
function extractContentFromSSELine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data:")) return null;

  const data = trimmed.slice("data:".length).trim();
  if (!data || data === "[DONE]") return null;

  try {
    const json = JSON.parse(data);
    const piece = json?.choices?.[0]?.delta?.content;
    return typeof piece === "string" && piece.length > 0 ? piece : null;
  } catch (_) {
    return null;
  }
}

// ── Streaming think-block filter ──────────────────────────────────────────────
//
// Strategy:
//   - Strip all complete <think>...</think> blocks from the buffer.
//   - If an *unclosed* <think> remains, hold everything from that tag onward.
//   - Flush the safe prefix downstream WITHOUT trimming it, so spaces survive.

interface FlushResult {
  output: string;    // safe to send downstream
  remainder: string; // held back — may contain an incomplete think block
}

function flushCleanBuffer(raw: string): FlushResult {
  // Fast path: no think tag at all — just clean and forward, no trim
  if (!raw.toLowerCase().includes("<think")) {
    return { output: cleanModelOutput(raw), remainder: "" };
  }

  // Strip complete blocks first
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // Check if there is still an *unclosed* <think> in the cleaned string.
  // Use case-insensitive search on the cleaned string.
  const lowerCleaned = cleaned.toLowerCase();
  const openIdx = lowerCleaned.lastIndexOf("<think>");

  if (openIdx !== -1) {
    // Verify there is no matching </think> after this opening tag.
    const closeIdx = lowerCleaned.indexOf("</think>", openIdx);
    if (closeIdx === -1) {
      // Truly unclosed — hold everything from the opening tag onwards.
      const safePrefix = cleaned.slice(0, openIdx);
      const remainder = cleaned.slice(openIdx);
      // Clean the safe prefix but do NOT trim — preserve trailing spaces.
      return {
        output: cleanModelOutput(safePrefix),
        remainder,               // remainder will be re-evaluated next chunk
      };
    }
  }

  // No unclosed think block — clean and forward everything.
  return { output: cleanModelOutput(cleaned), remainder: "" };
}

// ── Google Gemini streaming ───────────────────────────────────────────────────

async function getChatResponseStreamGoogle(
  messages: Message[],
  config: AIProviderConfig
): Promise<ReadableStream> {
  const model = config.model || "gemini-2.0-flash";
  const apiKey = config.apiKey;
  const maxTokens = getMaxTokens(config.provider);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const truncated = truncateHistory(messages, config.provider);

  const systemMsg = truncated.find((m) => m.role === "system");
  const chatMsgs = truncated.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    contents: chatMsgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: TEMPERATURE,
    },
  };

  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`Google AI error ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();

  return new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder("utf-8");
      let thinkBuffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.startsWith("data:"));
          for (const line of lines) {
            const data = line.slice("data:".length).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                thinkBuffer += text;
                const flushed = flushCleanBuffer(thinkBuffer);
                if (flushed.output) controller.enqueue(flushed.output);
                thinkBuffer = flushed.remainder;
              }
            } catch (_) {}
          }
        }
        // Flush any remainder — strip any dangling <think> tag
        if (thinkBuffer) {
          const cleaned = cleanModelOutput(thinkBuffer).trim();
          if (cleaned) controller.enqueue(cleaned);
        }
      } catch (e) {
        controller.error(e);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

// ── OpenAI-compatible streaming ───────────────────────────────────────────────

async function getChatResponseStreamOpenAICompat(
  messages: Message[],
  config: AIProviderConfig
): Promise<ReadableStream> {
  const truncated = truncateHistory(messages, config.provider);

  const baseUrl = getBaseUrl(config);
  const url = `${baseUrl}/chat/completions`;
  const model = config.model || "";
  const maxTokens = getMaxTokens(config.provider);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(config),
    ...getExtraHeaders(config),
  };

  const body: Record<string, unknown> = {
    messages: truncated,
    stream: true,
    max_tokens: maxTokens,
    temperature: TEMPERATURE,
    ...getExtraBodyParams(config),
  };

  if (config.provider !== "lmstudio" || model) {
    body.model = model;
  }

  if (config.provider === "openrouter") {
    body.max_tokens = maxTokens;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`${config.provider} error ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();

  return new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let thinkBuffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const piece = extractContentFromSSELine(line);
            if (piece !== null) {
              thinkBuffer += piece;
              const flushed = flushCleanBuffer(thinkBuffer);
              if (flushed.output) controller.enqueue(flushed.output);
              thinkBuffer = flushed.remainder;
            }
          }
        }

        // Drain the SSE buffer
        const finalChunk = decoder.decode(undefined, { stream: false });
        if (finalChunk) buffer += finalChunk;

        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            const piece = extractContentFromSSELine(line);
            if (piece !== null) {
              thinkBuffer += piece;
            }
          }
        }

        // Flush remaining think buffer — trim only at the very end
        if (thinkBuffer) {
          const cleaned = cleanModelOutput(thinkBuffer).trim();
          if (cleaned) controller.enqueue(cleaned);
        }
      } catch (e) {
        controller.error(e);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getChatResponseStream(
  messages: Message[],
  config: AIProviderConfig
): Promise<ReadableStream> {
  if (config.provider === "google") {
    return getChatResponseStreamGoogle(messages, config);
  }
  return getChatResponseStreamOpenAICompat(messages, config);
}

// Non-streaming fallback
export async function getChatResponse(
  messages: Message[],
  config: AIProviderConfig
): Promise<{ message: string }> {
  const truncated = truncateHistory(messages, config.provider);
  const maxTokens = getMaxTokens(config.provider);

  if (config.provider === "google") {
    const model = config.model || "gemini-2.0-flash";
    const apiKey = config.apiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemMsg = truncated.find((m) => m.role === "system");
    const chatMsgs = truncated.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      contents: chatMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: TEMPERATURE,
      },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "An error occurred.";
    return { message: cleanModelOutput(raw).trim() };
  }

  // OpenAI-compatible non-streaming
  const baseUrl = getBaseUrl(config);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(config),
    ...getExtraHeaders(config),
  };

  const body: Record<string, unknown> = {
    messages: truncated,
    max_tokens: maxTokens,
    temperature: TEMPERATURE,
    ...getExtraBodyParams(config),
  };
  if (config.provider !== "lmstudio" || config.model) {
    body.model = config.model || "";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "An error occurred.";
  return { message: cleanModelOutput(raw).trim() };
}
