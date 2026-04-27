import { useEffect, useRef, useState } from "react";

export type CaptionLine = {
  id: number;
  text: string;
  visible: boolean;
};

export type CaptionStyle = {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowBlur: number;
  shadowColor: string;
  bgOpacity: number;
  position: "bottom" | "top" | "middle";
  typewriterSpeed: number;
  lingerDuration: number;
  maxLines: number;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 28,
  fontFamily: "Montserrat",
  textColor: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 6,
  shadowBlur: 8,
  shadowColor: "rgba(0,0,0,0.9)",
  bgOpacity: 0,
  position: "bottom",
  typewriterSpeed: 18,
  lingerDuration: 5000,
  maxLines: 3,
};

type Props = {
  message: string;
  captionStyle?: CaptionStyle;
};

export const AssistantText = ({
  message,
  captionStyle = DEFAULT_CAPTION_STYLE,
}: Props) => {
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<"hidden" | "visible" | "fading">("hidden");

  // All mutable state lives in refs so closures never go stale
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMsgRef = useRef<string>("");  // next message waiting for fade-out
  const activeMsgRef = useRef<string>("");   // message currently on screen
  const phaseRef = useRef<"hidden" | "visible" | "fading">("hidden");

  const setPhaseSync = (p: "hidden" | "visible" | "fading") => {
    phaseRef.current = p;
    setPhase(p);
  };

  const cleanMessage = message.replace(/\[([a-zA-Z]*?)\]/g, "").trim();

  const clearAllTimers = () => {
    if (typeTimerRef.current) { clearTimeout(typeTimerRef.current); typeTimerRef.current = null; }
    if (lingerTimerRef.current) { clearTimeout(lingerTimerRef.current); lingerTimerRef.current = null; }
    if (fadeOutTimerRef.current) { clearTimeout(fadeOutTimerRef.current); fadeOutTimerRef.current = null; }
  };

  const scheduleLinger = (text: string) => {
    if (captionStyle.lingerDuration <= 0) return; // stay until next message
    lingerTimerRef.current = setTimeout(() => {
      if (activeMsgRef.current !== text) return;
      setPhaseSync("fading");
      fadeOutTimerRef.current = setTimeout(() => {
        if (activeMsgRef.current !== text) return;
        activeMsgRef.current = "";
        setDisplayed("");
        setPhaseSync("hidden");
      }, 400);
    }, captionStyle.lingerDuration);
  };

  const beginTyping = (text: string) => {
    activeMsgRef.current = text;
    pendingMsgRef.current = "";
    setDisplayed("");
    setPhaseSync("visible");

    const speed = captionStyle.typewriterSpeed;

    if (speed === 0) {
      setDisplayed(text);
      scheduleLinger(text);
      return;
    }

    let i = 0;
    const tick = () => {
      if (activeMsgRef.current !== text) return; // aborted by new message
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        typeTimerRef.current = setTimeout(tick, speed);
      } else {
        scheduleLinger(text);
      }
    };
    typeTimerRef.current = setTimeout(tick, speed);
  };

  const showMessage = (text: string) => {
    clearAllTimers();

    if (phaseRef.current === "hidden") {
      // Nothing on screen — begin immediately
      beginTyping(text);
    } else {
      // Caption is visible or mid-fade — queue next message, fade out current
      pendingMsgRef.current = text;
      setPhaseSync("fading");
      fadeOutTimerRef.current = setTimeout(() => {
        const next = pendingMsgRef.current;
        activeMsgRef.current = "";
        setDisplayed("");
        setPhaseSync("hidden");
        if (next) beginTyping(next);
      }, 300);
    }
  };

  useEffect(() => {
    if (!cleanMessage) {
      clearAllTimers();
      pendingMsgRef.current = "";
      if (phaseRef.current !== "hidden") {
        setPhaseSync("fading");
        fadeOutTimerRef.current = setTimeout(() => {
          activeMsgRef.current = "";
          setDisplayed("");
          setPhaseSync("hidden");
        }, 400);
      }
      return clearAllTimers;
    }

    showMessage(cleanMessage);
    return clearAllTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanMessage]);

  if (phase === "hidden") return null;

  const positionClass =
    captionStyle.position === "top"
      ? "top-24 bottom-auto"
      : captionStyle.position === "middle"
      ? "top-1/2 -translate-y-1/2 bottom-auto"
      : "bottom-[88px]";

  const textShadow = [
    `0 0 ${captionStyle.shadowBlur}px ${captionStyle.shadowColor}`,
    `0 2px 4px rgba(0,0,0,0.8)`,
  ].join(", ");

  const opacity = phase === "visible" ? 1 : 0;

  // Height of maxLines lines, calculated from fontSize + lineHeight
  const maxHeightPx = captionStyle.fontSize * 1.4 * captionStyle.maxLines;

  return (
    <div
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none px-24 ${positionClass}`}
      style={{ opacity, transition: "opacity 0.3s ease" }}
    >
      <div
        style={{
          maxWidth: "700px",
          width: "100%",
          background:
            captionStyle.bgOpacity > 0
              ? `rgba(0,0,0,${captionStyle.bgOpacity})`
              : "transparent",
          borderRadius: captionStyle.bgOpacity > 0 ? "8px" : undefined,
          padding: captionStyle.bgOpacity > 0 ? "8px 20px" : undefined,
        }}
      >
        <p
          style={{
            fontSize: `${captionStyle.fontSize}px`,
            fontFamily: `'${captionStyle.fontFamily}', 'M PLUS 2', sans-serif`,
            fontWeight: 800,
            color: captionStyle.textColor,
            textShadow,
            WebkitTextStroke: `${captionStyle.strokeWidth}px ${captionStyle.strokeColor}`,
            paintOrder: "stroke fill",
            lineHeight: 1.4,
            letterSpacing: "0.01em",
            textAlign: "center",
            // Cap height to maxLines without using line-clamp (which adds "...")
            maxHeight: `${maxHeightPx}px`,
            overflow: "hidden",
            wordBreak: "break-word",
            whiteSpace: "normal",
            margin: 0,
          } as React.CSSProperties}
        >
          {displayed}
        </p>
      </div>
    </div>
  );
};
