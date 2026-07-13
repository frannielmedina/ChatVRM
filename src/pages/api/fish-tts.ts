import type { NextApiRequest, NextApiResponse } from "next";

// Fish Audio's API does not return CORS headers, so browsers block direct
// fetch() calls to https://api.fish.audio/v1/tts from client-side JS
// (preflight OPTIONS request fails with "CORS Missing Allow Origin").
// This route runs server-side (Node, not a browser), so it isn't subject to
// CORS — it makes the real request to Fish Audio and streams the audio bytes
// straight back to the client.
export const config = {
  api: {
    // We want the raw audio bytes back, not JSON-parsed body handling.
    responseLimit: false,
  },
};

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pcm: "audio/pcm",
  opus: "audio/opus",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { message, apiKey, model, referenceId, format } = req.body as {
    message?: string;
    apiKey?: string;
    model?: string;
    referenceId?: string;
    format?: "mp3" | "wav" | "pcm" | "opus";
  };

  if (!apiKey) {
    res.status(400).json({ error: "Missing Fish Audio API key" });
    return;
  }
  if (!message) {
    res.status(400).json({ error: "Missing text to synthesize" });
    return;
  }

  const outFormat = format || "mp3";

  try {
    const fishRes = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        model: model || "s2.1-pro-free",
      },
      body: JSON.stringify({
        text: message,
        reference_id: referenceId || undefined,
        format: outFormat,
      }),
    });

    if (!fishRes.ok) {
      const errText = await fishRes.text();
      res.status(fishRes.status).json({ error: `Fish Audio error: ${errText}` });
      return;
    }

    const buffer = Buffer.from(await fishRes.arrayBuffer());
    res.status(200);
    res.setHeader("Content-Type", CONTENT_TYPES[outFormat] || "application/octet-stream");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Fish Audio proxy request failed" });
  }
}
