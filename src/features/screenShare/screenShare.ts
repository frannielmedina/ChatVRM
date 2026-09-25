export type ScreenShareMode = "chrome" | "vdoninja";

// Which bottom corner the character's "facecam" box snaps to while screen
// share / gaming mode is active.
export type CornerPosition = "left" | "right";

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
};

export const DEFAULT_SCREEN_SHARE_CONFIG: ScreenShareConfig = {
  mode: "chrome",
  vdoninjaRoomId: "",
  active: false,
  cornerPosition: "right",
  fullBodyView: true,
};

let _screenStream: MediaStream | null = null;
let _videoElement: HTMLVideoElement | null = null;

export async function startScreenShare(): Promise<MediaStream> {
  const stream = await (navigator.mediaDevices as any).getDisplayMedia({
    video: { frameRate: 30 },
    audio: false,
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
