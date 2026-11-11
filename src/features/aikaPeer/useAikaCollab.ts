// ── Orchestrates a collab with Aika ──────────────────────────────────────────
// WebSocket client  ⇄  turn-taking  ⇄  widget bridge (avatar + audio on stream)
import { useCallback, useEffect, useRef, useState } from "react";
import { AikaPeerClient, PeerStatus, buildPeerUrl } from "./aikaPeerClient";
import {
  AikaPeerConfig, aikaMoodToExpression, emotionToAikaMood,
} from "./aikaPeerConfig";
import { WidgetSender, getWidgetPeerId } from "./widgetBridge";

export type GuestLine = {
  text: string;
  expression: "neutral" | "happy" | "angry" | "sad" | "relaxed";
  pose?: string;
  style: string;
  audio: ArrayBuffer;
};

export type GenerateGuestLine = (opts: {
  incoming: string | null;       // Aika's last message, null = opening line
  aikaMood?: string;
  expressionHint: string;
}) => Promise<GuestLine | null>;

const SOFT_CAP_MS = 3.5 * 60 * 1000;   // guide: hard cap ≈ 4 min → leave politely first
const NO_REPLY_TIMEOUT_MS = 25000;     // "some messages get no reply at all"
const AIKA_VOICE_WAIT_MS = 15000;      // don't wait forever for voice_end

export function useAikaCollab(config: AikaPeerConfig, generateLine: GenerateGuestLine) {
  const [status, setStatus] = useState<PeerStatus>("offline");
  const [statusDetail, setStatusDetail] = useState("");
  const [canKnock, setCanKnock] = useState(false);
  const [inSession, setInSession] = useState(false);
  const [widgetViewers, setWidgetViewers] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const cfgRef = useRef(config);
  const genRef = useRef(generateLine);
  useEffect(() => { cfgRef.current = config; }, [config]);
  useEffect(() => { genRef.current = generateLine; }, [generateLine]);

  const clientRef = useRef<AikaPeerClient | null>(null);
  const senderRef = useRef<WidgetSender | null>(null);
  const sessionRef = useRef({ active: false, awaiting: false, startedAt: 0, turnId: 0 });
  const timers = useRef<{ noReply?: ReturnType<typeof setTimeout>; cap?: ReturnType<typeof setTimeout>; voice?: ReturnType<typeof setTimeout> }>({});
  const pendingAika = useRef<{ text: string; mood?: string } | null>(null);
  const aikaSpeaking = useRef(false);
  const mikoBusyUntil = useRef(0);
  const readyRef = useRef(false);
  const runTurnRef = useRef<(incoming: string | null, mood?: string) => void>(() => {});

  const addLog = useCallback((line: string) => {
    const t = new Date().toLocaleTimeString();
    setLog((l) => [...l.slice(-40), `${t}  ${line}`]);
  }, []);

  const clearTimers = () => {
    Object.values(timers.current).forEach((t) => t && clearTimeout(t));
    timers.current = {};
  };

  // ── One Miko turn: think → TTS → widget speaks → text goes to Aika ─────────
  const runTurn = useCallback(async (incoming: string | null, mood?: string) => {
    const s = sessionRef.current;
    if (!s.active) return;
    const myTurn = ++s.turnId;
    const line = await genRef.current({
      incoming, aikaMood: mood, expressionHint: aikaMoodToExpression(mood),
    }).catch((e) => { console.error("[aika] generate failed", e); return null; });
    if (!s.active || myTurn !== s.turnId || !line) {
      if (s.active && !line) addLog("⚠ couldn't generate a line (check AI/TTS settings)");
      return;
    }
    senderRef.current?.send({
      t: "speak", expression: line.expression, pose: line.pose,
      style: line.style, text: line.text, audio: line.audio,
    });
    mikoBusyUntil.current = Date.now() + Math.max(2500, line.text.length * 70);
    const sent = clientRef.current?.sendMessage(line.text, emotionToAikaMood(line.expression));
    addLog(`Miko → ${sent ? "" : "(NOT sent) "}${line.text}`);
    // If Aika never answers, don't hang forever.
    if (timers.current.noReply) clearTimeout(timers.current.noReply);
    timers.current.noReply = setTimeout(() => {
      addLog("Aika didn't answer — ending session");
      clientRef.current?.endSession();
    }, NO_REPLY_TIMEOUT_MS);
  }, [addLog]);
  useEffect(() => { runTurnRef.current = runTurn; }, [runTurn]);

  const maybeStartNextTurn = useCallback(() => {
    const s = sessionRef.current;
    const msg = pendingAika.current;
    if (!s.active || !msg || aikaSpeaking.current) return;
    pendingAika.current = null;
    // Let Miko's own line finish before replying so voices don't stack.
    const wait = Math.max(0, mikoBusyUntil.current - Date.now());
    setTimeout(() => runTurnRef.current(msg.text, msg.mood), wait + 400);
  }, []);

  const endLocalSession = useCallback(() => {
    const s = sessionRef.current;
    s.active = false; s.awaiting = false; s.turnId++;
    clearTimers();
    pendingAika.current = null;
    aikaSpeaking.current = false;
    setInSession(false);
    // Let Aika's sign-off breathe, then hide Miko.
    setTimeout(() => senderRef.current?.send({ t: "hide" }), 3000);
  }, []);

  // ── Public controls ────────────────────────────────────────────────────────
  const requestSession = useCallback(() => {
    const s = sessionRef.current;
    if (s.active || s.awaiting) return;
    s.awaiting = true;
    clientRef.current?.requestSession();
    addLog("knocking (ai_talk_start)…");
  }, [addLog]);

  const endSession = useCallback(() => {
    clientRef.current?.endSession();
    addLog("ending session");
  }, [addLog]);

  const connect = useCallback(async () => {
    const cfg = cfgRef.current;
    if (!cfg.token.trim()) { addLog("Enter your token first."); return; }
    clientRef.current?.disconnect();
    if (!senderRef.current) {
      const sender = new WidgetSender();
      sender.onViewers = setWidgetViewers;
      senderRef.current = sender;
    }
    senderRef.current.start().catch((e) => addLog(`widget link: ${e?.message || e}`));

    const client = new AikaPeerClient(
      () => buildPeerUrl(cfgRef.current.serverUrl, cfgRef.current.token.trim(), cfgRef.current.testMode),
      {
        status: (st, d) => { setStatus(st); setStatusDetail(d || ""); if (st !== "connected") { readyRef.current = false; setCanKnock(false); } },
        log: addLog,
        ready: () => {
          readyRef.current = true; setCanKnock(true); addLog("Aika has budget — you may knock");
          if (cfgRef.current.autoSession) requestSession();
        },
        sessionStart: () => {
          const s = sessionRef.current;
          if (!s.awaiting && !s.active) return;       // another guest's session
          s.awaiting = false; s.active = true; s.startedAt = Date.now();
          readyRef.current = false; setCanKnock(false); setInSession(true);
          senderRef.current?.send({ t: "show" });
          addLog("session open — Miko is on stage");
          timers.current.cap = setTimeout(() => { addLog("soft cap reached — leaving"); clientRef.current?.endSession(); }, SOFT_CAP_MS);
          runTurnRef.current(null);
        },
        sessionEnd: () => {
          const s = sessionRef.current;
          if (s.awaiting) { s.awaiting = false; addLog("Aika's budget is empty — wait for the next ready"); return; }
          if (!s.active) return;                      // someone else's session
          addLog("session ended");
          endLocalSession();
        },
        aikaMessage: (text, mood) => {
          if (!sessionRef.current.active) return;
          if (timers.current.noReply) clearTimeout(timers.current.noReply);
          addLog(`Aika → ${text}`);
          pendingAika.current = { text, mood };
          // Real voice_start usually follows; if it never does, don't stall.
          if (timers.current.voice) clearTimeout(timers.current.voice);
          timers.current.voice = setTimeout(() => { aikaSpeaking.current = false; maybeStartNextTurn(); }, AIKA_VOICE_WAIT_MS);
        },
        voiceStart: () => { aikaSpeaking.current = true; },
        voiceEnd: () => {
          aikaSpeaking.current = false;
          if (timers.current.voice) clearTimeout(timers.current.voice);
          maybeStartNextTurn();
        },
      }
    );
    clientRef.current = client;
    client.connect();
  }, [addLog, endLocalSession, maybeStartNextTurn, requestSession]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    endLocalSession();
    senderRef.current?.send({ t: "hide" });
    setCanKnock(false);
  }, [endLocalSession]);

  useEffect(() => () => {
    clientRef.current?.disconnect();
    senderRef.current?.stop();
    clearTimers();
  }, []);

  const widgetUrl = () => {
    const u = new URL("/aika-widget/", window.location.origin);
    u.searchParams.set("peer", getWidgetPeerId());
    if (cfgRef.current.vrmUrl.trim()) u.searchParams.set("vrm", cfgRef.current.vrmUrl.trim());
    return u.toString();
  };

  return { status, statusDetail, canKnock, inSession, widgetViewers, log, connect, disconnect, requestSession, endSession, widgetUrl };
}
