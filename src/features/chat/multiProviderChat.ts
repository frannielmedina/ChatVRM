import { Message } from "../messages/messages";
import { AIProviderConfig } from "./aiProviders";

// ── Token limits per provider (free tier safe values) ─────────────────────────
//
// Groq free tier limits (on-demand):
//   llama-3.1-8b-instant  → 6,000 TPM,  14,400 RPD
//   llama-3.3-70b-versatile → 6,000 TPM, 1,000 RPD
//   llama3-70b-8192       → 6,000 TPM,  14,400 RPD
//   mixtral-8x7b-32768    → 5,000 TPM,  14,400 RPD
//   gemma2-9b-it          → 15,000 TPM, 14,400 RPD
//   qwen/qwen3-32b        → 6,000 TPM  (enable_thinking=false removes <think> blocks)
//
// Strategy: keep output tokens low so input+output stays under the per-minute limit.
// For an average conversation with a short system prompt + 10 history messages,
// input is ~1,500–2,500 tokens.  Leaving 800–1,200 for output keeps total under 4,000.
//
// If you upgrade to Groq Dev tier the limits are much higher; you can raise these.

const MAX_TOKENS_BY_PROVIDER: Partial<Record<string, number>> = {
  groq:       800,   // strict: free tier is only 6k TPM
  mistral:    1200,
  google:     2048,
  openrouter: 1200,
  fireworks:  1200,
  ollama:     2048,  // local — no cloud rate limits
  lmstudio:   2048,  // local — no cloud rate limits
};

const DEFAULT_MAX_TOKENS = 1000;

function getMaxTokens(provider: string): number {
  return MAX_TOKENS_BY_PROVIDER[provider] ?? DEFAULT_MAX_TOKENS;
}

const TEMPERATURE = 0.8;

// ── History truncation ────────────────────────────────────────────────────────
// Keep only the last N user+assistant pairs to avoid 413 (payload too large)
// and to reduce input token count for rate-limited providers.
//
// Groq free tier: 10 pairs ≈ ~1,500–2,000 input tokens (safe under 6k TPM)
// You can raise this for paid tiers.

const MAX_HISTORY_PAIRS_BY_PROVIDER: Partial<Record<string, number>> = {
  groq:       8,   // conservative for free tier
  mistral:    12,
  google:     20,
  openrouter: 12,
  fireworks:  12,
  ollama:     20,
  lmstudio:   20,
};

const DEFAULT_MAX_HISTORY_PAIRS = 10;

/**
 * Truncates the messages array to keep only:
 *   - the system message (always first, always kept)
 *   - the last N user+assistant pairs
 *
 * This prevents 413 errors and reduces input token count.
 */
export function truncateHistory(
  messages: Message[],
  provider: string
): Message[] {
  const maxPairs =
    MAX_HISTORY_PAIRS_BY_PROVIDER[provider] ?? DEFAULT_MAX_HISTORY_PAIRS;

  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  // Each "pair" is one user + one assistant message = 2 messages
  const maxMessages = maxPairs * 2;

  const truncated =
    conversationMessages.length > maxMessages
      ? conversationMessages.slice(-maxMessages)
      : conversationMessages;

  return [...systemMessages, ...truncated];
}

// ── Output sanitisation ───────────────────────────────────────────────────────
//
// Some models pollute their output with:
//   1. <think>...</think> reasoning blocks  (Qwen3, DeepSeek-R1, etc.)
//   2. *asterisk actions*  e.g. *nods*, *maullido*, *winks*
//      These look like stage directions and break the emotion-tag system.
//
// We strip both so only the actual spoken text + our [emotion] tags reach TTS.

/**
 * Removes all <think>…</think> blocks (including partial/streaming ones).
 * Also strips *asterisk-wrapped emotes* that LLMs like to sprinkle in.
 */
export function cleanModelOutput(text: string): string {
  // 1. Remove complete <think>...</think> blocks (possibly multi-line)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // 2. Remove an opening <think> tag that hasn't been closed yet
  //    (can appear mid-stream before the closing tag arrives)
  clean = clean.replace(/<think>[\s\S]*/gi, "");

  // 3. Remove *asterisk actions* — e.g. *nods*, *winks*, *maullido*, *laughs softly*
  //    Match: * + one or more non-asterisk characters + *
  clean = clean.replace(/\*[^*]+\*/g, "");

  // 4. Collapse any runs of blank lines left behind, and trim edges
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

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

/**
 * Returns extra body params for specific models.
 * Qwen3 models support `enable_thinking: false` via Groq, which prevents
 * the model from emitting <think> blocks entirely (saves tokens + avoids
 * having to strip them client-side, though we still strip as a safety net).
 */
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

// ── Google Gemini streaming ───────────────────────────────────────────────────

async function getChatResponseStreamGoogle(
  messages: Message[],
  config: AIProviderConfig
): Promise<ReadableStream> {
  const model = config.model || "gemini-2.0-flash";
  const apiKey = config.apiKey;
  const maxTokens = getMaxTokens(config.provider);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Truncate history before sending
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
      // Buffer for incomplete <think> blocks that span multiple chunks
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
                // Only flush once we can be sure no partial <think> block remains
                const flushed = flushCleanBuffer(thinkBuffer);
                if (flushed.output) controller.enqueue(flushed.output);
                thinkBuffer = flushed.remainder;
              }
            } catch (_) {}
          }
        }
        // Flush any remainder
        if (thinkBuffer) {
          const cleaned = cleanModelOutput(thinkBuffer);
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
  // Truncate history before sending
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
      // Accumulates raw text so we can strip <think> blocks that span chunks
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

        // Flush remaining think buffer
        if (thinkBuffer) {
          const cleaned = cleanModelOutput(thinkBuffer);
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

// ── Streaming think-block filter ──────────────────────────────────────────────
//
// Problem: <think>...</think> blocks arrive in fragments across SSE chunks.
// We must not forward any fragment of a think block to the TTS pipeline.
//
// Strategy:
//   - If the buffer contains a complete <think>...</think> → strip and flush the rest.
//   - If the buffer contains an opening <think> but no closing </think> yet →
//     hold everything from that point in the remainder (don't flush it yet).
//   - Otherwise → the safe prefix (before any pending <think>) can be flushed.

interface FlushResult {
  output: string;    // safe to send downstream (already cleaned)
  remainder: string; // held back — may still contain an incomplete think block
}

function flushCleanBuffer(raw: string): FlushResult {
  // Fast path: no think tag at all
  if (!raw.toLowerCase().includes("<think")) {
    const output = cleanModelOutput(raw);
    return { output, remainder: "" };
  }

  // Strip complete blocks first
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // Check if there's still an unclosed <think>
  const openIdx = cleaned.toLowerCase().lastIndexOf("<think>");
  if (openIdx !== -1) {
    // Hold everything from the opening tag onwards
    const safePrefix = cleaned.slice(0, openIdx);
    const remainder = cleaned.slice(openIdx);
    return {
      output: cleanModelOutput(safePrefix),
      remainder,
    };
  }

  return { output: cleanModelOutput(cleaned), remainder: "" };
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

// Non-streaming fallback (used by the API route for server-side calls)
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
    return { message: cleanModelOutput(raw) };
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
  return { message: cleanModelOutput(raw) };
}
