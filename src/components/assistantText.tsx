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

/**
 * Caption / subtitle display — behaves like a real subtitle overlay:
 *
 * - Each new AI response REPLACES the previous caption entirely.
 * - The full response text is rendered as one block, CSS word-wrapped.
 * - A typewriter effect runs on the complete text character by character.
 * - After typing finishes the caption lingers, then fades out smoothly.
 * - On a new message: old caption fades out quickly, new one fades in.
 * - `maxLines` clamps visible height via -webkit-line-clamp (no stacking).
 */
export const AssistantText = ({
  message,
  captionStyle = DEFAULT_CAPTION_STYLE,
}: Props) => {
  const [displayed, setDisplayed] = useState("");
  const [opacity, setOpacity] = useState(0);
  const [visible, setVisible] = useState(false);

  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Used to cancel stale typewriter closures when message changes mid-animation
  const currentMsgRef = useRef("");
  const isVisibleRef = useRef(false);

  const cleanMessage = message.replace(/\[([a-zA-Z]*?)\]/g, "").trim();

  const clearAllTimers = () => {
    if (typeTimerRef.current) { clearTimeout(typeTimerRef.current); typeTimerRef.current = null; }
    if (lingerTimerRef.current) { clearTimeout(lingerTimerRef.current); lingerTimerRef.current = null; }
    if (fadeOutTimerRef.current) { clearTimeout(fadeOutTimerRef.current); fadeOutTimerRef.current = null; }
  };

  const scheduleLinger = (text: string) => {
    if (captionStyle.lingerDuration <= 0) return; // stay until next message
    lingerTimerRef.current = setTimeout(() => {
      if (currentMsgRef.current !== text) return; // already replaced
      setOpacity(0);
      fadeOutTimerRef.current = setTimeout(() => {
        if (currentMsgRef.current !== text) return;
        setVisible(false);
        isVisibleRef.current = false;
        setDisplayed("");
      }, 500);
    }, captionStyle.lingerDuration);
  };

  const startTyping = (text: string) => {
    currentMsgRef.current = text;
    setDisplayed("");
    setVisible(true);
    isVisibleRef.current = true;

    // Small delay so React can mount the element before fading in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpacity(1));
    });

    const speed = captionStyle.typewriterSpeed;

    if (speed === 0) {
      setDisplayed(text);
      scheduleLinger(text);
      return;
    }

    let i = 0;
    const tick = () => {
      if (currentMsgRef.current !== text) return; // stale, abort
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

  useEffect(() => {
    if (!cleanMessage) {
      clearAllTimers();
      currentMsgRef.current = "";
      setOpacity(0);
      fadeOutTimerRef.current = setTimeout(() => {
        setVisible(false);
        isVisibleRef.current = false;
        setDisplayed("");
      }, 500);
      return clearAllTimers;
    }

    clearAllTimers();

    if (isVisibleRef.current) {
      // Fade out the old caption first, then start the new one
      setOpacity(0);
      fadeOutTimerRef.current = setTimeout(() => {
        startTyping(cleanMessage);
      }, 300);
    } else {
      startTyping(cleanMessage);
    }

    return clearAllTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanMessage]);

  if (!visible) return null;

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
            // Clamp to maxLines — no manual line-stacking needed
            display: "-webkit-box",
            WebkitLineClamp: captionStyle.maxLines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            margin: 0,
          } as React.CSSProperties}
        >
          {displayed}
        </p>
      </div>
    </div>
  );
};
