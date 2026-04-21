import { useState, useEffect, useRef, useCallback } from "react";

export function useAutoHide(timeoutMs = 3000) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("mousedown", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("touchstart", resetTimer);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("mousedown", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
    };
  }, [resetTimer]);

  return visible;
}
