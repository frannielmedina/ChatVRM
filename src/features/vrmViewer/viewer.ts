import * as THREE from "three";
import { Model } from "./model";
import { loadVRMAnimation } from "@/lib/VRMAnimation/loadVRMAnimation";
import { buildUrl } from "@/utils/buildUrl";
import { STAGE_ELEMENT_ID } from "@/features/stage/stageConfig";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  GraphicsConfig,
  DEFAULT_GRAPHICS_CONFIG,
  MIN_RESOLUTION_SCALE,
  PerfStats,
  autoProfileFor,
  detectHardware,
  readStoredGraphicsConfig,
} from "@/features/graphics/graphicsConfig";

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

  // ── Graphics / performance ─────────────────────────────────────────────────
  private _dirLight: THREE.DirectionalLight;
  private _ambLight: THREE.AmbientLight;
  private _gfx: GraphicsConfig = DEFAULT_GRAPHICS_CONFIG;
  private _frameInterval = 0; // seconds between rendered frames (0 = unlimited)
  private _accum = 0;
  private _loopStarted = false;
  // Live FPS measurement (rendered frames per second, refreshed every ~1s)
  private _fpsFrames = 0;
  private _fpsWindowStart = 0;
  private _fps = 0;
  // Auto-quality state: `_autoScale` is what the live scaler is currently using
  // (multiplied into resolutionScale), `_autoCeiling` is the highest value it
  // is allowed to climb back to (lowered whenever a climb caused a slowdown).
  private _autoScale = 1;
  private _autoCeiling = 1;
  private _autoLowSamples = 0;
  private _autoHighSamples = 0;
  private _autoCeilingSetAt = 0;
  private _autoAdjusted = false;
  /** Whether the live WebGL context was created with antialiasing (it can't change afterwards). */
  public antialiasActive = true;

  constructor() {
    this.isReady = false;
    const scene = new THREE.Scene();
    this._scene = scene;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(directionalLight);
    this._dirLight = directionalLight;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    this._ambLight = ambientLight;

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

    // Antialiasing can only be chosen when the GL context is created, so it
    // is read straight from the saved settings here (changing it in the UI
    // asks for a reload).
    const stored = readStoredGraphicsConfig();
    this._gfx = stored;
    this.antialiasActive = stored.antialias;
    this._renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: stored.antialias,
      // Needed so the canvas can be captured reliably for streaming.
      preserveDrawingBuffer: false,
    });
    this._renderer.outputEncoding = THREE.sRGBEncoding;
    this._renderer.setSize(width, height);
    this.applyGraphics(stored);

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
    // setup() can run more than once (canvas remount) — never start a second loop.
    if (!this._loopStarted) {
      this._loopStarted = true;
      this.update();
    }
  }

  // ── Graphics API ───────────────────────────────────────────────────────────
  private effectivePixelRatio(): number {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const scale = this._gfx.autoQuality
      ? this._gfx.resolutionScale * this._autoScale
      : this._gfx.resolutionScale;
    const ratio = Math.min(dpr * scale, this._gfx.maxPixelRatio);
    return Math.max(0.3, ratio);
  }

  private applyPixelRatio() {
    if (!this._renderer) return;
    const parent = this._renderer.domElement.parentElement;
    this._renderer.setPixelRatio(this.effectivePixelRatio());
    if (parent && parent.clientWidth && parent.clientHeight) {
      this._renderer.setSize(parent.clientWidth, parent.clientHeight);
    }
  }

  public applyGraphics(cfg: GraphicsConfig) {
    const prevAuto = this._gfx.autoQuality;
    this._gfx = { ...DEFAULT_GRAPHICS_CONFIG, ...cfg };

    // Frame limiter. In auto mode the tier decides the target if the user left it unlimited.
    const target = this.targetFps();
    this._frameInterval = target > 0 ? 1 / target : 0;

    // Lights
    this._dirLight.intensity = this._gfx.lightIntensity;
    this._ambLight.intensity = this._gfx.ambientIntensity;
    const az = THREE.MathUtils.degToRad(this._gfx.lightAzimuth);
    const el = THREE.MathUtils.degToRad(this._gfx.lightElevation);
    this._dirLight.position
      .set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
      .normalize();

    // Auto quality: start from the hardware tier's recommendation.
    if (this._gfx.autoQuality && !prevAuto) {
      this._autoScale = 1;
      this._autoCeiling = 1;
      this._autoLowSamples = 0;
      this._autoHighSamples = 0;
    }
    if (this._gfx.autoQuality) {
      const tierProfile = autoProfileFor(detectHardware().tier);
      // Start a fresh auto session at the tier's recommended resolution.
      if (!prevAuto || this._autoScale === 1) {
        this._autoScale = Math.min(1, Math.max(MIN_RESOLUTION_SCALE, tierProfile.resolutionScale));
        this._autoCeiling = Math.min(1, Math.max(this._autoScale, tierProfile.resolutionScale));
      }
    } else {
      this._autoAdjusted = false;
    }
    this.applyPixelRatio();
  }

  /**
   * Effective FPS cap. Manual mode: exactly what the user chose (0 = unlimited).
   * Auto mode: the user's value is treated as a maximum, and weak hardware
   * (the "low" tier) is held to 30 so it doesn't thrash trying to do 60.
   */
  private targetFps(): number {
    const user = this._gfx.fpsLimit;
    if (!this._gfx.autoQuality) return user;
    const tierCap = detectHardware().tier === "low" ? 30 : 0;
    if (tierCap === 0) return user;
    return user > 0 ? Math.min(user, tierCap) : tierCap;
  }

  public getPerfStats(): PerfStats {
    return {
      fps: Math.round(this._fps),
      pixelRatio: Number(this.effectivePixelRatio().toFixed(2)),
      resolutionScale: Number(
        (this._gfx.autoQuality ? this._gfx.resolutionScale * this._autoScale : this._gfx.resolutionScale).toFixed(2)
      ),
      fpsTarget: this.targetFps(),
      tier: detectHardware().tier,
      autoAdjusted: this._autoAdjusted,
    };
  }

  /** Called once per rendered frame; measures FPS and, in auto mode, nudges resolution to hold the target. */
  private trackFrame(now: number) {
    if (this._fpsWindowStart === 0) this._fpsWindowStart = now;
    this._fpsFrames++;
    const elapsed = now - this._fpsWindowStart;
    if (elapsed < 1000) return;

    this._fps = (this._fpsFrames * 1000) / elapsed;
    this._fpsFrames = 0;
    this._fpsWindowStart = now;

    if (!this._gfx.autoQuality || document.hidden) return;

    // What we are trying to hold: the user's cap, or 60 when unlimited.
    const target = this.targetFps() > 0 ? this.targetFps() : 60;
    // A little tolerance: frame timing on a 60Hz display won't hit 60.0 exactly.
    if (this._fps < target * 0.85) {
      this._autoLowSamples++;
      this._autoHighSamples = 0;
    } else if (this._fps >= target * 0.95) {
      this._autoHighSamples++;
      this._autoLowSamples = 0;
    } else {
      this._autoLowSamples = 0;
      this._autoHighSamples = 0;
    }

    // Struggling for 3 seconds in a row → drop resolution and remember not to climb back to this level.
    if (this._autoLowSamples >= 3 && this._autoScale > MIN_RESOLUTION_SCALE) {
      this._autoCeiling = Math.max(MIN_RESOLUTION_SCALE, this._autoScale - 0.05);
      this._autoCeilingSetAt = now;
      this._autoScale = Math.max(MIN_RESOLUTION_SCALE, this._autoScale - 0.1);
      this._autoLowSamples = 0;
      this._autoAdjusted = true;
      this.applyPixelRatio();
      return;
    }

    // Comfortable for 10 seconds → creep back up, but never past the learned ceiling.
    // The ceiling relaxes after 60s so a temporary spike (loading, another app) doesn't pin quality low forever.
    if (now - this._autoCeilingSetAt > 60000) {
      this._autoCeiling = Math.min(1, this._autoCeiling + 0.1);
      this._autoCeilingSetAt = now;
    }
    if (this._autoHighSamples >= 10 && this._autoScale < this._autoCeiling) {
      this._autoScale = Math.min(this._autoCeiling, this._autoScale + 0.05);
      this._autoHighSamples = 0;
      this._autoAdjusted = true;
      this.applyPixelRatio();
    }
  }

  public resize() {
    if (!this._renderer) return;
    const parentElement = this._renderer.domElement.parentElement;
    if (!parentElement) return;
    const width = parentElement.clientWidth;
    const height = parentElement.clientHeight;
    if (width === 0 || height === 0) return;
    this._renderer.setPixelRatio(this.effectivePixelRatio());
    this._renderer.setSize(width, height);
    if (!this._camera) return;
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();

    // The corner box's aspect ratio changes as it animates in/out, and the
    // full-body-fit distance depends on aspect — recompute it continuously
    // so the whole body stays framed (rather than only fitting correctly
    // once the CSS transition finishes).
    if (this._isScreenShareFraming) {
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

    // Percent of the *stage* (which may be a fixed, scaled size), not the window.
    const stage = document.getElementById(STAGE_ELEMENT_ID)?.getBoundingClientRect();
    const ref = stage && stage.width > 0
      ? stage
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    return {
      xPct: ((xPx - ref.left) / ref.width) * 100,
      yPct: ((yPx - ref.top) / ref.height) * 100,
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

  // User fine-tuning of the shared-screen framing (see ScreenShareConfig.zoom / shiftY).
  private _ssZoom = 1;
  private _ssShiftY = 0;

  public setScreenShareTuning(zoom: number, shiftY: number) {
    this._ssZoom = Math.min(3, Math.max(0.3, zoom || 1));
    this._ssShiftY = shiftY || 0;
    if (this._isScreenShareFraming) this.applyScreenShareFraming();
  }

  private applyScreenShareFraming() {
    if (!this._camera || !this._cameraControls) return;

    const vFov = this.SCREEN_SHARE_FOV;
    this._camera.fov = vFov;
    this._camera.updateProjectionMatrix();

    const parentElement = this._renderer?.domElement.parentElement;
    const aspect =
      parentElement && parentElement.clientHeight
        ? parentElement.clientWidth / parentElement.clientHeight
        : this._camera.aspect;
    const hFovDeg = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(vFov) / 2) * aspect)
    );

    const b = this._modelBounds;
    if (!b) {
      // No model measured yet: sensible fixed fallback.
      this._camera.position.set(0, 1.2 + this._ssShiftY, 2.4 / this._ssZoom);
      this._cameraControls.target.set(0, 1.2 + this._ssShiftY, 0);
      this._cameraControls.update();
      return;
    }

    const top = b.centerY + b.height / 2;
    const bottom = b.centerY - b.height / 2;
    let centerY: number;
    let distance: number;

    if (this._fullBodyView) {
      // Whole body, head to toe, fitted to the box (height OR width, whichever is tighter).
      centerY = b.centerY;
      distance = Math.max(
        Viewer.fitDistance(b.height * this.FULL_BODY_MARGIN, vFov),
        Viewer.fitDistance(b.width * this.FULL_BODY_MARGIN, hFovDeg)
      );
    } else {
      // Close-up: waist up. Measured from the model (hips bone → top of head/ears), so it
      // works for any avatar proportions and keeps working when the box is resized.
      const hips = this.model?.vrm?.humanoid.getNormalizedBoneNode("hips");
      const hipsY = hips
        ? hips.getWorldPosition(new THREE.Vector3()).y
        : bottom + b.height * 0.5;
      const regionBottom = hipsY + (top - hipsY) * 0.12;
      const regionHeight = (top - regionBottom) * 1.12;
      centerY = (top + regionBottom) / 2;
      // Fit head-and-shoulders width (~1/5 of body height), not the arms: in a narrow, tall
      // box, fitting the full shoulder span would back the camera out until it's a full-body
      // shot again. Arms/shoulder edges may crop slightly — that's what makes it a close-up.
      const upperWidth = b.height * 0.22;
      distance = Math.max(
        Viewer.fitDistance(regionHeight, vFov),
        Viewer.fitDistance(upperWidth, hFovDeg)
      );
    }

    distance = Math.max(distance / this._ssZoom, 0.4);
    centerY += this._ssShiftY;

    this._camera.position.set(0, centerY, distance);
    this._cameraControls.target.set(0, centerY, 0);
    this._cameraControls.update();
  }

  public update = () => {
    requestAnimationFrame(this.update);
    this._accum += this._clock.getDelta();

    // FPS limiter: skip this display refresh if it's too soon for the next
    // frame. The small tolerance avoids a 60fps cap on a 60Hz monitor
    // randomly dropping to 30 because of timer jitter.
    const interval = this._frameInterval;
    if (interval > 0 && this._accum < interval - 0.0015) return;

    // Clamp so coming back from a hidden tab doesn't fling the spring bones.
    const delta = Math.min(this._accum, 0.1);
    this._accum = interval > 0 ? Math.min(Math.max(this._accum - interval, 0), interval) : 0;

    if (this.model) this.model.update(delta);
    if (this._renderer && this._camera) {
      this._renderer.render(this._scene, this._camera);
      this.trackFrame(performance.now());
    }
  };
}
