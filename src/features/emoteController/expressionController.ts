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
  WINK_DURATION_SEC,
  WINK_EYE,
  WINK_SMILE_PRESET,
  WINK_SMILE_WEIGHT,
  WINK_FADE_IN_SEC,
  WINK_FADE_OUT_SEC,
} from "./emoteConstants";

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

  public playEmotion(preset: VRMExpressionPresetName) {
    if (this._currentEmotion !== "neutral") {
      this._expressionManager?.setValue(this._currentEmotion, 0);
    }
    if (preset === "neutral") {
      this._autoBlink?.setEnable(true);
      this._currentEmotion = preset;
      return;
    }
    const t = this._autoBlink?.setEnable(false) || 0;
    this._currentEmotion = preset;
    setTimeout(() => {
      this._expressionManager?.setValue(preset, 1);
    }, t * 1000);
  }

  /**
   * Wink with a smile ("[wink]" tag). Closes one eye, fades the current
   * emotion toward a soft smile, then restores everything.
   */
  public wink(durationSec: number = WINK_DURATION_SEC) {
    if (!this._expressionManager) return;
    if (this._wink) this.endWink(); // restart cleanly if already winking
    this._wink = { elapsed: 0, duration: durationSec, savedOverrides: new Map() };
    this._autoBlink?.setEnable(false);
    this.relaxBlinkOverride(WINK_SMILE_PRESET);
    this.relaxBlinkOverride(this._currentEmotion);
  }

  // Some models set happy/relaxed/etc. to "block" blink shapes, which would
  // hide the wink. Turn that off while winking (restored in endWink).
  private relaxBlinkOverride(name: string) {
    const w = this._wink;
    if (!w || name === "neutral" || w.savedOverrides.has(name)) return;
    const expr = this._expressionManager?.getExpression(name);
    if (!expr) return;
    w.savedOverrides.set(name, expr.overrideBlink);
    expr.overrideBlink = "none";
  }

  private updateWink(delta: number) {
    const w = this._wink;
    const em = this._expressionManager;
    if (!w || !em) return;

    w.elapsed += delta;
    if (w.elapsed >= w.duration) {
      this.endWink();
      return;
    }

    const env = Math.max(
      0,
      Math.min(
        1,
        w.elapsed / WINK_FADE_IN_SEC,
        (w.duration - w.elapsed) / WINK_FADE_OUT_SEC
      )
    );

    // The emotion may have changed mid-wink (e.g. speech ended → neutral)
    const emotion = this._currentEmotion;
    this.relaxBlinkOverride(emotion);

    em.setValue(WINK_EYE, env);

    // Fade the current emotion out and the soft smile in. "happy" arches
    // BOTH eyes, so it must be reduced or the wink wouldn't be visible.
    if (emotion === WINK_SMILE_PRESET) {
      em.setValue(emotion, 1 - env * (1 - WINK_SMILE_WEIGHT));
    } else {
      if (emotion !== "neutral") em.setValue(emotion, 1 - env);
      em.setValue(WINK_SMILE_PRESET, env * WINK_SMILE_WEIGHT);
    }
  }

  private endWink() {
    const w = this._wink;
    const em = this._expressionManager;
    this._wink = null;
    if (!w || !em) return;

    em.setValue(WINK_EYE, 0);
    const emotion = this._currentEmotion;
    if (emotion !== WINK_SMILE_PRESET) em.setValue(WINK_SMILE_PRESET, 0);
    if (emotion !== "neutral") em.setValue(emotion, 1);

    w.savedOverrides.forEach((value, name) => {
      const expr = em.getExpression(name);
      if (expr) expr.overrideBlink = value;
    });

    if (emotion === "neutral") this._autoBlink?.setEnable(true);
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    if (this._currentLipSync) {
      this._expressionManager?.setValue(this._currentLipSync.preset, 0);
    }
    this._currentLipSync = { preset, value };
  }

  public update(delta: number) {
    if (this._autoBlink) this._autoBlink.update(delta);
    this.updateWink(delta);
    if (this._currentLipSync) {
      const weight =
        this._currentEmotion === "neutral"
          ? this._currentLipSync.value * 0.5
          : this._currentLipSync.value * 0.25;
      this._expressionManager?.setValue(this._currentLipSync.preset, weight);
    }
  }
}
