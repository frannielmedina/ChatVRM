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

function applyLegacyPose(vrm: VRM, pose: LegacyPoseFile) {
  const humanoid = vrm.humanoid;
  for (const [boneName, boneData] of Object.entries(pose.pose)) {
    const node = humanoid.getNormalizedBoneNode(boneName as any);
    if (!node) continue;
    const [x, y, z, w] = boneData.rotation;
    node.quaternion.set(x, y, z, w);
  }
}

function applyNewPose(vrm: VRM, pose: NewPoseFile) {
  const humanoid = vrm.humanoid;
  for (const [boneName, boneData] of Object.entries(pose.bones)) {
    const node = humanoid.getNormalizedBoneNode(boneName as any);
    if (!node) continue;

    if (boneData.rotation?.values?.length) {
      const [x, y, z, w] = boneData.rotation.values[0];
      node.quaternion.set(x, y, z, w);
    }
    if (boneData.translation?.values?.length && boneName === "hips") {
      const [tx, ty, tz] = boneData.translation.values[0];
      // Scale translation relative to the model's rest hips height
      const restHips = humanoid.getNormalizedBoneNode("hips");
      if (restHips) {
        const worldPos = new THREE.Vector3();
        restHips.getWorldPosition(worldPos);
        node.position.set(tx, ty, tz);
      }
    }
  }
}

function applyPoseFile(vrm: VRM, pose: PoseFile) {
  if ("pose" in pose) {
    applyLegacyPose(vrm, pose as LegacyPoseFile);
  } else {
    applyNewPose(vrm, pose as NewPoseFile);
  }
}

// ── Animated cycling for multi-frame poses (clap / wave) ─────────────────────

let _animTimer: ReturnType<typeof setTimeout> | null = null;
let _restoreTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPoseTimers() {
  if (_animTimer)   { clearTimeout(_animTimer);   _animTimer   = null; }
  if (_restoreTimer){ clearTimeout(_restoreTimer); _restoreTimer = null; }
}

/** Save the current normalized bone rotations so we can restore them */
function snapshotPose(vrm: VRM): Map<string, THREE.Quaternion> {
  const snap = new Map<string, THREE.Quaternion>();
  const humanoid = vrm.humanoid;
  const boneNames: string[] = [
    "hips","spine","chest","upperChest","neck","head",
    "leftShoulder","leftUpperArm","leftLowerArm","leftHand",
    "rightShoulder","rightUpperArm","rightLowerArm","rightHand",
    "leftUpperLeg","leftLowerLeg","leftFoot",
    "rightUpperLeg","rightLowerLeg","rightFoot",
  ];
  for (const name of boneNames) {
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

const POSE_DURATION_MS = 3000;      // how long to hold a pose before restoring
const CYCLE_INTERVAL_MS = 400;      // clap / wave cycle speed

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
    applyPoseFile(vrm, poses[0]);
    _restoreTimer = setTimeout(() => restorePose(vrm, snapshot), POSE_DURATION_MS);
  } else {
    // Cycling pose (clap / wave)
    let frame = 0;
    const cycle = () => {
      applyPoseFile(vrm, poses[frame % poses.length]);
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
