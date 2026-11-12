// ── Miko's widget page ───────────────────────────────────────────────────────
// Aika loads this URL as an OBS browser source. It draws ONLY Miko on a fully
// transparent canvas (no background image, no UI) and plays her TTS audio.
//
//   /aika-widget/?peer=<id>&vrm=<public .vrm URL>&view=full|close&zoom=1&shiftY=0
//     view=full  (default) whole body, head to toe     view=close  head & shoulders
//     zoom       0.3–3, >1 closer                       shiftY      world units, + moves view up
//
// Audio only plays between "show" and "hide" frames, i.e. after Aika's
// ai_talk_start confirmation (the guide: never play audio before it).
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import { buildUrl } from "@/utils/buildUrl";
import { WidgetReceiver, WidgetFrame } from "@/features/aikaPeer/widgetBridge";
import type { Screenplay } from "@/features/messages/messages";

export default function AikaWidget() {
  const { viewer } = useContext(ViewerContext);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  // Transparent page: kill the global body background image (see _document.tsx).
  useEffect(() => {
    const prev = {
      bg: document.body.style.backgroundImage,
      bgc: document.body.style.backgroundColor,
      html: document.documentElement.style.background,
    };
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.backgroundImage = prev.bg;
      document.body.style.backgroundColor = prev.bgc;
      document.documentElement.style.background = prev.html;
    };
  }, []);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const params = new URLSearchParams(window.location.search);
      viewer.setup(canvas);
      // Framing must be set BEFORE the model loads: the viewer re-frames itself
      // from the measured model bounds once loading finishes.
      if ((params.get("view") || "full") !== "close") {
        viewer.setFullBodyView(true);
        viewer.setScreenShareTuning(
          parseFloat(params.get("zoom") || "1") || 1,
          parseFloat(params.get("shiftY") || "0") || 0
        );
        viewer.setScreenShareFraming(true);
      }
      viewer.loadVrm(params.get("vrm") || buildUrl("/AvatarSample_B.vrm"));
    },
    [viewer]
  );

  const handleFrame = useCallback(
    (f: WidgetFrame) => {
      if (f.t === "show") { visibleRef.current = true; setVisible(true); }
      else if (f.t === "hide") { visibleRef.current = false; setVisible(false); }
      else if (f.t === "speak" && visibleRef.current) {
        const screenplay: Screenplay = {
          expression: f.expression as Screenplay["expression"],
          pose: f.pose,
          talk: { style: f.style as any, speakerX: 0, speakerY: 0, message: f.text },
        };
        // Strictly one line at a time, in order.
        queue.current = queue.current
          .then(() => viewer.model?.speak(f.audio, screenplay))
          .catch((e) => console.warn("[aika-widget] speak failed", e))
          .then(() => undefined);
      }
    },
    [viewer]
  );

  useEffect(() => {
    const peerId = new URLSearchParams(window.location.search).get("peer");
    let loaded = false;
    const rx = new WidgetReceiver(peerId, handleFrame, () => { if (loaded) rx.sendReady(); });
    rx.start();
    // The VRM is big (~16 MB): tell the control tab only once Miko can really speak.
    const poll = setInterval(() => {
      if (!loaded && viewer.model?.vrm) {
        loaded = true;
        rx.sendReady();
      }
    }, 300);
    return () => { clearInterval(poll); rx.stop(); };
  }, [handleFrame, viewer]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "transparent", overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%", height: "100%", background: "transparent",
          opacity: visible ? 1 : 0, transition: "opacity 400ms ease",
        }}
      />
    </div>
  );
}
