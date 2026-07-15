import type { NextApiRequest, NextApiResponse } from "next";

// Proxies text-to-speech requests to Fish Audio's API. This has to live on
// the server because Fish Audio's /v1/tts endpoint doesn't send CORS
// headers, so browsers block calling it directly from client-side code.
// The API key is forwarded straight through to Fish Audio and is not
// stored anywhere on this server.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { text, apiKey, model, referenceId, format } = req.body as {
    text?: string;
    apiKey?: string;
    model?: string;
    referenceId?: string;
    format?: "mp3" | "wav" | "pcm" | "opus";
  };

  if (!text) {
    res.status(400).json({ error: "Missing text" });
    return;
  }
  if (!apiKey) {
    res.status(400).json({ error: "Missing Fish Audio API key" });
    return;
  }

  try {
    const fishRes = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // Fish Audio expects the model id as a header, not a body field
        model: model || "s2.1-pro-free",
      },
      body: JSON.stringify({
        text,
        reference_id: referenceId || undefined,
        format: format || "mp3",
        normalize: true,
        latency: "normal",
      }),
    });

    if (!fishRes.ok) {
      const errText = await fishRes.text();
      res
        .status(fishRes.status)
        .json({ error: `Fish Audio error: ${fishRes.status} — ${errText}` });
      return;
    }

    const audioBuffer = Buffer.from(await fishRes.arrayBuffer());
    const contentType =
      fishRes.headers.get("content-type") ||
      (format === "wav"
        ? "audio/wav"
        : format === "pcm"
        ? "audio/pcm"
        : format === "opus"
        ? "audio/opus"
        : "audio/mpeg");

    res.status(200);
    res.setHeader("Content-Type", contentType);
    res.send(audioBuffer);
  } catch (err: any) {
    res.status(500).json({ error: `Fish Audio proxy error: ${err.message}` });
  }
}
