import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CaptionStyle,
  DEFAULT_CAPTION_STYLE,
  captionFontStyle,
  hexToRgba,
} from "./captionSettings";

export { DEFAULT_CAPTION_STYLE } from "./captionSettings";
export type { CaptionStyle } from "./captionSettings";

type Props = {
  message: string;
  captionStyle?: CaptionStyle;
  // Twitch username the AI is currently answering. Pass null/undefined when
  // Twitch isn't connected (or the message didn't come from chat) and the
  // "RESPONDING TO …" header is simply omitted.
  respondingTo?: string | null;
};

type Phase = "visible" | "fading" | "hidden";

const LINES_PER_PAGE = 2;
const PAGE_HOLD_MS = 1200; // how long a full page stays before the next one
const PAGE_FADE_MS = 280;  // fade-out of the old page
const WORD_ANIM_MS = 260;  // duration of one word's fade-in (see .cap-word)

// Split into reveal tokens: whole words (keeping the trailing space), but
// CJK text has no spaces, so it is split per character.
const CJK = /[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]/;
function tokenize(text: string): string[] {
  const raw = text.match(/\S+\s*/g) ?? [];
  const out: string[] = [];
  for (const tok of raw) {
    if (CJK.test(tok)) {
      const trimmed = tok.trimEnd();
      const tail = tok.slice(trimmed.length);
      const chars = Array.from(trimmed);
      chars.forEach((c, i) => out.push(i === chars.length - 1 ? c + tail : c));
    } else {
      out.push(tok);
    }
  }
  return out;
}

export const AssistantText = ({
  message,
  captionStyle = DEFAULT_CAPTION_STYLE,
  respondingTo = null,
}: Props) => {
  // The (cleaned) message currently on screen
  const [shownText, setShownText] = useState("");
  const [phase, setPhase] = useState<Phase>("hidden");
  // Who the on-screen message is answering — snapshotted when the message
  // starts, because the Twitch queue clears the active user as soon as the
  // TTS finishes while the caption is still lingering.
  const [speaker, setSpeaker] = useState<string | null>(null);

  // Pagination (2 lines per page)
  const [pages, setPages] = useState<string[][]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeMsgRef  = useRef("");
  const pendingMsgRef = useRef("");
  const phaseRef      = useRef<Phase>("hidden");
  const measureRef    = useRef<HTMLParagraphElement | null>(null);
  const styleRef      = useRef(captionStyle);
  styleRef.current = captionStyle;

  const setPhaseSync = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const clearAllTimers = () => {
    if (lingerTimerRef.current) { clearTimeout(lingerTimerRef.current); lingerTimerRef.current = null; }
    if (fadeTimerRef.current)   { clearTimeout(fadeTimerRef.current);   fadeTimerRef.current   = null; }
    if (pageTimerRef.current)   { clearTimeout(pageTimerRef.current);   pageTimerRef.current   = null; }
  };

  // Strip emotion/pose/TTS tags like [happy] or [laughs] from the caption.
  const clean = (msg: string) => msg.replace(/\[([a-zA-Z_ ]*?)\]/g, "").trim();

  const hideNow = () => {
    activeMsgRef.current = "";
    setShownText("");
    setPages([]);
    setPhaseSync("hidden");
  };

  // ── Linger → disappear after the last page has finished ─────────────────
  const scheduleLinger = (text: string) => {
    const cs = styleRef.current;
    if (!cs.lingerDuration) return; // 0 = stay until next message
    const FADE_MS = cs.fadeOut ? 500 : 0;

    lingerTimerRef.current = setTimeout(() => {
      if (activeMsgRef.current !== text) return;
      if (FADE_MS > 0) {
        setPhaseSync("fading");
        fadeTimerRef.current = setTimeout(() => {
          if (activeMsgRef.current !== text) return;
          hideNow();
        }, FADE_MS);
      } else {
        hideNow();
      }
    }, cs.lingerDuration * 1000);
  };

  // ── Run the page sequence: fade words in → hold → fade page out → next ──
  const runPages = (allPages: string[][], text: string, i: number) => {
    if (activeMsgRef.current !== text) return;
    const cs = styleRef.current;
    setPageIdx(i);
    setLeaving(false);

    const words = allPages[i].length;
    const revealMs = cs.wordFade ? words * cs.wordFadeSpeed + WORD_ANIM_MS : 0;
    const isLast = i >= allPages.length - 1;

    if (isLast) {
      pageTimerRef.current = setTimeout(() => scheduleLinger(text), revealMs);
      return;
    }

    pageTimerRef.current = setTimeout(() => {
      if (activeMsgRef.current !== text) return;
      setLeaving(true);
      pageTimerRef.current = setTimeout(
        () => runPages(allPages, text, i + 1),
        PAGE_FADE_MS
      );
    }, revealMs + PAGE_HOLD_MS);
  };

  // ── Measure how the text wraps, then chunk it into 2-line pages ─────────
  // The hidden measuring <div> renders every token in the same font/width as
  // the visible text; tokens sharing an offsetTop are on the same line.
  const measureAndStart = () => {
    const host = measureRef.current;
    const text = activeMsgRef.current;
    if (!host || !text) return;

    if (pageTimerRef.current) { clearTimeout(pageTimerRef.current); pageTimerRef.current = null; }
    if (lingerTimerRef.current) { clearTimeout(lingerTimerRef.current); lingerTimerRef.current = null; }

    const spans = Array.from(host.children) as HTMLElement[];
    const lines: string[][] = [];
    let lastTop = -1;
    for (const sp of spans) {
      const top = Math.round(sp.offsetTop);
      if (lines.length === 0 || Math.abs(top - lastTop) > 2) {
        lines.push([]);
        lastTop = top;
      }
      lines[lines.length - 1].push(sp.textContent ?? "");
    }

    const next: string[][] = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
      next.push(lines.slice(i, i + LINES_PER_PAGE).flat());
    }
    if (next.length === 0) next.push([text]);

    setPages(next);
    runPages(next, text, 0);
  };

  // Re-measure whenever the text or anything that affects wrapping changes.
  useLayoutEffect(() => {
    if (!shownText) return;
    measureAndStart();
    // Web fonts load async; re-measure once Hachi Maru Pop is actually ready
    // (otherwise the fallback font's line breaks would decide the pages).
    let cancelled = false;
    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        if (!cancelled && activeMsgRef.current === shownText) measureAndStart();
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shownText,
    captionStyle.fontSize,
    captionStyle.fontFamily,
    captionStyle.bold,
    captionStyle.italic,
    captionStyle.boxed,
    captionStyle.wordFade,
    captionStyle.wordFadeSpeed,
  ]);

  // ── Begin a new message ─────────────────────────────────────────────────
  const beginMessage = (text: string) => {
    activeMsgRef.current  = text;
    pendingMsgRef.current = "";
    setPages([]);
    setPageIdx(0);
    setLeaving(false);
    setShownText(text); // the layout effect measures + starts pages
    setPhaseSync("visible");
  };

  const showMessage = (text: string) => {
    clearAllTimers();

    if (phaseRef.current === "hidden") {
      beginMessage(text);
      return;
    }

    // Visible or mid-fade → fade the current one out, then show the new one
    pendingMsgRef.current = text;
    const FADE_MS = captionStyle.fadeOut ? 300 : 0;

    if (FADE_MS > 0) {
      setPhaseSync("fading");
      fadeTimerRef.current = setTimeout(() => {
        const next = pendingMsgRef.current;
        hideNow();
        if (next) beginMessage(next);
      }, FADE_MS);
    } else {
      hideNow();
      beginMessage(text);
    }
  };

  // ── React to message prop changes ───────────────────────────────────────
  useEffect(() => {
    if (!captionStyle.enabled) {
      clearAllTimers();
      return clearAllTimers;
    }

    const cleanMsg = clean(message);

    if (!cleanMsg) {
      clearAllTimers();
      pendingMsgRef.current = "";
      if (phaseRef.current !== "hidden") {
        const FADE_MS = captionStyle.fadeOut ? 400 : 0;
        if (FADE_MS > 0) {
          setPhaseSync("fading");
          fadeTimerRef.current = setTimeout(hideNow, FADE_MS);
        } else {
          hideNow();
        }
      }
      return clearAllTimers;
    }

    setSpeaker(respondingTo ?? null);
    showMessage(cleanMsg);
    return clearAllTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!captionStyle.enabled || phase === "hidden") return null;

  const positionClass =
    captionStyle.position === "top"
      ? "top-24 bottom-auto"
      : captionStyle.position === "middle"
      ? "top-1/2 -translate-y-1/2 bottom-auto"
      : "bottom-[88px]";

  const textShadow = `0 0 ${captionStyle.shadowBlur}px ${captionStyle.shadowColor}, 0 2px 0 ${captionStyle.shadowColor}`;
  const strokeStyle: React.CSSProperties = captionStyle.strokeWidth
    ? {
        WebkitTextStroke: `${captionStyle.strokeWidth}px ${captionStyle.strokeColor}`,
        paintOrder: "stroke fill",
      }
    : {};

  const textStyle: React.CSSProperties = {
    ...captionFontStyle(captionStyle),
    fontSize: `${captionStyle.fontSize}px`,
    color: captionStyle.textColor,
    textShadow,
    lineHeight: 1.35,
    letterSpacing: "0.01em",
    textAlign: "center",
    ...strokeStyle,
  };

  const boxStyle: React.CSSProperties = captionStyle.boxed
    ? {
        background: hexToRgba(captionStyle.boxColor, captionStyle.boxOpacity),
        border: "3px solid rgba(255,255,255,0.75)",
        borderRadius: 20,
        padding: "10px 22px 12px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
      }
    : {
        background:
          captionStyle.bgOpacity > 0 ? `rgba(0,0,0,${captionStyle.bgOpacity})` : "transparent",
        borderRadius: captionStyle.bgOpacity > 0 ? 8 : undefined,
        padding: captionStyle.bgOpacity > 0 ? "8px 16px" : undefined,
      };

  const fadeDuration = captionStyle.fadeOut ? 500 : 0;
  const opacity = phase === "visible" ? 1 : 0;
  const page = pages[pageIdx] ?? [];
  const tokens = tokenize(shownText);
  const showHeader = captionStyle.boxed && !!speaker;

  return (
    <div
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none px-16 ${positionClass}`}
      style={{
        opacity,
        transition: phase === "fading" ? `opacity ${fadeDuration}ms ease` : "opacity 200ms ease",
      }}
    >
      <div className="w-full" style={{ maxWidth: 760, ...boxStyle }}>
        {showHeader && (
          <div
            style={{
              ...captionFontStyle(captionStyle),
              fontSize: Math.max(10, Math.round(captionStyle.fontSize * 0.4)),
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.88)",
              textAlign: "center",
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            Responding to {speaker}:
          </div>
        )}

        <div className="relative">
          {/* Hidden measuring copy: same width + font, used only to find line breaks */}
          <p
            ref={measureRef}
            aria-hidden
            style={{
              ...textStyle,
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              visibility: "hidden",
              pointerEvents: "none",
              textAlign: "center",
              margin: 0,
            }}
          >
            {tokens.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </p>

          {/* Visible page: ≤ 2 lines, words fade in one after another */}
          <p
            key={pageIdx}
            style={{
              ...textStyle,
              margin: 0,
              opacity: leaving ? 0 : 1,
              transition: `opacity ${PAGE_FADE_MS}ms ease`,
            }}
          >
            {page.map((w, i) => (
              <span
                key={`${pageIdx}-${i}`}
                className={captionStyle.wordFade ? "cap-word" : undefined}
                style={
                  captionStyle.wordFade
                    ? { animationDelay: `${i * captionStyle.wordFadeSpeed}ms` }
                    : undefined
                }
              >
                {w}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
};
