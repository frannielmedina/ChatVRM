// ── Miko's widget page ───────────────────────────────────────────────────────
// Aika loads this URL as an OBS browser source. It draws ONLY Miko on a fully
// transparent canvas (no background image, no UI) and plays her TTS audio.
//
//   /aika-widget/?peer=<id shown in the Aika panel>&vrm=<optional public .vrm URL>
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
  const [needsClick, setNeedsClick] = useState(false);
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
    const rx = new WidgetReceiver(peerId, handleFrame);
    rx.start();
    return () => rx.stop();
  }, [handleFrame]);

  // Browsers (not OBS) block audio until a click — show a tiny hint then.
  useEffect(() => {
    const t = setTimeout(() => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === "suspended") setNeedsClick(true);
      ctx.close();
    }, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={() => setNeedsClick(false)}
      style={{ position: "fixed", inset: 0, background: "transparent", overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%", height: "100%", background: "transparent",
          opacity: visible ? 1 : 0, transition: "opacity 400ms ease",
        }}
      />
      {needsClick && (
        <div style={{ position: "fixed", bottom: 6, left: 6, font: "11px Arial", color: "#fff",
          background: "rgba(0,0,0,.6)", padding: "3px 6px", borderRadius: 4 }}>
          click once to enable audio (not needed in OBS)
        </div>
      )}
    </div>
  );
}
