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

let _activePoseOverrides: BoneOverrideMap | null = null;
// _poseBlend: 0 = idle, 1 = full pose, values in between = blending
let _poseBlend = 0;

// Timers
let _animTimer:    ReturnType<typeof setTimeout>  | null = null;
let _restoreTimer: ReturnType<typeof setTimeout>  | null = null;
let _fadeTimer:    ReturnType<typeof setInterval> | null = null;

const POSE_DURATION_MS  = 3000;
const CYCLE_INTERVAL_MS = 400;
const FADE_STEPS        = 12;
const FADE_IN_STEP_MS   = 12;  // ~144ms total fade-in
const FADE_OUT_STEP_MS  = 25;  // ~300ms total fade-out

function cancelAllTimers() {
  if (_animTimer)    { clearTimeout(_animTimer);    _animTimer    = null; }
  if (_restoreTimer) { clearTimeout(_restoreTimer); _restoreTimer = null; }
  if (_fadeTimer)    { clearInterval(_fadeTimer);   _fadeTimer    = null; }
}

function cancelFadeTimer() {
  if (_fadeTimer) { clearInterval(_fadeTimer); _fadeTimer = null; }
}

// ── Per-frame override application ────────────────────────────────────────────
// Called from Model.update() AFTER mixer.update() and emoteController.update().
//
// KEY FIX: We use slerpQuaternions(a, b, t) which writes into `this` (the node
// quaternion) without mutating a or b. The stored target quaternions stay
// immutable across frames. Without this, slerp() corrupts the target each frame.

const _currentQuat = new THREE.Quaternion();

export function applyPoseOverride(vrm: VRM): void {
  if (!_activePoseOverrides || _poseBlend <= 0) return;

  const humanoid = vrm.humanoid;
  const t = _poseBlend;

  _activePoseOverrides.forEach((targetQuat, boneName) => {
    const node = humanoid.getNormalizedBoneNode(boneName as any);
    if (!node) return;

    if (t >= 1) {
      // Full pose — direct copy, no allocation
      node.quaternion.copy(targetQuat);
    } else {
      // Save current (mixer-driven) rotation, blend toward pose target
      _currentQuat.copy(node.quaternion);
      node.quaternion.slerpQuaternions(_currentQuat, targetQuat, t);
    }
  });
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
      _poseBlend = 0;
      onDone?.();
    }
  }, FADE_OUT_STEP_MS);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function playPose(vrm: VRM, tag: string): Promise<void> {
  const files = POSE_TAG_MAP[tag];
  if (!files) return;

  // Load pose files (served from /public/poses/, cached after first fetch)
  const poses = (await Promise.all(files.map(fetchPose))).filter(Boolean) as PoseFile[];
  if (poses.length === 0) return;

  // Cancel any running pose/fade before starting new one
  cancelAllTimers();

  if (poses.length === 1) {
    // ── Static pose ──────────────────────────────────────────────────────────
    _activePoseOverrides = buildOverrideMap(poses[0], tag);

    startFadeIn(() => {
      _restoreTimer = setTimeout(() => {
        startFadeOut();
      }, POSE_DURATION_MS);
    });

  } else {
    // ── Cycling pose (clap / wave) ────────────────────────────────────────────
    let frame = 0;
    _activePoseOverrides = buildOverrideMap(poses[0], tag);

    startFadeIn(() => {
      const cycle = () => {
        frame = (frame + 1) % poses.length;
        _activePoseOverrides = buildOverrideMap(poses[frame], tag);
        _animTimer = setTimeout(cycle, CYCLE_INTERVAL_MS);
      };
      _animTimer = setTimeout(cycle, CYCLE_INTERVAL_MS);

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
    _poseBlend = 0;
  }
}

// No-op — kept for import compatibility
export function registerPoseMixerCallbacks(
  _onStart: () => void,
  _onEnd: () => void
) {}
