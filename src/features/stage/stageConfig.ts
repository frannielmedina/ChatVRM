// "Stage size": lock the whole scene (model, background, captions, overlays,
// emote wall…) to an exact pixel size, independent of how big the browser
// window is. Everything is laid out at that size and scaled down to fit if
// the window is smaller, so what you capture / stream is always identical.

export type StageSizeId = "free" | "1920x1080" | "1280x720" | "960x540" | "854x480";

export const STAGE_SIZES: { id: StageSizeId; label: string; w: number; h: number }[] = [
  { id: "free", label: "Free (fill window)", w: 0, h: 0 },
  { id: "1920x1080", label: "1920 × 1080", w: 1920, h: 1080 },
  { id: "1280x720", label: "1280 × 720", w: 1280, h: 720 },
  { id: "960x540", label: "960 × 540", w: 960, h: 540 },
  { id: "854x480", label: "854 × 480", w: 854, h: 480 },
];

export const DEFAULT_STAGE_SIZE: StageSizeId = "free";
export const STAGE_ELEMENT_ID = "chatvrm-stage";

export function parseStageSize(id: StageSizeId): { w: number; h: number } | null {
  const s = STAGE_SIZES.find((x) => x.id === id);
  return s && s.w > 0 ? { w: s.w, h: s.h } : null;
}

/**
 * Try to resize the actual browser window so its viewport matches w×h.
 * Browsers only allow this for windows opened by a script (e.g. the
 * "Open as window" streamer button) — normal tabs ignore it. Returns whether it worked.
 */
export async function resizeWindowTo(w: number, h: number): Promise<boolean> {
  try {
    const extraW = window.outerWidth - window.innerWidth;
    const extraH = window.outerHeight - window.innerHeight;
    window.resizeTo(w + extraW, h + extraH);
    await new Promise((r) => setTimeout(r, 300));
    return Math.abs(window.innerWidth - w) <= 2 && Math.abs(window.innerHeight - h) <= 2;
  } catch {
    return false;
  }
}
