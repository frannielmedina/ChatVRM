import * as THREE from "three";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMAnimation } from "../../lib/VRMAnimation/VRMAnimation";
import { VRMLookAtSmootherLoaderPlugin } from "@/lib/VRMLookAtSmootherLoaderPlugin/VRMLookAtSmootherLoaderPlugin";
import { LipSync } from "../lipSync/lipSync";
import { ExpressionController as EmoteController } from "../emoteController/expressionController";
import { Screenplay } from "../messages/messages";
import {
  playPose,
  cancelPose,
  applyPoseOverride,
  registerPoseMixerCallbacks,
} from "../emoteController/poseController";
import { isVrmaTag, loadVrmaForTag } from "../emoteController/vrmaController";
import { isExpressionGestureTag } from "../emoteController/emoteConstants";

// Crossfade time (seconds) between the idle loop and a VRMA animation.
const VRMA_FADE_SEC = 0.4;

export class Model {
  public vrm?: VRM | null;
  public mixer?: THREE.AnimationMixer;
  public emoteController?: EmoteController;

  private _lookAtTargetParent: THREE.Object3D;
  private _lipSync?: LipSync;

  // ── VRMA playback state ──
  private _idleAction?: THREE.AnimationAction;
  private _vrmaActions = new Map<string, THREE.AnimationAction>();
  private _currentVrma?: THREE.AnimationAction;
  private _currentVrmaTag?: string;

  constructor(lookAtTargetParent: THREE.Object3D) {
    this._lookAtTargetParent = lookAtTargetParent;
    this._lipSync = new LipSync(new AudioContext());
  }

  public async loadVRM(url: string): Promise<void> {
    const loader = new GLTFLoader();
    loader.register(
      (parser) =>
        new VRMLoaderPlugin(parser, {
          lookAtPlugin: new VRMLookAtSmootherLoaderPlugin(parser),
        })
    );
    const gltf = await loader.loadAsync(url);
    const vrm = (this.vrm = gltf.userData.vrm);
    vrm.scene.name = "VRMRoot";
    VRMUtils.rotateVRM0(vrm);
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this._idleAction = undefined;
    this._vrmaActions.clear();
    this._currentVrma = undefined;
    this._currentVrmaTag = undefined;
    this.emoteController = new EmoteController(vrm, this._lookAtTargetParent);

    // No-op — pose system no longer pauses the mixer
    registerPoseMixerCallbacks(() => {}, () => {});
  }

  public unLoadVrm() {
    if (this.vrm) {
      cancelPose(this.vrm);
      this.mixer?.stopAllAction();
      this._idleAction = undefined;
      this._vrmaActions.clear();
      this._currentVrma = undefined;
      this._currentVrmaTag = undefined;
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
  }

  public async loadAnimation(vrmAnimation: VRMAnimation): Promise<void> {
    const { vrm, mixer } = this;
    if (vrm == null || mixer == null) throw new Error("Load VRM first");
    const clip = vrmAnimation.createAnimationClip(vrm);
    const action = mixer.clipAction(clip);
    action.play();
    // This is the idle loop — remember it so VRMA animations can crossfade
    // out of it and back into it.
    this._idleAction = action;
  }

  /**
   * Play a one-shot .vrma animation (e.g. "wave", "spin") on top of the idle
   * loop: crossfade idle → animation, and crossfade back when it ends.
   * Safe to call repeatedly; calling it with the same tag restarts it.
   */
  public async playVrma(tag: string): Promise<void> {
    const { vrm, mixer } = this;
    if (!vrm || !mixer || !isVrmaTag(tag)) return;

    let action = this._vrmaActions.get(tag);
    if (!action) {
      const vrmAnimation = await loadVrmaForTag(tag);
      // The VRM may have been swapped/unloaded while the file was loading
      if (!vrmAnimation || this.vrm !== vrm || this.mixer !== mixer) return;
      action = this._vrmaActions.get(tag); // another call may have created it meanwhile
      if (!action) {
        const clip = vrmAnimation.createAnimationClip(vrm);
        action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        this._vrmaActions.set(tag, action);
      }
    }

    const previous = this._currentVrma;
    action.reset();
    action.play();

    if (previous === action) {
      // Same animation again: restart it, idle is already faded out
      action.fadeIn(VRMA_FADE_SEC);
    } else if (previous && previous.isRunning()) {
      // Another VRMA is playing: crossfade straight into the new one
      action.crossFadeFrom(previous, VRMA_FADE_SEC, false);
    } else if (this._idleAction) {
      action.crossFadeFrom(this._idleAction, VRMA_FADE_SEC, false);
    } else {
      action.fadeIn(VRMA_FADE_SEC);
    }

    this._currentVrma = action;
    this._currentVrmaTag = tag;
  }

  /** Fade the current VRMA animation (if any) back into the idle loop. */
  public stopVrma(): void {
    const current = this._currentVrma;
    if (!current) return;

    this._currentVrma = undefined;
    this._currentVrmaTag = undefined;

    const idle = this._idleAction;
    if (idle) {
      idle.reset();
      idle.play();
      idle.crossFadeFrom(current, VRMA_FADE_SEC, false);
    } else {
      current.fadeOut(VRMA_FADE_SEC);
    }
  }

  public async speak(buffer: ArrayBuffer, screenplay: Screenplay) {
    this.emoteController?.playEmotion(screenplay.expression);

    if (screenplay.pose && this.vrm) {
      if (isExpressionGestureTag(screenplay.pose)) {
        // Facial gesture ([wink]) — layered on the face, body keeps doing
        // whatever it's doing (idle / VRMA / pose).
        if (screenplay.pose === "wink") this.emoteController?.wink();
      } else if (isVrmaTag(screenplay.pose)) {
        // Full-body .vrma animation (runs through the mixer).
        // Not awaited so speech never waits for the file to load.
        cancelPose(this.vrm);
        this.playVrma(screenplay.pose).catch((err) =>
          console.warn("[vrma] playback failed", err)
        );
      } else {
        // Static / 2-frame JSON pose (bone override).
        this.stopVrma();
        playPose(this.vrm, screenplay.pose);
      }
    }

    await new Promise((resolve) => {
      this._lipSync?.playFromArrayBuffer(buffer, () => {
        this.emoteController?.playEmotion("neutral");
        resolve(true);
      });
    });
  }

  public update(delta: number): void {
    // 1. Lip sync volume sampling
    if (this._lipSync) {
      const { volume } = this._lipSync.update();
      this.emoteController?.lipSync("aa", volume);
    }

    // 2. Expression controller: blink, lip sync weights, look-at
    //    This runs independently of the mixer — always works.
    this.emoteController?.update(delta);

    // 3. Idle animation mixer — ALWAYS runs (never paused).
    //    This drives body/arm bones via the idle_loop.vrma animation.
    this.mixer?.update(delta);

    // 3b. When a VRMA animation is about to end, start fading back to idle
    //     (instead of freezing on its last frame).
    if (
      this._currentVrma &&
      this._currentVrma.time >=
        this._currentVrma.getClip().duration - VRMA_FADE_SEC
    ) {
      this.stopVrma();
    }

    // 4. Pose override — applied AFTER the mixer so the idle animation
    //    can't overwrite our pose bone rotations this frame.
    //    Only non-head/neck/eye bones are overridden, so blink and
    //    look-at continue working perfectly throughout.
    if (this.vrm) {
      applyPoseOverride(this.vrm);
    }

    // 5. VRM final update: spring bones, look-at applier, etc.
    this.vrm?.update(delta);
  }
}
