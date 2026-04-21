import { Message } from "../messages/messages";
import { AIProviderConfig } from "./aiProviders";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBaseUrl(config: AIProviderConfig): string {
  switch (config.provider) {
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "mistral":
      return "https://api.mistral.ai/v1";
    case "google":
      // Google uses its own endpoint format
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
      return {}; // Google uses query param, not header
    case "ollama":
    case "lmstudio":
      return {}; // No auth for local providers
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

// Google uses a completely different request shape
async function getChatResponseStreamGoogle(
  messages: Message[],
  config: AIProviderConfig
): Promise<ReadableStream> {
  const model = config.model || "gemini-2.0-flash";
  const apiKey = config.apiKey;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Convert OpenAI-style messages to Gemini format
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    contents: chatMsgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 300 },
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
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((l) => l.startsWith("data:"));
          for (const line of lines) {
            const data = line.slice("data:".length).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const text =
                json?.candidates?.[0]?.content?.parts?.[0]?.text;
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

// OpenAI-compatible streaming (Groq, Mistral, OpenRouter, Fireworks, Ollama, LMStudio)
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
    max_tokens: 300,
  };

  // model is required for all except lmstudio (uses whatever is loaded)
  if (config.provider !== "lmstudio" || model) {
    body.model = model;
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
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const data = decoder.decode(value);
          const chunks = data
            .split("data:")
            .map((s) => s.trim())
            .filter((s) => s && s !== "[DONE]");
          for (const chunk of chunks) {
            try {
              const json = JSON.parse(chunk);
              const piece = json?.choices?.[0]?.delta?.content;
              if (piece) controller.enqueue(piece);
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
    const message = data?.candidates?.[0]?.content?.parts?.[0]?.text || "An error occurred.";
    return { message };
  }

  // OpenAI-compatible non-streaming
  const baseUrl = getBaseUrl(config);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(config),
    ...getExtraHeaders(config),
  };

  const body: Record<string, unknown> = { messages };
  if (config.provider !== "lmstudio" || config.model) {
    body.model = config.model || "";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const message = data?.choices?.[0]?.message?.content || "An error occurred.";
  return { message };
}
