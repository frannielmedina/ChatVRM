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

  // Corner "facecam" framing used while sharing a screen or game. The
  // corner box itself (see vrmViewer.tsx `cornerMode`) is what confines the
  // avatar to the corner — this framing just needs to show a clean,
  // straight-on full-body shot within that narrower box. The default lens
  // is a narrow 20° "telephoto" FOV (good for a tight close-up on the
  // face) — moving the camera back with that same FOV barely reveals more
  // than the head, so this also widens the FOV to a normal webcam-ish lens.
  private readonly SCREEN_SHARE_FOV = 32.0;
  private readonly SCREEN_SHARE_CAMERA_POS = new THREE.Vector3(0, 1.5, 2.4);

  // Extra breathing room around the auto-fit bounding box so cat ears,
  // ponytails, etc. never touch the very edge of the frame.
  private readonly FULL_BODY_MARGIN = 1.15;

  private _isScreenShareFraming = false;
  // When true, the corner/screen-share framing measures the actual loaded
  // model (head-to-toe, including hair/ears) and backs the camera off just
  // far enough to guarantee the whole body fits in frame — instead of a
  // fixed guessed distance that only worked for one model's proportions.
  private _fullBodyView = true;
  private _resizeObserver?: ResizeObserver;
  // Real bounding box of the currently loaded model, measured right after
  // load (bind/idle pose). Used to drive the full-body auto-fit above.
  private _modelBounds?: { height: number; width: number; centerY: number };

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

      const box = new THREE.Box3().setFromObject(this.model.vrm.scene);
      this._modelBounds = {
        height: Math.max(box.max.y - box.min.y, 0.1),
        width: Math.max(box.max.x - box.min.x, 0.1),
        centerY: (box.max.y + box.min.y) / 2,
      };

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

    // OrbitControls must exist before we can set its target — doing this in
    // the other order silently no-ops (optional chaining on `undefined`)
    // and leaves the initial target at (0,0,0), which is why the character
    // used to look badly framed for a split second on startup.
    this._cameraControls = new OrbitControls(this._camera, this._renderer.domElement);
    this._cameraControls.screenSpacePanning = true;
    this._cameraControls.target.set(0, 1.3, 0);
    this._cameraControls.update();

    // A plain `window.resize` listener only fires on an actual browser
    // window resize. It does NOT fire when the canvas's own container
    // changes size for some other reason — e.g. toggling into/out of the
    // corner "facecam" box while screen sharing, which resizes the
    // container via a CSS class change (and an animated CSS transition on
    // top of that). ResizeObserver watches the container itself, so the
    // renderer/camera stay in sync continuously, including mid-transition.
    if (parentElement) {
      this._resizeObserver?.disconnect();
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(parentElement);
    }
    window.addEventListener("resize", () => { this.resize(); });

    this.isReady = true;
    this.update();
  }

  public resize() {
    if (!this._renderer) return;
    const parentElement = this._renderer.domElement.parentElement;
    if (!parentElement) return;
    const width = parentElement.clientWidth;
    const height = parentElement.clientHeight;
    if (width === 0 || height === 0) return;
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(width, height);
    if (!this._camera) return;
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();

    // The corner box's aspect ratio changes as it animates in/out, and the
    // full-body-fit distance depends on aspect — recompute it continuously
    // so the whole body stays framed (rather than only fitting correctly
    // once the CSS transition finishes).
    if (this._isScreenShareFraming && this._fullBodyView) {
      this.applyScreenShareFraming();
    }
  }

  // Projects the VRM's head bone to viewport percentage coordinates — used
  // by the emote wall so falling emotes know where to "land". Returns null
  // if there's no model loaded yet or the canvas isn't laid out.
  public getHeadScreenPosition(): { xPct: number; yPct: number } | null {
    if (!this._camera || !this._renderer || !this.model?.vrm) return null;
    const headNode = this.model.vrm.humanoid.getNormalizedBoneNode("head");
    if (!headNode) return null;

    const headWPos = headNode.getWorldPosition(new THREE.Vector3());
    const ndc = headWPos.clone().project(this._camera); // x,y in -1..1
    const rect = this._renderer.domElement.getBoundingClientRect();

    const xPx = rect.left + ((ndc.x + 1) / 2) * rect.width;
    const yPx = rect.top + ((1 - ndc.y) / 2) * rect.height;

    return {
      xPct: (xPx / window.innerWidth) * 100,
      yPct: (yPx / window.innerHeight) * 100,
    };
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

  // Toggle whether corner/screen-share framing auto-fits the whole body
  // (measured from the actual loaded model) or uses the fixed close-in
  // distance. Re-applies immediately if screen-share framing is active.
  public setFullBodyView(enabled: boolean) {
    this._fullBodyView = enabled;
    if (this._isScreenShareFraming) this.applyScreenShareFraming();
  }

  // Camera distance at which a subject of `size` (world units) exactly
  // fills the given FOV, with FULL_BODY_MARGIN of headroom on top.
  private static fitDistance(size: number, fovDeg: number): number {
    const fovRad = THREE.MathUtils.degToRad(fovDeg);
    return size / (2 * Math.tan(fovRad / 2));
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

    this._camera.fov = this.SCREEN_SHARE_FOV;
    this._camera.updateProjectionMatrix();

    if (this._fullBodyView && this._modelBounds) {
      // Measure the box's own aspect against the container's aspect to
      // decide whether height or width is the tighter constraint — a
      // narrow, tall corner box (like the default 300px-wide facecam) is
      // usually height-limited, but a wider box could be width-limited
      // instead, so check both rather than assuming.
      const parentElement = this._renderer?.domElement.parentElement;
      const aspect =
        parentElement && parentElement.clientHeight
          ? parentElement.clientWidth / parentElement.clientHeight
          : this._camera.aspect;

      const vFov = this.SCREEN_SHARE_FOV;
      const hFovRad =
        2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(vFov) / 2) * aspect);
      const hFovDeg = THREE.MathUtils.radToDeg(hFovRad);

      const distanceForHeight = Viewer.fitDistance(
        this._modelBounds.height * this.FULL_BODY_MARGIN,
        vFov
      );
      const distanceForWidth = Viewer.fitDistance(
        this._modelBounds.width * this.FULL_BODY_MARGIN,
        hFovDeg
      );
      const distance = Math.max(distanceForHeight, distanceForWidth, 0.5);

      this._camera.position.set(0, this._modelBounds.centerY, distance);
      this._cameraControls.target.set(0, this._modelBounds.centerY, 0);
    } else {
      const hipsNode = this.model?.vrm?.humanoid.getNormalizedBoneNode("hips");
      const baseY = hipsNode
        ? hipsNode.getWorldPosition(new THREE.Vector3()).y
        : 0.9;
      this._camera.position.copy(this.SCREEN_SHARE_CAMERA_POS);
      this._cameraControls.target.set(0, baseY, 0);
    }

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
