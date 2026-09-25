import { useContext, useCallback } from "react";
import { ViewerContext } from "../features/vrmViewer/viewerContext";
import { buildUrl } from "@/utils/buildUrl";
import { CornerPosition } from "@/features/screenShare/screenShare";

type Props = {
  // When true, the canvas is confined to a small box in a bottom corner
  // (used while screen sharing / VDO.Ninja is active) instead of filling
  // the whole viewport. This guarantees the avatar can never loom over the
  // shared content, regardless of how the 3D camera is framed.
  cornerMode?: boolean;
  // Which bottom corner to dock to while cornerMode is active.
  cornerPosition?: CornerPosition;
};

export default function VrmViewer({
  cornerMode = false,
  cornerPosition = "right",
}: Props) {
  const { viewer } = useContext(ViewerContext);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (canvas) {
        viewer.setup(canvas);
        viewer.loadVrm(buildUrl("/AvatarSample_B.vrm"));

        canvas.addEventListener("dragover", (event) => event.preventDefault());
        canvas.addEventListener("drop", (event) => {
          event.preventDefault();
          const files = event.dataTransfer?.files;
          if (!files) return;
          const file = files[0];
          if (!file) return;
          const ext = file.name.split(".").pop();
          if (ext === "vrm") {
            const blob = new Blob([file], { type: "application/octet-stream" });
            const url = window.URL.createObjectURL(blob);
            viewer.loadVrm(url);
          }
        });
      }
    },
    [viewer]
  );

  return (
    <div
      className={
        cornerMode
          ? `fixed ${
              cornerPosition === "left" ? "left-16" : "right-16"
            } bottom-0 z-10 w-[300px] h-[85svh] transition-all duration-300`
          : "absolute top-0 left-0 w-screen h-[100svh] -z-10 transition-all duration-300"
      }
    >
      <canvas ref={canvasRef} className={"h-full w-full"}></canvas>
    </div>
  );
}
