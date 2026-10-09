export type ScreenShareMode = "chrome" | "vdoninja";

// Which bottom corner the character's "facecam" box snaps to while screen
// share / gaming mode is active.
export type CornerPosition = "left" | "center" | "right";

export type ScreenShareConfig = {
  mode: ScreenShareMode;
  vdoninjaRoomId?: string;
  active: boolean;
  cornerPosition: CornerPosition;
  // When true, the corner/facecam camera auto-fits the character's whole
  // body (measured from the actual loaded model, so it works regardless of
  // hair, ears, or accessories) instead of a fixed close-in shot that could
  // crop the top of the head.
  fullBodyView: boolean;
  // ── Character box layout (while sharing) ──────────────────────────────────
  boxWidth: number;      // px, width of the character box
  boxHeightPct: number;  // % of the stage height
  offsetX: number;       // px gap from the left/right edge (ignored when centered)
  offsetY: number;       // px gap from the bottom edge
  zoom: number;          // 1 = auto-fit, >1 = closer, <1 = further
  shiftY: number;        // camera height nudge in metres (+ shows more above the head)
  /** Also capture + play the shared surface's audio (so game sound ends up in the stream). */
  shareAudio: boolean;
};

export const DEFAULT_SCREEN_SHARE_CONFIG: ScreenShareConfig = {
  mode: "chrome",
  vdoninjaRoomId: "",
  active: false,
  cornerPosition: "right",
  fullBodyView: true,
  boxWidth: 300,
  boxHeightPct: 85,
  offsetX: 16,
  offsetY: 0,
  zoom: 1,
  shiftY: 0,
  shareAudio: false,
};

let _screenStream: MediaStream | null = null;
let _videoElement: HTMLVideoElement | null = null;

// `devices` lets the streamer's pop-out control window start the picker from
// ITS OWN click (browsers require a click in the window that asks for capture).
export async function startScreenShare(
  shareAudio = false,
  devices: MediaDevices = navigator.mediaDevices
): Promise<MediaStream> {
  const stream = await (devices as any).getDisplayMedia({
    video: { frameRate: 30 },
    audio: shareAudio,
  });
  _screenStream = stream;
  return stream;
}

export function stopScreenShare() {
  if (_screenStream) {
    _screenStream.getTracks().forEach((t) => t.stop());
    _screenStream = null;
  }
  if (_videoElement) {
    _videoElement.srcObject = null;
    _videoElement = null;
  }
}

export function getScreenStream() {
  return _screenStream;
}

export function buildVdoNinjaUrl(roomId: string): string {
  const room = encodeURIComponent(roomId);
  return `https://vdo.ninja/?view=${room}&cleanoutput&transparent`;
}
