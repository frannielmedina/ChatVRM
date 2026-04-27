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

type RollingLine = {
  id: number;
  text: string;
  displayed: string; // typewriter progress
  done: boolean;     // typing finished
};

let _lineIdCounter = 0;

type Props = {
  message: string;
  captionStyle?: CaptionStyle;
};

export const AssistantText = ({
  message,
  captionStyle = DEFAULT_CAPTION_STYLE,
}: Props) => {
  // Rolling lines on screen, oldest first
  const [lines, setLines] = useState<RollingLine[]>([]);
  const [visible, setVisible] = useState(false);

  const styleRef = useRef(captionStyle);
  useEffect(() => { styleRef.current = captionStyle; }, [captionStyle]);

  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<number>(-1);
  const abortRef = useRef(false);

  const cleanMessage = message.replace(/\[([a-zA-Z]*?)\]/g, "").trim();

  const clearTimers = () => {
    if (typeTimerRef.current) { clearTimeout(typeTimerRef.current); typeTimerRef.current = null; }
    if (lingerTimerRef.current) { clearTimeout(lingerTimerRef.current); lingerTimerRef.current = null; }
  };

  const startLinger = (id: number) => {
    const dur = styleRef.current.lingerDuration;
    if (dur <= 0) return; // stay until next message
    lingerTimerRef.current = setTimeout(() => {
      if (activeIdRef.current !== id) return;
      setVisible(false);
      setTimeout(() => {
        if (activeIdRef.current !== id) return;
        setLines([]);
      }, 350);
    }, dur);
  };

  useEffect(() => {
    abortRef.current = true;
    clearTimers();

    if (!cleanMessage) {
      setVisible(false);
      setTimeout(() => setLines([]), 350);
      return () => { abortRef.current = true; clearTimers(); };
    }

    const id = ++_lineIdCounter;
    activeIdRef.current = id;
    abortRef.current = false;

    const maxLines = styleRef.current.maxLines;

    // Add the new line, evicting the oldest if we're at capacity
    setLines((prev) => {
      const trimmed = prev.slice(-(maxLines - 1));
      return [...trimmed, { id, text: cleanMessage, displayed: "", done: false }];
    });
    setVisible(true);

    const speed = styleRef.current.typewriterSpeed;

    if (speed === 0) {
      setLines((prev) =>
        prev.map((l) => l.id === id ? { ...l, displayed: cleanMessage, done: true } : l)
      );
      startLinger(id);
      return () => { abortRef.current = true; clearTimers(); };
    }

    let i = 0;
    const tick = () => {
      if (abortRef.current || activeIdRef.current !== id) return;
      i++;
      const slice = cleanMessage.slice(0, i);
      const done = i >= cleanMessage.length;
      setLines((prev) =>
        prev.map((l) => l.id === id ? { ...l, displayed: slice, done } : l)
      );
      if (!done) {
        typeTimerRef.current = setTimeout(tick, speed);
      } else {
        startLinger(id);
      }
    };
    typeTimerRef.current = setTimeout(tick, speed);

    return () => { abortRef.current = true; clearTimers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanMessage]);

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
  ].join(", ");

  const lineCount = lines.length;

  return (
    <div
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none px-24 ${positionClass}`}
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          background:
            captionStyle.bgOpacity > 0
              ? `rgba(0,0,0,${captionStyle.bgOpacity})`
              : "transparent",
          borderRadius: captionStyle.bgOpacity > 0 ? "8px" : undefined,
          padding: captionStyle.bgOpacity > 0 ? "8px 20px" : undefined,
        }}
      >
        {lines.map((line, idx) => {
          // Oldest lines are more faded; newest (idx === lineCount-1) is fully opaque
          const age = lineCount - 1 - idx; // 0 = newest
          const opacity = age === 0 ? 1 : Math.max(0.3, 1 - age * 0.28);

          return (
            <p
              key={line.id}
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
                wordBreak: "break-word",
                whiteSpace: "normal",
                margin: 0,
                opacity,
                transition: "opacity 0.3s ease",
              } as React.CSSProperties}
            >
              {line.displayed}
            </p>
          );
        })}
      </div>
    </div>
  );
};
