import { useEffect, useState, useRef } from "react";

type CaptionStyle = {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowBlur: number;
  shadowColor: string;
  bgOpacity: number; // 0 = transparent, 1 = full
  position: "bottom" | "top" | "middle";
  typewriterSpeed: number; // ms per char, 0 = instant
  lingerDuration: number; // ms to stay visible after typing finishes, 0 = stay forever
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
  const [isTyping, setIsTyping] = useState(false);
  const [visible, setVisible] = useState(true);
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanMessage = message.replace(/\[([a-zA-Z]*?)\]/g, "").trim();

  // Typewriter effect + linger
  useEffect(() => {
    // Clear any pending timers
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);

    if (!cleanMessage) {
      setDisplayed("");
      setVisible(true);
      return;
    }

    // A new message always resets visibility
    setVisible(true);

    const scheduleLingerAndFade = () => {
      setIsTyping(false);
      if (captionStyle.lingerDuration > 0) {
        lingerTimerRef.current = setTimeout(() => {
          setVisible(false);
        }, captionStyle.lingerDuration);
      }
      // lingerDuration === 0 means stay on screen forever (until next message)
    };

    if (captionStyle.typewriterSpeed === 0) {
      setDisplayed(cleanMessage);
      scheduleLingerAndFade();
      return;
    }

    setDisplayed("");
    setIsTyping(true);
    let i = 0;

    const tick = () => {
      i++;
      setDisplayed(cleanMessage.slice(0, i));
      if (i < cleanMessage.length) {
        typeTimerRef.current = setTimeout(tick, captionStyle.typewriterSpeed);
      } else {
        scheduleLingerAndFade();
      }
    };

    typeTimerRef.current = setTimeout(tick, captionStyle.typewriterSpeed);

    return () => {
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanMessage]);

  // Re-arm linger timer when lingerDuration setting changes mid-display
  useEffect(() => {
    if (!cleanMessage || isTyping) return;
    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);

    setVisible(true);

    if (captionStyle.lingerDuration > 0) {
      lingerTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, captionStyle.lingerDuration);
    }

    return () => {
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionStyle.lingerDuration]);

  if (!cleanMessage) return null;

  const positionClass =
    captionStyle.position === "top"
      ? "top-24 bottom-auto"
      : captionStyle.position === "middle"
      ? "top-1/2 -translate-y-1/2 bottom-auto"
      : "bottom-[88px]"; // above the input bar

  const textShadow = [
    `0 0 ${captionStyle.shadowBlur}px ${captionStyle.shadowColor}`,
    `0 2px 4px rgba(0,0,0,0.8)`,
    `${captionStyle.strokeWidth / 3}px 0 0 ${captionStyle.strokeColor}`,
    `-${captionStyle.strokeWidth / 3}px 0 0 ${captionStyle.strokeColor}`,
    `0 ${captionStyle.strokeWidth / 3}px 0 ${captionStyle.strokeColor}`,
    `0 -${captionStyle.strokeWidth / 3}px 0 ${captionStyle.strokeColor}`,
  ].join(", ");

  const strokeStyle: React.CSSProperties = {
    WebkitTextStroke: `${captionStyle.strokeWidth}px ${captionStyle.strokeColor}`,
    paintOrder: "stroke fill",
  };

  return (
    <div
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none px-16 ${positionClass} transition-opacity duration-700`}
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="max-w-3xl w-full flex justify-center"
        style={{
          background:
            captionStyle.bgOpacity > 0
              ? `rgba(0,0,0,${captionStyle.bgOpacity})`
              : "transparent",
          borderRadius: captionStyle.bgOpacity > 0 ? "8px" : undefined,
          padding: captionStyle.bgOpacity > 0 ? "8px 16px" : undefined,
        }}
      >
        <p
          style={{
            fontSize: `${captionStyle.fontSize}px`,
            fontFamily: `'${captionStyle.fontFamily}', 'M PLUS 2', sans-serif`,
            fontWeight: 800,
            color: captionStyle.textColor,
            textShadow,
            lineHeight: 1.35,
            letterSpacing: "0.01em",
            textAlign: "center",
            ...strokeStyle,
          }}
        >
          {displayed}
          {isTyping && (
            <span
              className="inline-block animate-pulse"
              style={{ opacity: 0.7, marginLeft: 2 }}
            >
              ▌
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
