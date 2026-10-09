import { ReactNode, useEffect, useState } from "react";
import { STAGE_ELEMENT_ID, StageSizeId, parseStageSize } from "@/features/stage/stageConfig";

type Props = {
  size: StageSizeId;
  children: ReactNode;
};

/**
 * The "scene" container. In Free mode it simply fills the window (exactly how the
 * app always behaved). In a fixed size (1920×1080, 1280×720, …) everything inside is
 * laid out at that exact size and scaled down to fit smaller windows, so the model
 * framing, captions and overlays are pixel-identical to what you stream.
 */
export const Stage = ({ size, children }: Props) => {
  const dims = parseStageSize(size);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!dims) {
    return (
      <div
        id={STAGE_ELEMENT_ID}
        className="relative w-full overflow-hidden"
        style={{ height: "100svh" }}
      >
        {children}
      </div>
    );
  }

  const scale = vp.w && vp.h ? Math.min(1, vp.w / dims.w, vp.h / dims.h) : 1;
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0b0b0f" }}>
      <div
        id={STAGE_ELEMENT_ID}
        className="absolute overflow-hidden"
        style={{
          width: dims.w,
          height: dims.h,
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};
