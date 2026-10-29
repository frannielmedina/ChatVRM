import * as THREE from "three";
import {
  VRM,
  VRMExpression,
  VRMExpressionManager,
  VRMExpressionPresetName,
} from "@pixiv/three-vrm";
import { AutoLookAt } from "./autoLookAt";
import { AutoBlink } from "./autoBlink";
import {
  EMOTION_BLEND_PER_SEC,
  WINK_DURATION_SEC,
  WINK_EYE,
  WINK_SMILE_PRESET,
  WINK_SMILE_WEIGHT,
  WINK_FADE_IN_SEC,
  WINK_FADE_OUT_SEC,
} from "./emoteConstants";

// Emotion → expression weights (same mix as aicompanion: happy gets a touch
// of relaxed so the face looks warmer).
const EMOTION_TARGETS: Record<string, Record<string, number>> = {
  neutral: {},
  happy: { happy: 1, relaxed: 0.2 },
  angry: { angry: 1 },
  sad: { sad: 1 },
  relaxed: { relaxed: 1 },
};
const EMOTION_PRESETS = ["happy", "angry", "sad", "relaxed", "surprised"];

type WinkState = {
  elapsed: number;
  duration: number;
  /** Original overrideBlink of expressions we relaxed during the wink */
  savedOverrides: Map<string, VRMExpression["overrideBlink"]>;
};

export class ExpressionController {
  private _autoLookAt: AutoLookAt;
  private _autoBlink?: AutoBlink;
  private _expressionManager?: VRMExpressionManager;
  private _currentEmotion: VRMExpressionPresetName;
  private _currentLipSync: { preset: VRMExpressionPresetName; value: number } | null;
  private _emotionWeights = new Map<string, number>();
  private _wink: WinkState | null = null;

  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._autoLookAt = new AutoLookAt(vrm, camera);
    this._currentEmotion = "neutral";
    this._currentLipSync = null;
    if (vrm.expressionManager) {
      this._expressionManager = vrm.expressionManager;
      this._autoBlink = new AutoBlink(vrm.expressionManager);
    }
  }

  public get currentEmotion(): string {
    return this._currentEmotion;
  }

  /**
   * Switch emotion. The face now FADES to it over ~0.4 s (see update()) instead
   * of snapping, and blinking keeps going the whole time.
   */
  public playEmotion(preset: VRMExpressionPresetName) {
    this._currentEmotion = preset;
  }

  // ── Wink ([wink] tag) ──────────────────────────────────────────────────────
  public wink(durationSec: number = WINK_DURATION_SEC) {
    if (!this._expressionManager) return;
    if (this._wink) this.endWink(); // restart cleanly if already winking
    this._wink = { elapsed: 0, duration: durationSec, savedOverrides: new Map() };
    this._autoBlink?.setEnable(false);
    // Some models set happy/relaxed/etc. to "block" blink shapes, which would
    // hide the wink. Turn that off while winking (restored in endWink).
    const em = this._expressionManager;
    new Set([...EMOTION_PRESETS, WINK_SMILE_PRESET]).forEach((name) => {
      const expr = em.getExpression(name);
      if (!expr) return;
      this._wink!.savedOverrides.set(name, expr.overrideBlink);
      expr.overrideBlink = "none";
    });
  }

  /** Advances the wink; returns its 0..1 strength (0 when not winking). */
  private updateWink(delta: number): number {
    const w = this._wink;
    const em = this._expressionManager;
    if (!w || !em) return 0;

    w.elapsed += delta;
    if (w.elapsed >= w.duration) {
      this.endWink();
      return 0;
    }
    const env = Math.max(
      0,
      Math.min(
        1,
        w.elapsed / WINK_FADE_IN_SEC,
        (w.duration - w.elapsed) / WINK_FADE_OUT_SEC
      )
    );
    em.setValue(WINK_EYE, env);
    return env;
  }

  private endWink() {
    const w = this._wink;
    const em = this._expressionManager;
    this._wink = null;
    if (!w || !em) return;
    em.setValue(WINK_EYE, 0);
    w.savedOverrides.forEach((value, name) => {
      const expr = em.getExpression(name);
      if (expr) expr.overrideBlink = value;
    });
    this._autoBlink?.setEnable(true);
  }

  // ── Emotion blending ───────────────────────────────────────────────────────
  private updateEmotions(delta: number, winkEnv: number) {
    const em = this._expressionManager;
    if (!em) return;

    const targets = EMOTION_TARGETS[this._currentEmotion] ?? {
      [this._currentEmotion]: 1,
    };
    const names = new Set<string>([...EMOTION_PRESETS, ...Object.keys(targets)]);
    const step = delta * EMOTION_BLEND_PER_SEC;

    names.forEach((name) => {
      const target = targets[name] ?? 0;
      let w = this._emotionWeights.get(name) ?? 0;
      if (w < target) w = Math.min(target, w + step);
      else if (w > target) w = Math.max(target, w - step);
      this._emotionWeights.set(name, w);

      let applied = w;
      if (winkEnv > 0) {
        // Fade the emotion out while winking ("happy" arches BOTH eyes, which
        // would hide the wink) and put a soft smile in its place.
        applied = w * (1 - winkEnv);
        if (name === WINK_SMILE_PRESET) {
          applied = Math.max(applied, winkEnv * WINK_SMILE_WEIGHT);
        }
      }
      em.setValue(name, applied);
    });
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    if (this._currentLipSync) {
      this._expressionManager?.setValue(this._currentLipSync.preset, 0);
    }
    this._currentLipSync = { preset, value };
  }

  public update(delta: number) {
    this._autoBlink?.update(delta);
    const winkEnv = this.updateWink(delta);
    this.updateEmotions(delta, winkEnv);
    if (this._currentLipSync) {
      const weight =
        this._currentEmotion === "neutral"
          ? this._currentLipSync.value * 0.5
          : this._currentLipSync.value * 0.25;
      this._expressionManager?.setValue(this._currentLipSync.preset, weight);
    }
  }
}
