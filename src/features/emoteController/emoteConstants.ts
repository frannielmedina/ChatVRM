export const BLINK_CLOSE_MAX = 0.12;
export const BLINK_OPEN_MAX = 5;

// ── Wink ([wink] tag) ────────────────────────────────────────────────────────
// A wink is a one-eye blink + a smile, played as a short expression gesture.
// Tweak these if it doesn't look right on your model:
export const WINK_DURATION_SEC = 1.3;
// "left" = the CHARACTER's left eye (the viewer's right side), like a mirror.
export const WINK_EYE: "blinkLeft" | "blinkRight" = "blinkLeft";
// Smile layered on top of the wink. VRoid's "happy" (Joy) is a big smile that
// also arches both eyes, so we only use part of it. Lower = subtler.
export const WINK_SMILE_PRESET = "happy";
export const WINK_SMILE_WEIGHT = 0.4;
export const WINK_FADE_IN_SEC = 0.12;
export const WINK_FADE_OUT_SEC = 0.25;

// Tags that are facial gestures (handled by ExpressionController, not the
// body pose / VRMA systems). They are added to ALL_POSE_TAGS automatically.
export const EXPRESSION_GESTURE_TAGS = ["wink"];
export function isExpressionGestureTag(tag: string): boolean {
  return EXPRESSION_GESTURE_TAGS.includes(tag);
}

// ── Natural blink (ported from aicompanion) ──────────────────────────────────
export const BLINK_MIN_INTERVAL_SEC = 2.5;  // wait between blinks (random)
export const BLINK_MAX_INTERVAL_SEC = 6;
export const BLINK_SPEED = 14;              // lid speed per second (14 ≈ 70 ms to close)
export const BLINK_HOLD_SEC = 0.04;         // how long the eyes stay shut
export const BLINK_DOUBLE_CHANCE = 0.12;    // chance of a quick second blink

// ── Expression blending ──────────────────────────────────────────────────────
// How fast emotions fade in/out (weight per second). 2.5 ≈ 0.4 s, like aicompanion.
export const EMOTION_BLEND_PER_SEC = 2.5;
