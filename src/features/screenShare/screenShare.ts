export type ScreenShareMode = "chrome" | "vdoninja";

export type ScreenShareConfig = {
  mode: ScreenShareMode;
  vdoninjaRoomId?: string;
  active: boolean;
};

export const DEFAULT_SCREEN_SHARE_CONFIG: ScreenShareConfig = {
  mode: "chrome",
  vdoninjaRoomId: "",
  active: false,
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
