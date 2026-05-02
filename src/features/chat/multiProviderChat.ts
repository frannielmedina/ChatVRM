import { Message } from "../messages/messages";
import { AIProviderConfig } from "./aiProviders";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TOKENS = 4096;
const TEMPERATURE = 0.8; // Coherent but expressive — not chaotic

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

// ── SSE line parser ───────────────────────────────────────────────────────────
// Extracts the text content from a single "data: {...}" SSE line.
// Returns null if the line should be skipped (DONE, empty, non-data, parse error).
function extractContentFromSSELine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data:")) return null;

  const data = trimmed.slice("data:".length).trim();
  if (!data || data === "[DONE]") return null;

  try {
    const json = JSON.parse(data);
    const piece = json?.choices?.[0]?.delta?.content;
    // piece could be an empty string "" for keep-alive chunks — filter those out
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    contents: chatMsgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
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
              if (text) controller.enqueue(text);
            } catch (_) {}
          }
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
// Groq, Mistral, OpenRouter, Fireworks, Ollama, LMStudio

async function getChatResponseStreamOpenAICompat(
  messages: Message[],
  config: AIProviderConfig
): Promise<ReadableStream> {
  const baseUrl = getBaseUrl(config);
  const url = `${baseUrl}/chat/completions`;
  const model = config.model || "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(config),
    ...getExtraHeaders(config),
  };

  const body: Record<string, unknown> = {
    messages,
    stream: true,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  };

  // model is required for all except lmstudio (uses whatever is loaded)
  if (config.provider !== "lmstudio" || model) {
    body.model = model;
  }

  // NOTE: Do NOT add stream_options for Groq — it causes intermittent failures
  // with smaller models like llama-3.1-8b-instant. Groq streams fine without it.

  // OpenRouter-specific: set a reasonable context window
  if (config.provider === "openrouter") {
    body.max_tokens = MAX_TOKENS;
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
      // Buffer accumulates bytes until we have complete SSE lines
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new decoded text to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process all complete lines (split on \n, keep trailing incomplete line)
          const lines = buffer.split("\n");
          // The last element is either empty (line ended with \n) or an incomplete line
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const piece = extractContentFromSSELine(line);
            if (piece !== null) controller.enqueue(piece);
          }
        }

        // Flush the decoder
        const finalChunk = decoder.decode(undefined, { stream: false });
        if (finalChunk) buffer += finalChunk;

        // Process any remaining complete lines in the buffer
        if (buffer.trim()) {
          // Handle the case where the last chunk didn't end with \n
          for (const line of buffer.split("\n")) {
            const piece = extractContentFromSSELine(line);
            if (piece !== null) controller.enqueue(piece);
          }
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

// Non-streaming fallback (used by the API route for server-side calls)
export async function getChatResponse(
  messages: Message[],
  config: AIProviderConfig
): Promise<{ message: string }> {
  if (config.provider === "google") {
    const model = config.model || "gemini-2.0-flash";
    const apiKey = config.apiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemMsg = messages.find((m) => m.role === "system");
    const chatMsgs = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      contents: chatMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
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
    const message =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "An error occurred.";
    return { message };
  }

  // OpenAI-compatible non-streaming
  const baseUrl = getBaseUrl(config);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(config),
    ...getExtraHeaders(config),
  };

  const body: Record<string, unknown> = {
    messages,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
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
  const message =
    data?.choices?.[0]?.message?.content || "An error occurred.";
  return { message };
}
