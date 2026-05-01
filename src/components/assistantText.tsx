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
  // What is currently rendered on screen
  const [displayed, setDisplayed] = useState("");
  // "visible" | "fading" | "hidden"
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">("hidden");

  // All mutable bookkeeping lives in refs so timer callbacks never capture
  // stale closure values.
  const typeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The message we are currently typing / showing
  const activeMsgRef  = useRef("");
  // A message that arrived while we were fading out; show it once fade ends
  const pendingMsgRef = useRef("");
  // Mirror of `phase` accessible inside timer callbacks without re-rendering
  const phaseRef      = useRef<"visible" | "fading" | "hidden">("hidden");

  const setPhaseSync = (p: "visible" | "fading" | "hidden") => {
    phaseRef.current = p;
    setPhase(p);
  };

  const clearAllTimers = () => {
    if (typeTimerRef.current)   { clearTimeout(typeTimerRef.current);   typeTimerRef.current   = null; }
    if (lingerTimerRef.current) { clearTimeout(lingerTimerRef.current); lingerTimerRef.current = null; }
    if (fadeTimerRef.current)   { clearTimeout(fadeTimerRef.current);   fadeTimerRef.current   = null; }
  };

  // Strip emotion tags like [happy]
  const clean = (msg: string) => msg.replace(/\[([a-zA-Z]*?)\]/g, "").trim();

  // ── Schedule the linger → disappear sequence ────────────────────────────
  const scheduleLinger = (text: string) => {
    // lingerDuration 0 means "stay until next message"
    if (!captionStyle.lingerDuration) return;

    const lingerMs = captionStyle.lingerDuration * 1000;
    const FADE_MS  = captionStyle.fadeOut ? 500 : 0;

    lingerTimerRef.current = setTimeout(() => {
      // Make sure we are still showing the same message
      if (activeMsgRef.current !== text) return;

      if (FADE_MS > 0) {
        setPhaseSync("fading");
        fadeTimerRef.current = setTimeout(() => {
          if (activeMsgRef.current !== text) return;
          activeMsgRef.current = "";
          setDisplayed("");
          setPhaseSync("hidden");
        }, FADE_MS);
      } else {
        // Instant cut
        activeMsgRef.current = "";
        setDisplayed("");
        setPhaseSync("hidden");
      }
    }, lingerMs);
  };

  // ── Begin typing (or instant-show) a message ────────────────────────────
  const beginMessage = (text: string) => {
    activeMsgRef.current  = text;
    pendingMsgRef.current = "";
    setDisplayed("");
    setPhaseSync("visible");

    if (!captionStyle.typewriterEnabled) {
      // Instant reveal
      setDisplayed(text);
      scheduleLinger(text);
      return;
    }

    // Typewriter
    let i = 0;
    const speed = captionStyle.typewriterSpeed;
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

  // ── Show a new message (handles transition from current state) ───────────
  const showMessage = (text: string) => {
    clearAllTimers();

    if (phaseRef.current === "hidden") {
      beginMessage(text);
      return;
    }

    // Currently visible or mid-fade — queue and fade out current
    pendingMsgRef.current = text;
    const FADE_MS = captionStyle.fadeOut ? 300 : 0;

    if (FADE_MS > 0) {
      setPhaseSync("fading");
      fadeTimerRef.current = setTimeout(() => {
        const next = pendingMsgRef.current;
        activeMsgRef.current = "";
        setDisplayed("");
        setPhaseSync("hidden");
        if (next) beginMessage(next);
      }, FADE_MS);
    } else {
      activeMsgRef.current = "";
      setDisplayed("");
      setPhaseSync("hidden");
      beginMessage(text);
    }
  };

  // ── React to message prop changes ────────────────────────────────────────
  useEffect(() => {
    const cleanMsg = clean(message);

    if (!cleanMsg) {
      // Empty message → clear
      clearAllTimers();
      pendingMsgRef.current = "";
      if (phaseRef.current !== "hidden") {
        const FADE_MS = captionStyle.fadeOut ? 400 : 0;
        if (FADE_MS > 0) {
          setPhaseSync("fading");
          fadeTimerRef.current = setTimeout(() => {
            activeMsgRef.current = "";
            setDisplayed("");
            setPhaseSync("hidden");
          }, FADE_MS);
        } else {
          activeMsgRef.current = "";
          setDisplayed("");
          setPhaseSync("hidden");
        }
      }
      return clearAllTimers;
    }

    showMessage(cleanMsg);
    return clearAllTimers;
    // We intentionally omit captionStyle from deps to avoid restarting mid-type;
    // the refs capture the latest values when timers fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (phase === "hidden") return null;

  // ── Position classes ────────────────────────────────────────────────────
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

  // Fade transition: 500 ms when fading, instant when appearing
  const fadeDuration = captionStyle.fadeOut ? 500 : 0;
  const opacity = phase === "visible" ? 1 : 0;

  return (
    <div
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none px-16 ${positionClass}`}
      style={{
        opacity,
        transition: phase === "fading"
          ? `opacity ${fadeDuration}ms ease`
          : "opacity 200ms ease",
      }}
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
          {/* Blinking cursor only while typewriter is mid-sentence */}
          {captionStyle.typewriterEnabled &&
            phase === "visible" &&
            displayed.length > 0 &&
            displayed.length < clean(message).length && (
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
