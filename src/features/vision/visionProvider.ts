import { VisionConfig } from "./visionConfig";

// ── Screenshot capture from MediaStream ───────────────────────────────────────

/**
 * Captures a single frame from a MediaStream (Chrome screen share) and returns
 * it as a base64 JPEG string (no data: prefix).
 */
export async function captureFrameFromStream(
  stream: MediaStream,
  quality = 0.6
): Promise<string | null> {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return null;

    // Use ImageCapture API if available (Chrome)
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
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        return dataUrl.split(",")[1];
      } catch {
        // fall through to video element method
      }
    }

    // Fallback: draw the track to a hidden video element → canvas
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

// ── Screenshot capture from VDO.Ninja iframe ──────────────────────────────────

/**
 * Captures a frame from the VDO.Ninja background iframe by finding the
 * <video> element inside it (same-origin limitation bypassed by directly
 * accessing the video element the iframe's ScreenShareBackground component
 * renders) OR by using a canvas draw of the iframe itself.
 *
 * Strategy:
 *  1. Try to find any <video> element in the page that has active video
 *     (srcObject or src set and playing). VDO.Ninja in an iframe renders
 *     <video> tags that ARE accessible if the iframe is same-site.
 *  2. Fallback: use html2canvas on the document body (captures what's
 *     rendered on screen including cross-origin iframes at compositor level).
 *
 * Note: Cross-origin iframes cannot be read via canvas (tainted). For
 * VDO.Ninja (vdo.ninja domain) we rely on the MediaStream approach:
 * we find the HTMLVideoElement that VDO.Ninja injects and grab a frame.
 */
export async function captureFrameFromVideoElement(quality = 0.65): Promise<string | null> {
  try {
    // Strategy 1: find any playing <video> element on the page
    // (VDO.Ninja inside an iframe won't be accessible, but our own
    //  ScreenShareBackground <video> element for chrome mode would be — 
    //  for vdo.ninja the iframe is cross-origin so we use strategy 2)
    const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
    const playing = videos.find(
      (v) => !v.paused && v.videoWidth > 0 && v.videoHeight > 0
    );

    if (playing) {
      return captureFromHTMLVideoElement(playing, quality);
    }

    // Strategy 2: Use getDisplayMedia on the current tab (requires user
    // gesture the first time — not suitable for auto-capture).
    // Instead, fall back to a screenshot of the visible viewport using
    // the Screen Capture API if available.

    // Strategy 3: Try to access the iframe's contentDocument video
    const iframes = Array.from(document.querySelectorAll("iframe")) as HTMLIFrameElement[];
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) continue;
        const iframeVideos = Array.from(iframeDoc.querySelectorAll("video")) as HTMLVideoElement[];
        const iframePlaying = iframeVideos.find(
          (v) => !v.paused && v.videoWidth > 0
        );
        if (iframePlaying) {
          return captureFromHTMLVideoElement(iframePlaying, quality);
        }
      } catch {
        // Cross-origin — skip
      }
    }

    console.warn("[vision] No playing video element found for VDO.Ninja capture.");
    return null;
  } catch (e) {
    console.warn("[vision] captureFrameFromVideoElement failed:", e);
    return null;
  }
}

function captureFromHTMLVideoElement(video: HTMLVideoElement, quality: number): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width  = Math.min(video.videoWidth, 1280);
    canvas.height = Math.round((video.videoHeight * canvas.width) / video.videoWidth);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    // If the canvas is tainted (cross-origin), toDataURL throws
    return dataUrl.split(",")[1];
  } catch (e) {
    console.warn("[vision] canvas tainted or draw failed:", e);
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
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "low",
                },
              },
              { type: "text", text: visionPrompt },
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

// ── Capability check ──────────────────────────────────────────────────────────

/**
 * Returns true if vision capture is possible given the current mode/stream.
 * VDO.Ninja is now supported (we attempt video element capture).
 */
export function canCaptureVisionFromConfig(
  screenShareMode: "chrome" | "vdoninja",
  stream: MediaStream | null
): boolean {
  if (screenShareMode === "chrome") {
    const track = stream?.getVideoTracks()[0];
    return !!(track && track.readyState === "live");
  }
  // VDO.Ninja: we'll attempt capture; might fail if cross-origin, but we try
  return screenShareMode === "vdoninja";
}
