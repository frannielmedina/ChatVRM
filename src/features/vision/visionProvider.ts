import { VisionConfig } from "./visionConfig";

// ── Screenshot capture ────────────────────────────────────────────────────────

/**
 * Captures a single frame from a MediaStream (screen share) and returns
 * it as a base64 JPEG string (no data: prefix — just the raw base64).
 */
export async function captureFrameFromStream(
  stream: MediaStream,
  quality = 0.6
): Promise<string | null> {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return null;

    // Use ImageCapture API if available (Chrome)
    if (typeof ImageCapture !== "undefined") {
      try {
        const imageCapture = new (ImageCapture as any)(track);
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(bitmap.width, 1280);
        canvas.height = Math.round((bitmap.height * canvas.width) / bitmap.width);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        return dataUrl.split(",")[1]; // strip "data:image/jpeg;base64,"
      } catch {
        // fall through to video element method
      }
    }

    // Fallback: draw the track to a hidden video element → canvas
    const video = document.createElement("video");
    video.srcObject = new MediaStream([track]);
    video.muted = true;
    await video.play();

    // Wait for first frame
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) { resolve(); return; }
      video.addEventListener("canplay", () => resolve(), { once: true });
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.round((video.videoHeight * canvas.width) / video.videoWidth);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.pause();
    video.srcObject = null;

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return dataUrl.split(",")[1];
  } catch (e) {
    console.warn("[vision] captureFrameFromStream failed:", e);
    return null;
  }
}

/**
 * Captures the entire browser viewport via html2canvas-like approach.
 * Used when no stream is available but the page itself can be captured.
 * Falls back to null if not possible.
 */
export async function captureViewport(quality = 0.6): Promise<string | null> {
  try {
    // Try to use getDisplayMedia to capture — this requires a user gesture,
    // so this path only works if the user already granted screen capture.
    return null; // Can't auto-capture without a stream
  } catch {
    return null;
  }
}

// ── Groq Vision API call ──────────────────────────────────────────────────────

export interface VisionResult {
  description: string;
  error?: string;
}

/**
 * Sends a captured frame to Llama 4 Scout via Groq's vision API.
 * Returns a short description of what's happening on screen.
 *
 * The system prompt is injected here so the AI responds IN CHARACTER.
 */
export async function analyzeFrameWithVision(
  base64Image: string,
  characterSystemPrompt: string,
  config: VisionConfig
): Promise<VisionResult> {
  const apiKey = config.groqApiKey;
  if (!apiKey) {
    return { description: "", error: "No Groq API key configured for vision." };
  }

  // Short, punchy prompt that makes the VTuber react to what she sees
  const visionPrompt = `You are watching the streamer's screen right now. Describe briefly (1-2 sentences max) what you see happening — what game/app is open, what's going on. Be casual and in character. Do NOT use emotion tags or pose tags in this specific observation — just the raw text description. Keep it short and natural, like you just glanced at their screen.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 150,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: characterSystemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "low", // "low" = cheaper + faster, good enough for game context
                },
              },
              {
                type: "text",
                text: visionPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[vision] Groq API error:", res.status, err);
      return { description: "", error: `Groq vision error ${res.status}: ${err}` };
    }

    const data = await res.json();
    const description = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return { description };
  } catch (e: any) {
    console.error("[vision] fetch error:", e);
    return { description: "", error: e.message };
  }
}

// ── VDO.Ninja frame capture ───────────────────────────────────────────────────
// VDO.Ninja runs in an iframe so we can't directly access its video element.
// The best we can do is capture the whole page using captureFrameFromStream
// if the user granted screen share permission, or ask them to use Chrome screen share mode.

export function canCaptureVisionFromConfig(
  screenShareMode: "chrome" | "vdoninja",
  stream: MediaStream | null
): boolean {
  if (screenShareMode === "chrome" && stream) {
    const track = stream.getVideoTracks()[0];
    return !!(track && track.readyState === "live");
  }
  // VDO.Ninja iframe — cannot directly capture
  return false;
}
