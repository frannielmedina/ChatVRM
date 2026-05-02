import * as THREE from "three";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMAnimation } from "../../lib/VRMAnimation/VRMAnimation";
import { VRMLookAtSmootherLoaderPlugin } from "@/lib/VRMLookAtSmootherLoaderPlugin/VRMLookAtSmootherLoaderPlugin";
import { LipSync } from "../lipSync/lipSync";
import { EmoteController } from "../emoteController/emoteController";
import { Screenplay } from "../messages/messages";
import { playPose, cancelPose, registerPoseMixerCallbacks } from "../emoteController/poseController";

export class Model {
  public vrm?: VRM | null;
  public mixer?: THREE.AnimationMixer;
  public emoteController?: EmoteController;

  private _lookAtTargetParent: THREE.Object3D;
  private _lipSync?: LipSync;
  // Track whether the mixer is paused for a pose
  private _mixerPaused = false;

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

    // Register callbacks so poseController can pause/resume the idle animation.
    // When a pose starts, we pause the mixer so it stops overwriting bone
    // rotations. When the pose ends, we resume normal idle animation.
    registerPoseMixerCallbacks(
      () => {
        // Pause: set mixer time scale to 0 so it keeps the current frame
        // but stops advancing (bone rotations from poses are preserved).
        this._mixerPaused = true;
      },
      () => {
        // Resume: re-enable the mixer so the idle animation takes back over.
        this._mixerPaused = false;
      }
    );
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

    // Trigger pose gesture if present (fire-and-forget — it self-restores).
    // playPose pauses the mixer internally so the idle animation does not
    // override the pose bone rotations.
    if (screenplay.pose && this.vrm) {
      playPose(this.vrm, screenplay.pose);
    }

    await new Promise((resolve) => {
      this._lipSync?.playFromArrayBuffer(buffer, () => {
        // Reset to neutral expression once TTS audio finishes playing.
        // Note: we do NOT cancel the pose here — the pose has its own
        // independent timer (POSE_DURATION_MS) and self-restores.
        this.emoteController?.playEmotion("neutral");
        resolve(true);
      });
    });
  }

  public update(delta: number): void {
    if (this._lipSync) {
      const { volume } = this._lipSync.update();
      this.emoteController?.lipSync("aa", volume);
    }
    this.emoteController?.update(delta);

    // Only advance the mixer when no pose is active.
    // When a pose is active (_mixerPaused = true), we skip mixer.update()
    // so the idle animation does not overwrite the pose bone rotations.
    if (!this._mixerPaused) {
      this.mixer?.update(delta);
    }

    this.vrm?.update(delta);
  }
}
