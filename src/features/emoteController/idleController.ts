import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";

/**
 * Procedural idle animation, ported from the aicompanion repo
 * (VTuberCanvas.tsx). It replaces the old idle_loop.vrma:
 *   - grounded breathing (spine / chest / shoulders) and a slow weight shift
 *     — the feet stay planted; only the upper body moves
 *   - head / neck sway that reacts to the current emotion
 *   - relaxed arms-down rest pose with a tiny sway
 *
 * It runs AFTER the AnimationMixer every frame. `blend` (0..1) says how much
 * of the idle to apply; Model lowers it while a .vrma animation is playing so
 * the two crossfade smoothly instead of fighting over the same bones.
 */

// Rotation limits/targets, straight from aicompanion.
const ARM_DOWN = 1.2; // upper arms (rad) — relaxed A-pose
const FOREARM_BEND = 0.1;

// Whole-body up/down float (aicompanion had 0.025). It made the character look
// like she was flying because the feet bob too, so it's OFF by default.
// Set to e.g. 0.01 if you want a tiny hover back.
const BODY_FLOAT_AMPLITUDE = 0;

// Grounded idle (radians). Increase for livelier, decrease for stiller.
const BREATH_SPEED = 1.5;       // ≈ one breath every 4 s
const BREATH_CHEST = 0.016;     // chest/spine swell
const BREATH_SHOULDER = 0.022;  // shoulders rise slightly when inhaling
const WEIGHT_SHIFT = 0.014;     // slow side-to-side lean of the torso

/** Frame-rate independent version of aicompanion's `x += (target - x) * k` (k per 60 fps frame). */
function ease(k: number, delta: number): number {
  return 1 - Math.pow(1 - k, delta * 60);
}

export class IdleController {
  private _vrm: VRM;
  /** VRM 0.x models have their normalized X/Z axes mirrored vs VRM 1.0 (after rotateVRM0). */
  private _sx: number;
  private _sz: number;

  private _floatTimer = 0;
  private _breathTimer = 0;
  private _swayTimer = 0;

  private _inited = false;
  private _head = { x: 0, y: 0, z: 0 };
  private _leftUpper = { x: 0, z: 0 };
  private _rightUpper = { x: 0, z: 0 };
  private _leftLower = 0;
  private _rightLower = 0;

  private _euler = new THREE.Euler();
  private _quat = new THREE.Quaternion();

  constructor(vrm: VRM) {
    this._vrm = vrm;
    const vrm0 = String((vrm.meta as any)?.metaVersion) === "0";
    this._sx = vrm0 ? -1 : 1;
    this._sz = vrm0 ? -1 : 1;
  }

  public update(delta: number, emotion: string, blend: number, thinking = false) {
    if (blend <= 0) return;
    const humanoid = this._vrm.humanoid;
    if (!humanoid) return;

    this._floatTimer += delta;
    this._breathTimer += delta;
    this._swayTimer += delta;

    const sx = this._sx;
    const sz = this._sz;
    const t = this._swayTimer;
    const ft = this._floatTimer;

    // ── Targets ───────────────────────────────────────────────────────────
    let headZ = Math.sin(t * 0.45) * 0.04;
    let headX = Math.sin(t * 0.6) * 0.02;
    if (thinking) {
      headZ = 0.18;
    } else if (emotion === "angry") {
      headZ = Math.sin(t * 1.2) * 0.06;
      headX = 0.04;
    } else if (emotion === "sad") {
      headZ = 0.1;
      headX = 0.08;
    } else if (emotion === "happy") {
      headZ = Math.sin(t * 0.9) * 0.06;
    } else if (emotion === "relaxed") {
      headZ = Math.sin(t * 0.3) * 0.025;
    }
    const headY = Math.sin(t * 0.3) * 0.03;

    const lUpZ = sz * -(ARM_DOWN - Math.sin(ft * 0.8) * 0.04);
    const rUpZ = sz * (ARM_DOWN + Math.sin(ft * 0.8 + 0.5) * 0.04);
    const lUpX = 0.1 + Math.sin(ft * 0.6) * 0.02;
    const rUpX = 0.1 + Math.sin(ft * 0.6 + 0.5) * 0.02;
    const lLow = sz * FOREARM_BEND;
    const rLow = sz * -FOREARM_BEND;

    // ── Smoothing (snap to the targets on the very first frame) ───────────
    if (!this._inited) {
      this._inited = true;
      this._head = { x: sx * headX, y: headY, z: sz * headZ };
      this._leftUpper = { x: lUpX, z: lUpZ };
      this._rightUpper = { x: rUpX, z: rUpZ };
      this._leftLower = lLow;
      this._rightLower = rLow;
    } else {
      const kHead = ease(0.06, delta);
      const kArm = ease(0.08, delta);
      const kLow = ease(0.05, delta);
      this._head.x += (sx * headX - this._head.x) * kHead;
      this._head.y += (headY - this._head.y) * kHead;
      this._head.z += (sz * headZ - this._head.z) * kHead;
      this._leftUpper.x += (lUpX - this._leftUpper.x) * kArm;
      this._leftUpper.z += (lUpZ - this._leftUpper.z) * kArm;
      this._rightUpper.x += (rUpX - this._rightUpper.x) * kArm;
      this._rightUpper.z += (rUpZ - this._rightUpper.z) * kArm;
      this._leftLower += (lLow - this._leftLower) * kLow;
      this._rightLower += (rLow - this._rightLower) * kLow;
    }

    // ── Apply ─────────────────────────────────────────────────────────────
    this.apply("head", this._head.x, this._head.y, this._head.z, blend);
    this.apply("neck", 0, 0, sz * Math.sin(t * 0.4) * 0.015, blend);

    // Breathing: chest swells, shoulders lift a touch on the inhale.
    const breath = Math.sin(this._breathTimer * BREATH_SPEED);     // -1..1
    const inhale = breath * 0.5 + 0.5;                            //  0..1
    // Slow weight shift: lean the spine one way and the chest back the other,
    // so the head stays roughly over the feet (feet are never moved).
    const shift = Math.sin(this._breathTimer * 0.35) * WEIGHT_SHIFT;

    this.apply("spine", sx * breath * BREATH_CHEST * 0.6, 0, sz * shift, blend);
    this.apply("chest", sx * breath * BREATH_CHEST, 0, sz * -shift * 0.6, blend);
    this.apply("upperChest", sx * breath * BREATH_CHEST * 0.5, 0, 0, blend);
    this.apply("leftShoulder", 0, 0, sz * inhale * BREATH_SHOULDER, blend);
    this.apply("rightShoulder", 0, 0, sz * -inhale * BREATH_SHOULDER, blend);
    this.apply("leftUpperArm", this._leftUpper.x, 0, this._leftUpper.z, blend);
    this.apply("rightUpperArm", this._rightUpper.x, 0, this._rightUpper.z, blend);
    this.apply("leftLowerArm", 0, 0, this._leftLower, blend);
    this.apply("rightLowerArm", 0, 0, this._rightLower, blend);

    if (BODY_FLOAT_AMPLITUDE > 0) {
      this._vrm.scene.position.y =
        Math.sin(ft * 1.1) * BODY_FLOAT_AMPLITUDE * blend;
    }
  }

  private apply(bone: string, x: number, y: number, z: number, blend: number) {
    const node = this._vrm.humanoid?.getNormalizedBoneNode(bone as any);
    if (!node) return;
    this._euler.set(x, y, z, "XYZ");
    this._quat.setFromEuler(this._euler);
    if (blend >= 1) node.quaternion.copy(this._quat);
    else node.quaternion.slerp(this._quat, blend);
  }
}
