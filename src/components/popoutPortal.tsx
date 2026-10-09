import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const CONTROL_WINDOW_NAME = "chatvrm-streamer-controls";

/**
 * Opens the control-panel popup. MUST be called straight from a click handler —
 * browsers block `window.open` otherwise.
 */
export function openControlWindow(width = 520, height = 820): Window | null {
  const left = Math.max(0, window.screenX + window.outerWidth - width - 24);
  const top = Math.max(0, window.screenY + 40);
  const win = window.open(
    "",
    CONTROL_WINDOW_NAME,
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
  win?.focus();
  return win;
}

type Props = {
  win: Window;
  title: string;
  /** Called when the user closes the popup window. */
  onClosed: () => void;
  children: ReactNode;
};

/**
 * Renders React children into another browser window.
 *
 * Because the children are part of THIS React tree, they share the exact same
 * state, handlers and context as the main window (the Viewer, configs, …) —
 * the popup is a live second view of the same app, not a copy that has to be
 * kept in sync.
 */
export const PopoutPortal = ({ win, title, onClosed, children }: Props) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // StrictMode mounts effects twice in dev → be idempotent and never close the window here.
    let root = win.document.getElementById("popout-root");
    if (!root) {
      win.document.title = title;

      // Copy every stylesheet (Tailwind + fonts) so components look identical.
      document
        .querySelectorAll('link[rel="stylesheet"], style')
        .forEach((node) => win.document.head.appendChild(node.cloneNode(true)));

      win.document.documentElement.lang = document.documentElement.lang;
      win.document.body.className = document.body.className;
      win.document.body.style.margin = "0";
      win.document.body.style.backgroundImage = "none";
      win.document.body.style.backgroundColor = "#ffffff";

      root = win.document.createElement("div");
      root.id = "popout-root";
      root.className = "font-M_PLUS_2";
      win.document.body.appendChild(root);
    }
    setContainer(root);

    // Detect the user closing the popup.
    const poll = setInterval(() => {
      if (win.closed) {
        clearInterval(poll);
        onClosed();
      }
    }, 500);

    // If the streamer window goes away, take the control window with it.
    const closeWithOpener = () => {
      try { win.close(); } catch { /* ignore */ }
    };
    window.addEventListener("pagehide", closeWithOpener);

    return () => {
      clearInterval(poll);
      window.removeEventListener("pagehide", closeWithOpener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win]);

  return container ? createPortal(children, container) : null;
};
