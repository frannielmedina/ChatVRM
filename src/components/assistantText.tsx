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
  // "hidden" = not rendered, "in" = opacity 1, "out" = opacity 0 (transitioning)
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");

  // Keep captionStyle always fresh inside callbacks
  const styleRef = useRef(captionStyle);
  useEffect(() => { styleRef.current = captionStyle; }, [captionStyle]);

  const timerType = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerLinger = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerFade = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared mutable state that closures read from refs, not stale captures
  const phaseRef = useRef<"hidden" | "in" | "out">("hidden");
  const activeTextRef = useRef<string>("");
  const abortRef = useRef<boolean>(false);

  const cleanMessage = message.replace(/\[([a-zA-Z]*?)\]/g, "").trim();

  const clearTimers = () => {
    if (timerType.current) { clearTimeout(timerType.current); timerType.current = null; }
    if (timerLinger.current) { clearTimeout(timerLinger.current); timerLinger.current = null; }
    if (timerFade.current) { clearTimeout(timerFade.current); timerFade.current = null; }
  };

  const goHidden = () => {
    phaseRef.current = "hidden";
    setPhase("hidden");
    setDisplayed("");
    activeTextRef.current = "";
  };

  const goOut = (then: () => void) => {
    phaseRef.current = "out";
    setPhase("out");
    timerFade.current = setTimeout(then, 320);
  };

  const goIn = () => {
    phaseRef.current = "in";
    setPhase("in");
  };

  const startTyping = (text: string) => {
    abortRef.current = false;
    activeTextRef.current = text;
    setDisplayed("");
    goIn();

    const speed = styleRef.current.typewriterSpeed;

    if (speed === 0) {
      setDisplayed(text);
      startLinger(text);
      return;
    }

    let i = 0;
    const tick = () => {
      if (abortRef.current) return;
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        timerType.current = setTimeout(tick, speed);
      } else {
        startLinger(text);
      }
    };
    timerType.current = setTimeout(tick, speed);
  };

  const startLinger = (text: string) => {
    const dur = styleRef.current.lingerDuration;
    if (dur <= 0) return; // stay forever until next message
    timerLinger.current = setTimeout(() => {
      if (activeTextRef.current !== text) return;
      goOut(() => {
        if (activeTextRef.current !== text) return;
        goHidden();
      });
    }, dur);
  };

  useEffect(() => {
    // Stop everything in progress
    abortRef.current = true;
    clearTimers();

    if (!cleanMessage) {
      if (phaseRef.current !== "hidden") {
        goOut(() => goHidden());
      }
      return () => { abortRef.current = true; clearTimers(); };
    }

    if (phaseRef.current === "hidden") {
      // Nothing showing — start right away
      startTyping(cleanMessage);
    } else {
      // Something is on screen — fade it out then start new
      goOut(() => {
        goHidden();
        startTyping(cleanMessage);
      });
    }

    return () => { abortRef.current = true; clearTimers(); };
    // cleanMessage is the only real trigger; style changes handled via styleRef
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

  const maxHeightPx = captionStyle.fontSize * 1.4 * captionStyle.maxLines;

  return (
    <div
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none px-24 ${positionClass}`}
      style={{
        opacity: phase === "in" ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
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
