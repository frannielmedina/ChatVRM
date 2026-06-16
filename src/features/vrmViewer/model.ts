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

export class Model {
  public vrm?: VRM | null;
  public mixer?: THREE.AnimationMixer;
  public emoteController?: EmoteController;

  private _lookAtTargetParent: THREE.Object3D;
  private _lipSync?: LipSync;

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
    this.emoteController = new EmoteController(vrm, this._lookAtTargetParent);

    // No-op — pose system no longer pauses the mixer
    registerPoseMixerCallbacks(() => {}, () => {});
  }

  public unLoadVrm() {
    if (this.vrm) {
      cancelPose(this.vrm);
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
  }

  public async speak(buffer: ArrayBuffer, screenplay: Screenplay) {
    this.emoteController?.playEmotion(screenplay.expression);

    if (screenplay.pose && this.vrm) {
      playPose(this.vrm, screenplay.pose);
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
