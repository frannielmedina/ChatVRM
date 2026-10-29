import { loadVRMAnimation } from "@/lib/VRMAnimation/loadVRMAnimation";
import { VRMAnimation } from "@/lib/VRMAnimation/VRMAnimation";
import { buildUrl } from "@/utils/buildUrl";

// ── VRMA tag → file mapping ───────────────────────────────────────────────────
// Each tag plays a full-body .vrma animation ONCE through the AnimationMixer,
// then crossfades back to the idle loop (see Model.playVrma in model.ts).
//
// To add a new animation: drop the .vrma into /public/poses/ and add one line
// here. The tag is automatically added to the system prompt (emotionPrompt.ts)
// and recognised by the message parser (messages.ts) — nothing else to edit.
export const VRMA_TAG_MAP: Record<string, string> = {
  wave:         "/poses/wave.vrma",
  modelpose:    "/poses/modelpose.vrma",
  peacesign:    "/poses/peacesign.vrma",
  shoot:        "/poses/shoot.vrma",
  showfullbody: "/poses/showfullbody.vrma",
  spin:         "/poses/spin.vrma",
  squat:        "/poses/squat.vrma",
};

export const ALL_VRMA_TAGS = Object.keys(VRMA_TAG_MAP);

export function isVrmaTag(tag: string): boolean {
  return Object.prototype.hasOwnProperty.call(VRMA_TAG_MAP, tag);
}

// ── Cache (parsed VRMAnimation per file, shared by every loaded VRM) ─────────
const _cache = new Map<string, Promise<VRMAnimation | null>>();

export function loadVrmaForTag(tag: string): Promise<VRMAnimation | null> {
  const path = VRMA_TAG_MAP[tag];
  if (!path) return Promise.resolve(null);

  let promise = _cache.get(path);
  if (!promise) {
    promise = loadVRMAnimation(buildUrl(path)).catch((err) => {
      console.warn(`[vrma] failed to load ${path}`, err);
      _cache.delete(path); // allow a retry next time
      return null;
    });
    _cache.set(path, promise);
  }
  return promise;
}

/** Warm the cache in the background so the first trigger doesn't lag. */
export function preloadAllVrma(): void {
  ALL_VRMA_TAGS.forEach((tag) => {
    void loadVrmaForTag(tag);
  });
}
