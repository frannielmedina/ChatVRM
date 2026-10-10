// ─────────────────────────────────────────────────────────────────────────────
// Keeps ONE tab "in charge" at a time.
//
// The streamer window and the normal window are the same app. If both stayed
// alive they'd both connect to Twitch, both answer chat and both talk — so
// the tab that was opened last (or whose "Resume here" button was pressed)
// *claims* control, and any other active tab steps aside into a standby
// screen. Twitch/Discord connections are handed over to the new owner so the
// stream doesn't lose chat.
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_NAME = "chatvrm-link-v1";
export const STANDBY_KEY = "chatVRM_standby"; // sessionStorage: this tab is on standby
export const CLAIM_ON_LOAD_KEY = "chatVRM_claimOnLoad"; // sessionStorage: claim when the app mounts

export const TAB_ID =
  typeof window !== "undefined"
    ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    : "ssr";

export type LinkMessage =
  | { type: "claim"; from: string; streamer: boolean }
  | { type: "handoff"; from: string; to: string; twitch: boolean; discord: boolean }
  | { type: "released"; from: string };

export function createLink(onMessage: (msg: LinkMessage) => void) {
  if (typeof BroadcastChannel === "undefined") {
    return { post: (_m: LinkMessage) => {}, close: () => {} };
  }
  const ch = new BroadcastChannel(CHANNEL_NAME);
  ch.onmessage = (e: MessageEvent<LinkMessage>) => {
    if (e.data && e.data.from !== TAB_ID) onMessage(e.data);
  };
  return {
    post: (m: LinkMessage) => ch.postMessage(m),
    close: () => ch.close(),
  };
}

export function isStreamerUrl(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("streamer") === "1";
}

/** Opens (or focuses) the streamer window. MUST be called directly from a click handler or the popup blocker eats it. */
export function openStreamerWindow(asPopupWindow = false): Window | null {
  const url = new URL(window.location.href);
  url.searchParams.set("streamer", "1");
  // A script-opened popup window (unlike a tab) can be resized by the page —
  // which makes the "resize window to 1280×720" buttons actually work.
  const win = window.open(
    url.toString(),
    "chatvrm-streamer",
    asPopupWindow ? "popup=yes,width=1280,height=760,resizable=yes" : undefined
  );
  win?.focus();
  return win;
}
