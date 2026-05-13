import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";

// ── Pose tag → file mapping ───────────────────────────────────────────────────
export const POSE_TAG_MAP: Record<string, string[]> = {
  bow:           ["/poses/bow.json"],
  cheer:         ["/poses/cheer.json"],
  clap:          ["/poses/clap1.json", "/poses/clap2.json"],
  cover_mouth:   ["/poses/cover_mouth.json"],
  cross:         ["/poses/cross.json"],
  crossed_arms:  ["/poses/crossed_arms.json"],
  finger_touch:  ["/poses/finger_touch.json"],
  mouth_cover:   ["/poses/mouth_cover.json"],
  shrug:         ["/poses/shrug.json"],
  shy:           ["/poses/shy.json"],
  think:         ["/poses/think.json"],
  wave:          ["/poses/wave1.json", "/poses/wave2.json"],
};

export const ALL_POSE_TAGS = Object.keys(POSE_TAG_MAP);

// ── Bones to SKIP when applying poses ────────────────────────────────────────
const SKIP_BONES = new Set([
  "head", "neck", "leftEye", "rightEye", "jaw",
  "spine", "chest", "upperChest",
]);

const SKIP_BONES_BOW = new Set([
  "head", "neck", "leftEye", "rightEye", "jaw",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

type QuatArray = [number, number, number, number];

interface LegacyPoseFile {
  version: string;
  pose: Record<string, { rotation: QuatArray }>;
  yRotationOffsetDeg?: number;
}

interface NewPoseBone {
  rotation?: { times: number[]; values: QuatArray[] };
  translation?: { times: number[]; values: [number, number, number][] };
}
interface NewPoseFile {
  specVersion: string;
  bones: Record<string, NewPoseBone>;
  yRotationOffsetDeg?: number;
}

type PoseFile = LegacyPoseFile | NewPoseFile;

// ── Cache ─────────────────────────────────────────────────────────────────────
const _poseCache = new Map<string, PoseFile>();

async function fetchPose(path: string): Promise<PoseFile | null> {
  if (_poseCache.has(path)) return _poseCache.get(path)!;
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const data = await res.json();
    _poseCache.set(path, data);
    return data;
  } catch {
    return null;
  }
}

// ── Bone override map ─────────────────────────────────────────────────────────
type BoneOverrideMap = Map<string, THREE.Quaternion>;

/**
 * Detect whether this VRM went through VRMUtils.rotateVRM0().
 *
 * rotateVRM0 is called for every VRM 0.x model in model.ts.
 * @pixiv/three-vrm v1.x exposes the spec version on vrm.meta.metaVersion:
 *   "0"  → VRM 0.x  (rotateVRM0 WAS applied)
 *   "1"  → VRM 1.0  (rotateVRM0 was NOT applied)
 *
 * Fallbacks for edge cases:
 *   - If metaVersion is absent but meta has a "specVersion" field → VRM 1.0
 *   - If meta has a "version" string (VRM0 metadata field) → VRM 0.x
 *   - Otherwise assume VRM 0.x (the common case for community models)
 */
function detectIsVrm0(vrm: VRM): boolean {
  const meta = vrm.meta as any;
  if (meta?.metaVersion !== undefined) {
    return String(meta.metaVersion) === "0";
  }
  if (meta?.specVersion !== undefined) return false; // VRM 1.0
  if (meta?.version !== undefined)     return true;  // VRM 0.x
  return true; // safe default
}

/**
 * Conjugate a pose quaternion to account for the 180° Y rotation applied by
 * VRMUtils.rotateVRM0.
 *
 * rotateVRM0 sets scene.rotation.y = π, equivalent to the quaternion R = (0, 1, 0, 0).
 * Applying R to a local bone quaternion q gives:  q' = R * q * R⁻¹
 * For R = 180° Y: R⁻¹ = R (self-inverse), so q' = R * q * R
 *
 * Expanding the quaternion product for R = (0,1,0,0):
 *   x' = -x,  y' = y,  z' = -z,  w' = w
 *
 * This is correct for the normalized humanoid bone local space used by
 * getNormalizedBoneNode / applyPoseOverride.
 */
function applyVrm0CoordFix(x: number, y: number, z: number, w: number): THREE.Quaternion {
  return new THREE.Quaternion(-x, y, -z, w);
}

function buildOverrideMap(pose: PoseFile, tag: string, isVrm0: boolean): BoneOverrideMap {
  const map: BoneOverrideMap = new Map();
  const skipSet = tag === "bow" ? SKIP_BONES_BOW : SKIP_BONES;

  const makeQuat = (x: number, y: number, z: number, w: number) =>
    isVrm0 ? applyVrm0CoordFix(x, y, z, w) : new THREE.Quaternion(x, y, z, w);

  if ("pose" in pose) {
    for (const [boneName, boneData] of Object.entries((pose as LegacyPoseFile).pose)) {
      if (skipSet.has(boneName)) continue;
      const [x, y, z, w] = boneData.rotation;
      map.set(boneName, makeQuat(x, y, z, w));
    }
  } else {
    for (const [boneName, boneData] of Object.entries((pose as NewPoseFile).bones)) {
      if (skipSet.has(boneName)) continue;
      if (boneData.rotation?.values?.length) {
        const [x, y, z, w] = boneData.rotation.values[0];
        map.set(boneName, makeQuat(x, y, z, w));
      }
    }
  }

  return map;
}

// ── Global pose state ─────────────────────────────────────────────────────────

let _activePoseOverrides: BoneOverrideMap | null = null;

let _cycleFrom: BoneOverrideMap | null = null;
let _cycleTo:   BoneOverrideMap | null = null;
let _cycleT     = 0;
let _cycleDir   = 1;
let _isCycling  = false;

let _poseBlend = 0;

let _cycleTimer:   ReturnType<typeof setInterval> | null = null;
let _restoreTimer: ReturnType<typeof setTimeout>  | null = null;
let _fadeTimer:    ReturnType<typeof setInterval> | null = null;

const POSE_DURATION_MS = 3000;
const CYCLE_SWING_MS   = 350;
const CYCLE_TICK_MS    = 16;
const FADE_STEPS       = 12;
const FADE_IN_STEP_MS  = 12;
const FADE_OUT_STEP_MS = 25;

function cancelAllTimers() {
  if (_cycleTimer)   { clearInterval(_cycleTimer);   _cycleTimer   = null; }
  if (_restoreTimer) { clearTimeout(_restoreTimer);  _restoreTimer = null; }
  if (_fadeTimer)    { clearInterval(_fadeTimer);    _fadeTimer    = null; }
}

function cancelFadeTimer() {
  if (_fadeTimer) { clearInterval(_fadeTimer); _fadeTimer = null; }
}

// ── Per-frame override application ────────────────────────────────────────────

const _tmpA = new THREE.Quaternion();
const _tmpB = new THREE.Quaternion();

export function applyPoseOverride(vrm: VRM): void {
  if (_poseBlend <= 0) return;

  const humanoid = vrm.humanoid;
  const outerT   = _poseBlend;

  if (_isCycling && _cycleFrom && _cycleTo) {
    const innerT = _cycleT;
    const bones = new Set([..._cycleFrom.keys(), ..._cycleTo.keys()]);

    bones.forEach((boneName) => {
      const node = humanoid.getNormalizedBoneNode(boneName as any);
      if (!node) return;

      const quatFrom = _cycleFrom!.get(boneName);
      const quatTo   = _cycleTo!.get(boneName);
      let targetQuat: THREE.Quaternion;

      if (quatFrom && quatTo) {
        _tmpA.copy(quatFrom);
        _tmpB.copy(quatTo);
        _tmpA.slerp(_tmpB, innerT);
        targetQuat = _tmpA;
      } else {
        targetQuat = (quatFrom ?? quatTo)!;
      }

      if (outerT >= 1) {
        node.quaternion.copy(targetQuat);
      } else {
        node.quaternion.slerp(targetQuat, outerT);
      }
    });

  } else if (_activePoseOverrides) {
    _activePoseOverrides.forEach((targetQuat, boneName) => {
      const node = humanoid.getNormalizedBoneNode(boneName as any);
      if (!node) return;
      if (outerT >= 1) {
        node.quaternion.copy(targetQuat);
      } else {
        node.quaternion.slerp(targetQuat, outerT);
      }
    });
  }
}

// ── Fade helpers ──────────────────────────────────────────────────────────────

function startFadeIn(onDone?: () => void) {
  cancelFadeTimer();
  let step = 0;
  _fadeTimer = setInterval(() => {
    step++;
    _poseBlend = Math.min(1, step / FADE_STEPS);
    if (step >= FADE_STEPS) {
      cancelFadeTimer();
      onDone?.();
    }
  }, FADE_IN_STEP_MS);
}

function startFadeOut(onDone?: () => void) {
  cancelFadeTimer();
  let step = 0;
  _fadeTimer = setInterval(() => {
    step++;
    _poseBlend = Math.max(0, 1 - step / FADE_STEPS);
    if (step >= FADE_STEPS) {
      cancelFadeTimer();
      _activePoseOverrides = null;
      _cycleFrom  = null;
      _cycleTo    = null;
      _isCycling  = false;
      _poseBlend  = 0;
      onDone?.();
    }
  }, FADE_OUT_STEP_MS);
}

// ── Cycling oscillator ────────────────────────────────────────────────────────

function startCycleOscillator() {
  if (_cycleTimer) { clearInterval(_cycleTimer); _cycleTimer = null; }
  const step = CYCLE_TICK_MS / CYCLE_SWING_MS;
  _cycleT   = 0;
  _cycleDir = 1;
  _cycleTimer = setInterval(() => {
    _cycleT += _cycleDir * step;
    if (_cycleT >= 1) { _cycleT = 1; _cycleDir = -1; }
    else if (_cycleT <= 0) { _cycleT = 0; _cycleDir = 1; }
  }, CYCLE_TICK_MS);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function playPose(vrm: VRM, tag: string): Promise<void> {
  const files = POSE_TAG_MAP[tag];
  if (!files) return;

  const poses = (await Promise.all(files.map(fetchPose))).filter(Boolean) as PoseFile[];
  if (poses.length === 0) return;

  const isVrm0 = detectIsVrm0(vrm);

  cancelAllTimers();

  if (poses.length === 1) {
    _isCycling           = false;
    _cycleFrom           = null;
    _cycleTo             = null;
    _activePoseOverrides = buildOverrideMap(poses[0], tag, isVrm0);

    startFadeIn(() => {
      _restoreTimer = setTimeout(() => {
        startFadeOut();
      }, POSE_DURATION_MS);
    });

  } else {
    _isCycling           = true;
    _activePoseOverrides = null;
    _cycleFrom           = buildOverrideMap(poses[0], tag, isVrm0);
    _cycleTo             = buildOverrideMap(poses[1], tag, isVrm0);

    startCycleOscillator();

    startFadeIn(() => {
      _restoreTimer = setTimeout(() => {
        cancelAllTimers();
        startFadeOut();
      }, POSE_DURATION_MS);
    });
  }
}

export function cancelPose(_vrm?: VRM) {
  cancelAllTimers();
  if (_poseBlend > 0) {
    startFadeOut();
  } else {
    _activePoseOverrides = null;
    _cycleFrom  = null;
    _cycleTo    = null;
    _isCycling  = false;
    _poseBlend  = 0;
  }
}

// No-op — kept for import compatibility
export function registerPoseMixerCallbacks(
  _onStart: () => void,
  _onEnd: () => void
) {}
