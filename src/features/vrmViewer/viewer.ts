import * as THREE from "three";
import { Model } from "./model";
import { loadVRMAnimation } from "@/lib/VRMAnimation/loadVRMAnimation";
import { buildUrl } from "@/utils/buildUrl";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export class Viewer {
  public isReady: boolean;
  public model?: Model;

  private _renderer?: THREE.WebGLRenderer;
  private _clock: THREE.Clock;
  private _scene: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _cameraControls?: OrbitControls;

  // Default close-up framing (face/upper body, centered) — used both on
  // initial load and restored whenever screen share / VDO.Ninja stops.
  private readonly DEFAULT_FOV = 20.0;
  private readonly DEFAULT_CAMERA_POS = new THREE.Vector3(0, 1.3, 1.5);

  // Corner "facecam" framing used while sharing a screen or game — pulled
  // back to show the full body, panned so the model sits toward the right
  // side of frame with the shared content visible through the rest.
  // The default lens is a narrow 20° "telephoto" FOV (good for a tight,
  // undistorted close-up on the face) — just moving the camera back with
  // that same FOV barely reveals more than the head, so this framing also
  // widens the FOV to something closer to a normal webcam lens.
  private readonly SCREEN_SHARE_FOV = 42.0;
  private readonly SCREEN_SHARE_CAMERA_POS = new THREE.Vector3(0.25, 1.55, 2.6);
  private readonly SCREEN_SHARE_TARGET_OFFSET_X = -0.75;

  private _isScreenShareFraming = false;

  constructor() {
    this.isReady = false;
    const scene = new THREE.Scene();
    this._scene = scene;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    this._clock = new THREE.Clock();
    this._clock.start();
  }

  public loadVrm(url: string) {
    if (this.model?.vrm) this.unloadVRM();
    this.model = new Model(this._camera || new THREE.Object3D());
    this.model.loadVRM(url).then(async () => {
      if (!this.model?.vrm) return;
      this.model.vrm.scene.traverse((obj) => { obj.frustumCulled = false; });
      this._scene.add(this.model.vrm.scene);
      const vrma = await loadVRMAnimation(buildUrl("/idle_loop.vrma"));
      if (vrma) this.model.loadAnimation(vrma);
      requestAnimationFrame(() => { this.resetCamera(); });
    });
  }

  public unloadVRM(): void {
    if (this.model?.vrm) {
      this._scene.remove(this.model.vrm.scene);
      this.model?.unLoadVrm();
    }
  }

  public setup(canvas: HTMLCanvasElement) {
    const parentElement = canvas.parentElement;
    const width = parentElement?.clientWidth || canvas.width;
    const height = parentElement?.clientHeight || canvas.height;

    this._renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this._renderer.outputEncoding = THREE.sRGBEncoding;
    this._renderer.setSize(width, height);
    this._renderer.setPixelRatio(window.devicePixelRatio);

    this._camera = new THREE.PerspectiveCamera(this.DEFAULT_FOV, width / height, 0.1, 20.0);
    this._camera.position.copy(this.DEFAULT_CAMERA_POS);
    this._cameraControls?.target.set(0, 1.3, 0);
    this._cameraControls?.update();

    this._cameraControls = new OrbitControls(this._camera, this._renderer.domElement);
    this._cameraControls.screenSpacePanning = true;
    this._cameraControls.update();

    window.addEventListener("resize", () => { this.resize(); });
    this.isReady = true;
    this.update();
  }

  public resize() {
    if (!this._renderer) return;
    const parentElement = this._renderer.domElement.parentElement;
    if (!parentElement) return;
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(parentElement.clientWidth, parentElement.clientHeight);
    if (!this._camera) return;
    this._camera.aspect = parentElement.clientWidth / parentElement.clientHeight;
    this._camera.updateProjectionMatrix();
  }

  public resetCamera() {
    if (this._isScreenShareFraming) {
      this.applyScreenShareFraming();
      return;
    }
    const headNode = this.model?.vrm?.humanoid.getNormalizedBoneNode("head");
    if (headNode) {
      const headWPos = headNode.getWorldPosition(new THREE.Vector3());
      this._camera?.position.set(this._camera.position.x, headWPos.y, this._camera.position.z);
      this._cameraControls?.target.set(headWPos.x, headWPos.y, headWPos.z);
      this._cameraControls?.update();
    }
  }

  // Toggles between the default centered close-up and the pulled-back
  // "corner facecam" framing used while screen sharing / VDO.Ninja is
  // active. Call with `false` to restore the original position when
  // sharing stops.
  public setScreenShareFraming(active: boolean) {
    this._isScreenShareFraming = active;
    if (!this._camera || !this._cameraControls) return;

    if (active) {
      this.applyScreenShareFraming();
    } else {
      this._camera.fov = this.DEFAULT_FOV;
      this._camera.updateProjectionMatrix();
      this._camera.position.copy(this.DEFAULT_CAMERA_POS);
      const headNode = this.model?.vrm?.humanoid.getNormalizedBoneNode("head");
      if (headNode) {
        const headWPos = headNode.getWorldPosition(new THREE.Vector3());
        this._cameraControls.target.set(headWPos.x, headWPos.y, headWPos.z);
      } else {
        this._cameraControls.target.set(0, 1.3, 0);
      }
      this._cameraControls.update();
    }
  }

  private applyScreenShareFraming() {
    if (!this._camera || !this._cameraControls) return;
    const hipsNode = this.model?.vrm?.humanoid.getNormalizedBoneNode("hips");
    const baseY = hipsNode
      ? hipsNode.getWorldPosition(new THREE.Vector3()).y
      : 0.9;

    this._camera.fov = this.SCREEN_SHARE_FOV;
    this._camera.updateProjectionMatrix();
    this._camera.position.copy(this.SCREEN_SHARE_CAMERA_POS);
    this._cameraControls.target.set(
      this.SCREEN_SHARE_TARGET_OFFSET_X,
      baseY,
      0
    );
    this._cameraControls.update();
  }

  public update = () => {
    requestAnimationFrame(this.update);
    const delta = this._clock.getDelta();
    if (this.model) this.model.update(delta);
    if (this._renderer && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  };
}
