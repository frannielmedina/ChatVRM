import { useEffect, useRef, useState, useCallback } from "react";

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
  maxLines: number; // NEW: rolling window size (1–5)
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
  maxLines: 3, // default: rolling 3 lines
};

type Props = {
  message: string;
  captionStyle?: CaptionStyle;
};

let lineIdCounter = 0;

export const AssistantText = ({
  message,
  captionStyle = DEFAULT_CAPTION_STYLE,
}: Props) => {
  const maxLines = captionStyle.maxLines ?? 3;

  // Each entry: { id, text, displayed, isTyping, visible }
  const [lines, setLines] = useState<
    {
      id: number;
      text: string;
      displayed: string;
      isTyping: boolean;
      visible: boolean;
    }[]
  >([]);

  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLineIdRef = useRef<number | null>(null);

  const cleanMessage = message.replace(/\[([a-zA-Z]*?)\]/g, "").trim();

  // When a new message arrives, add it as a new line and trim old ones
  useEffect(() => {
    if (!cleanMessage) {
      setLines([]);
      return;
    }

    // Clear any pending linger/typewriter for previous lines
    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current);

    const newId = ++lineIdCounter;
    latestLineIdRef.current = newId;

    setLines((prev) => {
      // Keep only the last (maxLines - 1) visible lines, add new one
      const kept = prev.slice(-(maxLines - 1));
      return [
        ...kept,
        { id: newId, text: cleanMessage, displayed: "", isTyping: true, visible: true },
      ];
    });

    // Typewriter effect for the new line
    const speed = captionStyle.typewriterSpeed;

    if (speed === 0) {
      setLines((prev) =>
        prev.map((l) =>
          l.id === newId ? { ...l, displayed: cleanMessage, isTyping: false } : l
        )
      );
      scheduleLinger(newId);
      return;
    }

    let i = 0;
    const tick = () => {
      i++;
      const slice = cleanMessage.slice(0, i);
      setLines((prev) =>
        prev.map((l) =>
          l.id === newId ? { ...l, displayed: slice } : l
        )
      );
      if (i < cleanMessage.length) {
        typeTimerRef.current = setTimeout(tick, speed);
      } else {
        setLines((prev) =>
          prev.map((l) =>
            l.id === newId ? { ...l, isTyping: false } : l
          )
        );
        scheduleLinger(newId);
      }
    };
    typeTimerRef.current = setTimeout(tick, speed);

    return () => {
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanMessage]);

  // When maxLines changes, trim existing lines
  useEffect(() => {
    setLines((prev) => prev.slice(-maxLines));
  }, [maxLines]);

  const scheduleLinger = useCallback(
    (id: number) => {
      if (captionStyle.lingerDuration <= 0) return; // stay forever
      lingerTimerRef.current = setTimeout(() => {
        setLines((prev) =>
          prev.map((l) => (l.id === id ? { ...l, visible: false } : l))
        );
        // After fade, remove from DOM
        setTimeout(() => {
          setLines((prev) => prev.filter((l) => l.id !== id));
        }, 750);
      }, captionStyle.lingerDuration);
    },
    [captionStyle.lingerDuration]
  );

  if (lines.length === 0) return null;

  const positionClass =
    captionStyle.position === "top"
      ? "top-24 bottom-auto"
      : captionStyle.position === "middle"
      ? "top-1/2 -translate-y-1/2 bottom-auto"
      : "bottom-[88px]";

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
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none px-16 ${positionClass}`}
    >
      <div
        className="max-w-3xl w-full flex flex-col items-center gap-1"
        style={{
          background:
            captionStyle.bgOpacity > 0
              ? `rgba(0,0,0,${captionStyle.bgOpacity})`
              : "transparent",
          borderRadius: captionStyle.bgOpacity > 0 ? "8px" : undefined,
          padding: captionStyle.bgOpacity > 0 ? "8px 16px" : undefined,
        }}
      >
        {lines.map((line, idx) => {
          // Older lines are more faded
          const isNewest = idx === lines.length - 1;
          const age = lines.length - 1 - idx; // 0 = newest
          const ageOpacity = isNewest ? 1 : Math.max(0.35, 1 - age * 0.25);

          return (
            <p
              key={line.id}
              style={{
                fontSize: `${captionStyle.fontSize}px`,
                fontFamily: `'${captionStyle.fontFamily}', 'M PLUS 2', sans-serif`,
                fontWeight: 800,
                color: captionStyle.textColor,
                textShadow,
                lineHeight: 1.35,
                letterSpacing: "0.01em",
                textAlign: "center",
                opacity: line.visible ? ageOpacity : 0,
                transition: "opacity 0.7s ease",
                ...strokeStyle,
              }}
            >
              {line.displayed}
              {line.isTyping && (
                <span
                  className="inline-block animate-pulse"
                  style={{ opacity: 0.7, marginLeft: 2 }}
                >
                  ▌
                </span>
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
};
