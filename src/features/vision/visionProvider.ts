import { VisionConfig } from "./visionConfig";

// ── Cached display capture stream for VDO.Ninja vision ───────────────────────
// We keep a single long-lived stream so we don't prompt the user every capture.
let _visionDisplayStream: MediaStream | null = null;

/**
 * Returns a cached display capture stream for vision purposes.
 * Prompts the user once to share the current tab; subsequent calls reuse it.
 */
async function getVisionDisplayStream(): Promise<MediaStream | null> {
  // Reuse if still live
  if (_visionDisplayStream) {
    const track = _visionDisplayStream.getVideoTracks()[0];
    if (track && track.readyState === "live") return _visionDisplayStream;
    _visionDisplayStream = null;
  }

  try {
    const stream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: { frameRate: 5, width: { ideal: 1280 } },
      audio: false,
    });
    _visionDisplayStream = stream;
    // Auto-clear when the user stops sharing
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      _visionDisplayStream = null;
    });
    return stream;
  } catch (e) {
    console.warn("[vision] getDisplayMedia for VDO.Ninja capture failed:", e);
    return null;
  }
}

/** Call this when screen share stops to clean up the vision stream too. */
export function releaseVisionDisplayStream() {
  if (_visionDisplayStream) {
    _visionDisplayStream.getTracks().forEach((t) => t.stop());
    _visionDisplayStream = null;
  }
}

// ── Screenshot capture from MediaStream (Chrome screen share) ─────────────────

export async function captureFrameFromStream(
  stream: MediaStream,
  quality = 0.6
): Promise<string | null> {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return null;

    const ImageCaptureAPI = (window as any).ImageCapture;
    if (typeof ImageCaptureAPI !== "undefined") {
      try {
        const imageCapture = new ImageCaptureAPI(track);
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(bitmap.width, 1280);
        canvas.height = Math.round((bitmap.height * canvas.width) / bitmap.width);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", quality).split(",")[1];
      } catch { /* fall through */ }
    }

    // Fallback: video element → canvas
    const video = document.createElement("video");
    video.srcObject = new MediaStream([track]);
    video.muted = true;
    await video.play();
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) { resolve(); return; }
      video.addEventListener("canplay", () => resolve(), { once: true });
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.round((video.videoHeight * canvas.width) / video.videoWidth);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.pause();
    video.srcObject = null;
    return canvas.toDataURL("image/jpeg", quality).split(",")[1];
  } catch (e) {
    console.warn("[vision] captureFrameFromStream failed:", e);
    return null;
  }
}

// ── Screenshot capture for VDO.Ninja ─────────────────────────────────────────
// VDO.Ninja runs in a cross-origin iframe so canvas is tainted.
// Solution: capture the current TAB with getDisplayMedia (user picks "This Tab"
// once; the stream is cached and reused for all subsequent captures).

export async function captureFrameFromVideoElement(quality = 0.65): Promise<string | null> {
  // First try any same-origin <video> element already on the page
  const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
  const playing = videos.find((v) => !v.paused && v.videoWidth > 0 && v.videoHeight > 0);
  if (playing) {
    const result = captureFromHTMLVideoElement(playing, quality);
    if (result) return result;
  }

  // Fall back to capturing the whole tab via getDisplayMedia
  const displayStream = await getVisionDisplayStream();
  if (!displayStream) return null;
  return captureFrameFromStream(displayStream, quality);
}

function captureFromHTMLVideoElement(video: HTMLVideoElement, quality: number): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width  = Math.min(video.videoWidth, 1280);
    canvas.height = Math.round((video.videoHeight * canvas.width) / video.videoWidth);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality).split(",")[1];
  } catch {
    return null; // canvas tainted (cross-origin)
  }
}

// ── Groq Vision API call ───────────────────────────────────────────────────────

export interface VisionResult {
  description: string;
  error?: string;
}

export async function analyzeFrameWithVision(
  base64Image: string,
  characterSystemPrompt: string,
  config: VisionConfig
): Promise<VisionResult> {
  const apiKey = config.groqApiKey;
  if (!apiKey) {
    return { description: "", error: "No Groq API key configured for vision." };
  }

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
          { role: "system", content: characterSystemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" },
              },
              { type: "text", text: visionPrompt },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { description: "", error: `Groq vision error ${res.status}: ${err}` };
    }

    const data = await res.json();
    return { description: data?.choices?.[0]?.message?.content?.trim() ?? "" };
  } catch (e: any) {
    return { description: "", error: e.message };
  }
}

// ── Capability check ───────────────────────────────────────────────────────────

export function canCaptureVisionFromConfig(
  screenShareMode: "chrome" | "vdoninja",
  stream: MediaStream | null
): boolean {
  if (screenShareMode === "chrome") {
    const track = stream?.getVideoTracks()[0];
    return !!(track && track.readyState === "live");
  }
  return screenShareMode === "vdoninja"; // will use getDisplayMedia
}
