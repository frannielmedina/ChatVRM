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

// All recognised pose tag names (for stripping from display text)
export const ALL_POSE_TAGS = Object.keys(POSE_TAG_MAP);

// ── Bones to SKIP when applying poses ────────────────────────────────────────
// head/neck/eyes are controlled by the look-at / emotion system.
// hips translation is always skipped.
const SKIP_BONES = new Set([
  "head",
  "neck",
  "leftEye",
  "rightEye",
  "jaw",
  "spine",
  "chest",
  "upperChest",
]);

// For "bow" we DO want spine/chest/upperChest
const SKIP_BONES_BOW = new Set([
  "head",
  "neck",
  "leftEye",
  "rightEye",
  "jaw",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

type QuatArray = [number, number, number, number]; // [x, y, z, w]

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

// ── Per-bone override map ─────────────────────────────────────────────────────
// This is applied EVERY FRAME after mixer.update(), so the mixer keeps running
// (preserving blink / expressions / look-at) but the body bones are overridden.

type BoneOverrideMap = Map<string, THREE.Quaternion>;

// Global state for the active pose override
let _activePoseOverrides: BoneOverrideMap | null = null;
let _poseBlend = 0; // 0 = no pose, 1 = full pose
let _poseTag = "";

// Timers
let _animTimer: ReturnType<typeof setTimeout> | null = null;
let _restoreTimer: ReturnType<typeof setTimeout> | null = null;
let _fadeTimer: ReturnType<typeof setInterval> | null = null;

const POSE_DURATION_MS = 3000;
const CYCLE_INTERVAL_MS = 400;
const FADE_IN_DURATION_MS = 150;
const FADE_OUT_DURATION_MS = 300;

function cancelAllTimers() {
  if (_animTimer)    { clearTimeout(_animTimer);    _animTimer    = null; }
  if (_restoreTimer) { clearTimeout(_restoreTimer); _restoreTimer = null; }
  if (_fadeTimer)    { clearInterval(_fadeTimer);   _fadeTimer    = null; }
}

// ── Build override map from pose file ────────────────────────────────────────

function buildOverrideMap(pose: PoseFile, tag: string): BoneOverrideMap {
  const map: BoneOverrideMap = new Map();
  const skipSet = tag === "bow" ? SKIP_BONES_BOW : SKIP_BONES;

  if ("pose" in pose) {
    // Legacy format
    for (const [boneName, boneData] of Object.entries((pose as LegacyPoseFile).pose)) {
      if (skipSet.has(boneName)) continue;
      const [x, y, z, w] = boneData.rotation;
      map.set(boneName, new THREE.Quaternion(x, y, z, w));
    }
  } else {
    // New format
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

// ── Apply current override to VRM (called every frame from Model.update) ─────
// This runs AFTER mixer.update() so expressions/blink are unaffected.

const _tmpQuat = new THREE.Quaternion();

export function applyPoseOverride(vrm: VRM): void {
  if (!_activePoseOverrides || _poseBlend <= 0) return;

  const humanoid = vrm.humanoid;
  _activePoseOverrides.forEach((targetQuat, boneName) => {
    const node = humanoid.getNormalizedBoneNode(boneName as any);
    if (!node) return;
    if (_poseBlend >= 1) {
      node.quaternion.copy(targetQuat);
    } else {
      node.quaternion.slerp(targetQuat, _poseBlend);
    }
  });
}

// ── Fade helpers ──────────────────────────────────────────────────────────────

function fadeIn(durationMs: number, onDone?: () => void) {
  cancelFade();
  _poseBlend = 0;
  const steps = 10;
  const interval = durationMs / steps;
  let step = 0;
  _fadeTimer = setInterval(() => {
    step++;
    _poseBlend = Math.min(1, step / steps);
    if (step >= steps) {
      cancelFade();
      onDone?.();
    }
  }, interval);
}

function fadeOut(durationMs: number, onDone?: () => void) {
  cancelFade();
  _poseBlend = 1;
  const steps = 10;
  const interval = durationMs / steps;
  let step = 0;
  _fadeTimer = setInterval(() => {
    step++;
    _poseBlend = Math.max(0, 1 - step / steps);
    if (step >= steps) {
      cancelFade();
      _activePoseOverrides = null;
      _poseBlend = 0;
      onDone?.();
    }
  }, interval);
}

function cancelFade() {
  if (_fadeTimer) { clearInterval(_fadeTimer); _fadeTimer = null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function playPose(vrm: VRM, tag: string): Promise<void> {
  const files = POSE_TAG_MAP[tag];
  if (!files) return;

  cancelAllTimers();

  // Load all frames
  const poses = (await Promise.all(files.map(fetchPose))).filter(Boolean) as PoseFile[];
  if (poses.length === 0) return;

  _poseTag = tag;

  if (poses.length === 1) {
    // Static pose — fade in, hold, fade out
    _activePoseOverrides = buildOverrideMap(poses[0], tag);

    fadeIn(FADE_IN_DURATION_MS, () => {
      _restoreTimer = setTimeout(() => {
        fadeOut(FADE_OUT_DURATION_MS);
      }, POSE_DURATION_MS);
    });
  } else {
    // Cycling pose (clap / wave) — fade in, cycle frames, fade out
    let frame = 0;

    _activePoseOverrides = buildOverrideMap(poses[0], tag);

    fadeIn(FADE_IN_DURATION_MS, () => {
      // Start cycling
      const cycle = () => {
        frame++;
        _activePoseOverrides = buildOverrideMap(poses[frame % poses.length], tag);
        _animTimer = setTimeout(cycle, CYCLE_INTERVAL_MS);
      };
      _animTimer = setTimeout(cycle, CYCLE_INTERVAL_MS);

      // Stop after duration
      _restoreTimer = setTimeout(() => {
        cancelAllTimers();
        fadeOut(FADE_OUT_DURATION_MS);
      }, POSE_DURATION_MS);
    });
  }
}

export function cancelPose(_vrm?: VRM) {
  cancelAllTimers();
  if (_poseBlend > 0) {
    fadeOut(FADE_OUT_DURATION_MS);
  } else {
    _activePoseOverrides = null;
    _poseBlend = 0;
  }
}

// Keep old callback registration as no-op for compatibility
export function registerPoseMixerCallbacks(
  _onStart: () => void,
  _onEnd: () => void
) {
  // No longer needed — poses are applied per-frame overlay, mixer always runs
}
