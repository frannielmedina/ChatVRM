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
