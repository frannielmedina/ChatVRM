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
// These bones are controlled by the look-at / emotion system and should not
// be overridden by pose files, otherwise the head tilts into the face.
const SKIP_BONES = new Set([
  "head",
  "neck",
  "leftEye",
  "rightEye",
  "jaw",
  // Spine bones cause the torso to pitch forward and cover the face
  // on most pose files — skip them too unless it's a bow.
]);

// For "bow" we DO want the spine, so we use a separate skip list
const SKIP_BONES_BOW = new Set([
  "head",
  "neck",
  "leftEye",
  "rightEye",
  "jaw",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

type QuatArray = [number, number, number, number]; // [x, y, z, w]

// Old format (bow.json, clap*.json, etc.)
interface LegacyPoseFile {
  version: string;
  pose: Record<string, { rotation: QuatArray }>;
  yRotationOffsetDeg?: number;
}

// New format (cheer.json, wave*.json, etc.)
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

// ── Apply a single pose file to VRM ──────────────────────────────────────────

function applyLegacyPose(vrm: VRM, pose: LegacyPoseFile, skipSet: Set<string>) {
  const humanoid = vrm.humanoid;
  for (const [boneName, boneData] of Object.entries(pose.pose)) {
    if (skipSet.has(boneName)) continue;
    const node = humanoid.getNormalizedBoneNode(boneName as any);
    if (!node) continue;
    const [x, y, z, w] = boneData.rotation;
    node.quaternion.set(x, y, z, w);
  }
}

function applyNewPose(vrm: VRM, pose: NewPoseFile, skipSet: Set<string>) {
  const humanoid = vrm.humanoid;
  for (const [boneName, boneData] of Object.entries(pose.bones)) {
    if (skipSet.has(boneName)) continue;
    const node = humanoid.getNormalizedBoneNode(boneName as any);
    if (!node) continue;

    if (boneData.rotation?.values?.length) {
      const [x, y, z, w] = boneData.rotation.values[0];
      node.quaternion.set(x, y, z, w);
    }
    if (boneData.translation?.values?.length && boneName === "hips") {
      const [tx, ty, tz] = boneData.translation.values[0];
      const restHips = humanoid.getNormalizedBoneNode("hips");
      if (restHips) {
        node.position.set(tx, ty, tz);
      }
    }
  }
}

function applyPoseFile(vrm: VRM, pose: PoseFile, tag: string) {
  // For bow we allow spine bones; for everything else we skip them
  const skipSet = tag === "bow" ? SKIP_BONES_BOW : SKIP_BONES;

  if ("pose" in pose) {
    applyLegacyPose(vrm, pose as LegacyPoseFile, skipSet);
  } else {
    applyNewPose(vrm, pose as NewPoseFile, skipSet);
  }
}

// ── Animated cycling for multi-frame poses (clap / wave) ─────────────────────

let _animTimer: ReturnType<typeof setTimeout> | null = null;
let _restoreTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPoseTimers() {
  if (_animTimer)    { clearTimeout(_animTimer);    _animTimer    = null; }
  if (_restoreTimer) { clearTimeout(_restoreTimer); _restoreTimer = null; }
}

/** Bones we snapshot & restore (excludes head/neck/eyes — those are untouched) */
const SNAPSHOT_BONES = [
  "hips", "spine", "chest", "upperChest",
  "leftShoulder",  "leftUpperArm",  "leftLowerArm",  "leftHand",
  "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand",
  "leftUpperLeg",  "leftLowerLeg",  "leftFoot",
  "rightUpperLeg", "rightLowerLeg", "rightFoot",
  // fingers
  "leftThumbMetacarpal",  "leftThumbProximal",  "leftThumbDistal",
  "leftIndexProximal",    "leftIndexIntermediate",    "leftIndexDistal",
  "leftMiddleProximal",   "leftMiddleIntermediate",   "leftMiddleDistal",
  "leftRingProximal",     "leftRingIntermediate",     "leftRingDistal",
  "leftLittleProximal",   "leftLittleIntermediate",   "leftLittleDistal",
  "rightThumbMetacarpal", "rightThumbProximal", "rightThumbDistal",
  "rightIndexProximal",   "rightIndexIntermediate",   "rightIndexDistal",
  "rightMiddleProximal",  "rightMiddleIntermediate",  "rightMiddleDistal",
  "rightRingProximal",    "rightRingIntermediate",    "rightRingDistal",
  "rightLittleProximal",  "rightLittleIntermediate",  "rightLittleDistal",
];

/** Save the current normalized bone rotations so we can restore them */
function snapshotPose(vrm: VRM): Map<string, THREE.Quaternion> {
  const snap = new Map<string, THREE.Quaternion>();
  const humanoid = vrm.humanoid;
  for (const name of SNAPSHOT_BONES) {
    const node = humanoid.getNormalizedBoneNode(name as any);
    if (node) snap.set(name, node.quaternion.clone());
  }
  return snap;
}

function restorePose(vrm: VRM, snap: Map<string, THREE.Quaternion>) {
  const humanoid = vrm.humanoid;
  snap.forEach((quat, name) => {
    const node = humanoid.getNormalizedBoneNode(name as any);
    if (node) node.quaternion.copy(quat);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

const POSE_DURATION_MS  = 3000; // how long to hold a pose before restoring
const CYCLE_INTERVAL_MS = 400;  // clap / wave cycle speed

export async function playPose(vrm: VRM, tag: string): Promise<void> {
  const files = POSE_TAG_MAP[tag];
  if (!files) return;

  cancelPoseTimers();

  // Load all frames
  const poses = (await Promise.all(files.map(fetchPose))).filter(Boolean) as PoseFile[];
  if (poses.length === 0) return;

  const snapshot = snapshotPose(vrm);

  if (poses.length === 1) {
    // Static pose
    applyPoseFile(vrm, poses[0], tag);
    _restoreTimer = setTimeout(() => restorePose(vrm, snapshot), POSE_DURATION_MS);
  } else {
    // Cycling pose (clap / wave)
    let frame = 0;
    const cycle = () => {
      applyPoseFile(vrm, poses[frame % poses.length], tag);
      frame++;
      _animTimer = setTimeout(cycle, CYCLE_INTERVAL_MS);
    };
    cycle();
    _restoreTimer = setTimeout(() => {
      cancelPoseTimers();
      restorePose(vrm, snapshot);
    }, POSE_DURATION_MS);
  }
}

export function cancelPose(vrm: VRM) {
  cancelPoseTimers();
}
