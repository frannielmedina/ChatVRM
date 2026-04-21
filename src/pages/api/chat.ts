/**
 * /api/chat is kept as a thin server-side fallback.
 * The main chat flow now calls providers directly from the browser
 * via src/features/chat/multiProviderChat.ts.
 *
 * This route can be used for server-side integrations (e.g. Twitch bots)
 * where you want to keep the API key server-side.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getChatResponse } from "@/features/chat/multiProviderChat";
import { AIProviderConfig, DEFAULT_AI_CONFIG } from "@/features/chat/aiProviders";

type Data = { message: string } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, aiConfig } = req.body as {
    messages: { role: string; content: string }[];
    aiConfig?: AIProviderConfig;
  };

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const config: AIProviderConfig = aiConfig
    ? { ...DEFAULT_AI_CONFIG, ...aiConfig }
    : {
        provider: "groq",
        apiKey: process.env.GROQ_API_KEY || "",
        model: "llama-3.3-70b-versatile",
      };

  try {
    const result = await getChatResponse(messages as any, config);
    res.status(200).json(result);
  } catch (e: any) {
    console.error("[/api/chat] Error:", e);
    res.status(500).json({ error: e.message || "Unknown error" });
  }
}
