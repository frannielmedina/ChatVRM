import { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream | null;
  vdoninjaUrl?: string;
  mode: "chrome" | "vdoninja";
  active: boolean;
};

export const ScreenShareBackground = ({ stream, vdoninjaUrl, mode, active }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!active) return null;

  if (mode === "vdoninja" && vdoninjaUrl) {
    return (
      <div className="absolute top-0 left-0 w-screen h-[100svh] -z-20">
        <iframe
          src={vdoninjaUrl}
          className="w-full h-full border-0"
          allow="camera;microphone;display-capture"
          title="VDO.Ninja Screen Share"
        />
      </div>
    );
  }

  if (mode === "chrome" && stream) {
    return (
      <div className="absolute top-0 left-0 w-screen h-[100svh] -z-20 bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return null;
};
