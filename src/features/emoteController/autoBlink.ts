import { VRMExpressionManager } from "@pixiv/three-vrm";
import {
  BLINK_MIN_INTERVAL_SEC,
  BLINK_MAX_INTERVAL_SEC,
  BLINK_SPEED,
  BLINK_HOLD_SEC,
  BLINK_DOUBLE_CHANCE,
} from "./emoteConstants";

const enum Phase {
  Waiting,
  Closing,
  Holding,
  Opening,
}

/**
 * Smooth, randomised blinking.
 *
 * The old version snapped the eyelids shut (0 → 1 in one frame) on a fixed 5 s
 * timer and was switched off completely while any emotion was active, so the
 * eyelids were basically never animated while talking. This one animates the
 * lids closed/open every few seconds, always (it only pauses *starting* new
 * blinks when disabled, and never leaves the eyes stuck half-closed).
 */
export class AutoBlink {
  private _expressionManager: VRMExpressionManager;
  private _phase: Phase = Phase.Waiting;
  private _timer = 0;
  private _nextBlinkIn: number;
  private _value = 0;
  private _enabled = true;

  constructor(expressionManager: VRMExpressionManager) {
    this._expressionManager = expressionManager;
    this._nextBlinkIn = this.randomInterval();
  }

  /** Enable/disable starting NEW blinks. Returns 0 (kept for API compatibility). */
  public setEnable(isAuto: boolean): number {
    this._enabled = isAuto;
    return 0;
  }

  public update(delta: number) {
    switch (this._phase) {
      case Phase.Waiting:
        if (!this._enabled) return;
        this._timer += delta;
        if (this._timer >= this._nextBlinkIn) {
          this._phase = Phase.Closing;
          this._timer = 0;
        }
        return;

      case Phase.Closing:
        this._value = Math.min(1, this._value + delta * BLINK_SPEED);
        if (this._value >= 1) {
          this._phase = Phase.Holding;
          this._timer = 0;
        }
        break;

      case Phase.Holding:
        this._timer += delta;
        if (this._timer >= BLINK_HOLD_SEC) this._phase = Phase.Opening;
        break;

      case Phase.Opening:
        // opening is a touch slower than closing — looks more natural
        this._value = Math.max(0, this._value - delta * BLINK_SPEED * 0.8);
        if (this._value <= 0) {
          this._phase = Phase.Waiting;
          this._timer = 0;
          this._nextBlinkIn =
            Math.random() < BLINK_DOUBLE_CHANCE ? 0.18 : this.randomInterval();
        }
        break;
    }
    this._expressionManager.setValue("blink", this._value);
  }

  private randomInterval(): number {
    return (
      BLINK_MIN_INTERVAL_SEC +
      Math.random() * (BLINK_MAX_INTERVAL_SEC - BLINK_MIN_INTERVAL_SEC)
    );
  }
}
