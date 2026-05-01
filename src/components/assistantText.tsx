import { useEffect, useState, useRef } from "react";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "./captionSettings";

export { DEFAULT_CAPTION_STYLE } from "./captionSettings";
export type { CaptionStyle } from "./captionSettings";

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanMessage = message.replace(/\[([a-zA-Z]*?)\]/g, "").trim();

  // Typewriter effect
  useEffect(() => {
    if (!cleanMessage) {
      setDisplayed("");
      return;
    }
    if (captionStyle.typewriterSpeed === 0) {
      setDisplayed(cleanMessage);
      return;
    }

    setDisplayed("");
    setIsTyping(true);
    let i = 0;

    const tick = () => {
      i++;
      setDisplayed(cleanMessage.slice(0, i));
      if (i < cleanMessage.length) {
        timerRef.current = setTimeout(tick, captionStyle.typewriterSpeed);
      } else {
        setIsTyping(false);
      }
    };

    timerRef.current = setTimeout(tick, captionStyle.typewriterSpeed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanMessage]);

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

  // SVG text stroke via CSS paint-order + webkit-text-stroke
  const strokeStyle: React.CSSProperties = {
    WebkitTextStroke: `${captionStyle.strokeWidth}px ${captionStyle.strokeColor}`,
    paintOrder: "stroke fill",
  };

  return (
    <div
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none px-16 ${positionClass}`}
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
