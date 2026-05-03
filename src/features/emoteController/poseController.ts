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

// ── Bone override map (stores immutable target quaternions) ───────────────────
type BoneOverrideMap = Map<string, THREE.Quaternion>;

function buildOverrideMap(pose: PoseFile, tag: string): BoneOverrideMap {
  const map: BoneOverrideMap = new Map();
  const skipSet = tag === "bow" ? SKIP_BONES_BOW : SKIP_BONES;

  if ("pose" in pose) {
    for (const [boneName, boneData] of Object.entries((pose as LegacyPoseFile).pose)) {
      if (skipSet.has(boneName)) continue;
      const [x, y, z, w] = boneData.rotation;
      map.set(boneName, new THREE.Quaternion(x, y, z, w));
    }
  } else {
    for (const [boneName, boneData] of Object.entries((pose as NewPoseFile).bones)) {
      if (skipSet.has(boneName)) continue;
      if (boneData.rotation?.values?.length) {
        const [x, y, z, w] = boneData.rotation.values[0];
        map.set(boneName, new THREE.Quaternion(x, y, z, w));
      }
    }
  }

  return map;
}

// ── Global pose state ─────────────────────────────────────────────────────────

// Static poses: a single override map applied at full weight.
let _activePoseOverrides: BoneOverrideMap | null = null;

// Cycling poses (wave / clap): two maps + a continuously driven lerp factor.
// applyPoseOverride() slerpQuaternions between _cycleFrom and _cycleTo using _cycleT.
let _cycleFrom: BoneOverrideMap | null = null;
let _cycleTo:   BoneOverrideMap | null = null;
let _cycleT     = 0;   // 0 = _cycleFrom, 1 = _cycleTo
let _cycleDir   = 1;   // oscillates: +1 forward, -1 backward
let _isCycling  = false;

// Master blend: 0 = no override, 1 = full pose (driven by fade in/out)
let _poseBlend = 0;

// Timers
let _cycleTimer:   ReturnType<typeof setInterval> | null = null;
let _restoreTimer: ReturnType<typeof setTimeout>  | null = null;
let _fadeTimer:    ReturnType<typeof setInterval> | null = null;

const POSE_DURATION_MS = 3000;

// One full A→B swing takes this many ms.  Two swings = one complete oscillation.
const CYCLE_SWING_MS   = 350;
// Tick rate for the cycle lerp driver (~60 fps equivalent)
const CYCLE_TICK_MS    = 16;

const FADE_STEPS       = 12;
const FADE_IN_STEP_MS  = 12;   // ~144ms total fade-in
const FADE_OUT_STEP_MS = 25;   // ~300ms total fade-out

function cancelAllTimers() {
  if (_cycleTimer)   { clearInterval(_cycleTimer);   _cycleTimer   = null; }
  if (_restoreTimer) { clearTimeout(_restoreTimer);  _restoreTimer = null; }
  if (_fadeTimer)    { clearInterval(_fadeTimer);    _fadeTimer    = null; }
}

function cancelFadeTimer() {
  if (_fadeTimer) { clearInterval(_fadeTimer); _fadeTimer = null; }
}

// ── Per-frame override application ────────────────────────────────────────────
// Called from Model.update() AFTER mixer.update() and emoteController.update().

const _tmpA = new THREE.Quaternion();
const _tmpB = new THREE.Quaternion();

export function applyPoseOverride(vrm: VRM): void {
  if (_poseBlend <= 0) return;

  const humanoid = vrm.humanoid;
  const outerT   = _poseBlend; // master fade blend

  if (_isCycling && _cycleFrom && _cycleTo) {
    // ── Cycling pose: slerp between the two keyframe maps using _cycleT ──────
    const innerT = _cycleT;

    // Collect all bone names from both maps
    const bones = new Set([..._cycleFrom.keys(), ..._cycleTo.keys()]);

    bones.forEach((boneName) => {
      const node = humanoid.getNormalizedBoneNode(boneName as any);
      if (!node) return;

      const quatFrom = _cycleFrom!.get(boneName);
      const quatTo   = _cycleTo!.get(boneName);

      let targetQuat: THREE.Quaternion;

      if (quatFrom && quatTo) {
        // Interpolate between the two pose frames
        _tmpA.copy(quatFrom);
        _tmpB.copy(quatTo);
        _tmpA.slerp(_tmpB, innerT); // _tmpA now holds the blended target
        targetQuat = _tmpA;
      } else {
        targetQuat = (quatFrom ?? quatTo)!;
      }

      if (outerT >= 1) {
        node.quaternion.copy(targetQuat);
      } else {
        // Also blend against the mixer-driven current rotation
        node.quaternion.slerp(targetQuat, outerT);
      }
    });

  } else if (_activePoseOverrides) {
    // ── Static pose ───────────────────────────────────────────────────────────
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
// Drives _cycleT back and forth between 0 and 1 smoothly.

function startCycleOscillator() {
  if (_cycleTimer) { clearInterval(_cycleTimer); _cycleTimer = null; }

  // How much to advance _cycleT per tick so that one full swing takes CYCLE_SWING_MS
  const step = CYCLE_TICK_MS / CYCLE_SWING_MS;

  _cycleT   = 0;
  _cycleDir = 1;

  _cycleTimer = setInterval(() => {
    _cycleT += _cycleDir * step;
    if (_cycleT >= 1) {
      _cycleT   = 1;
      _cycleDir = -1;
    } else if (_cycleT <= 0) {
      _cycleT   = 0;
      _cycleDir = 1;
    }
  }, CYCLE_TICK_MS);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function playPose(vrm: VRM, tag: string): Promise<void> {
  const files = POSE_TAG_MAP[tag];
  if (!files) return;

  const poses = (await Promise.all(files.map(fetchPose))).filter(Boolean) as PoseFile[];
  if (poses.length === 0) return;

  cancelAllTimers();

  if (poses.length === 1) {
    // ── Static pose ──────────────────────────────────────────────────────────
    _isCycling           = false;
    _cycleFrom           = null;
    _cycleTo             = null;
    _activePoseOverrides = buildOverrideMap(poses[0], tag);

    startFadeIn(() => {
      _restoreTimer = setTimeout(() => {
        startFadeOut();
      }, POSE_DURATION_MS);
    });

  } else {
    // ── Cycling pose (wave / clap) ────────────────────────────────────────────
    // Instead of snapping between frames every 400ms, we continuously slerp
    // between _cycleFrom and _cycleTo using an oscillating _cycleT value.
    _isCycling           = true;
    _activePoseOverrides = null;
    _cycleFrom           = buildOverrideMap(poses[0], tag);
    _cycleTo             = buildOverrideMap(poses[1], tag);

    // Start the smooth oscillator immediately so motion begins on fade-in
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
