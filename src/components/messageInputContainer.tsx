import { MessageInput } from "@/components/messageInput";
import { useState, useEffect, useCallback, useRef } from "react";

const RESTART_DELAY_MS = 500;

// ── Global TTS-busy flag ──────────────────────────────────────────────────────
let _ttsSpeaking = false;
const _ttsListeners: Array<(v: boolean) => void> = [];

export function setTtsSpeaking(value: boolean) {
  _ttsSpeaking = value;
  _ttsListeners.forEach((fn) => fn(value));
}

export function isTtsSpeaking() {
  return _ttsSpeaking;
}

function useTtsSpeaking() {
  const [speaking, setSpeaking] = useState(_ttsSpeaking);
  useEffect(() => {
    _ttsListeners.push(setSpeaking);
    return () => {
      const i = _ttsListeners.indexOf(setSpeaking);
      if (i !== -1) _ttsListeners.splice(i, 1);
    };
  }, []);
  return speaking;
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  isChatProcessing: boolean;
  onChatProcessStart: (text: string) => void;
};

export const MessageInputContainer = ({
  isChatProcessing,
  onChatProcessStart,
}: Props) => {
  const [userMessage, setUserMessage]       = useState("");
  const [isMicRecording, setIsMicRecording] = useState(false);
  const [micSupported, setMicSupported]     = useState(true);

  const recognitionRef    = useRef<SpeechRecognition | null>(null);
  const runningRef        = useRef(false);
  const stoppingRef       = useRef(false);
  const micEnabledByUser  = useRef(false);
  // true = we auto-sent after speech ended → reopen mic after AI responds
  const autoSentRef       = useRef(false);
  const accumulatedText   = useRef("");

  // Countdown state for the 3-second send timer
  const [countdown, setCountdown]       = useState<number | null>(null);
  const sendTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef            = useRef<ReturnType<typeof setInterval> | null>(null);

  const onChatProcessStartRef = useRef(onChatProcessStart);
  const isChatProcessingRef   = useRef(isChatProcessing);
  useEffect(() => { onChatProcessStartRef.current = onChatProcessStart; }, [onChatProcessStart]);
  useEffect(() => { isChatProcessingRef.current   = isChatProcessing;   }, [isChatProcessing]);

  const ttsSpeaking = useTtsSpeaking();

  // ── Cancel pending auto-send countdown ────────────────────────────────────
  const cancelSendTimer = useCallback(() => {
    if (sendTimerRef.current) { clearTimeout(sendTimerRef.current); sendTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    setCountdown(null);
  }, []);

  // ── Stop mic raw ───────────────────────────────────────────────────────────
  const stopMicRaw = useCallback(() => {
    if (recognitionRef.current && runningRef.current) {
      stoppingRef.current = true;
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    runningRef.current = false;
    setIsMicRecording(false);
  }, []);

  // ── Start recognition ──────────────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (runningRef.current) return;
    if (_ttsSpeaking) return;
    if (isChatProcessingRef.current) return;

    accumulatedText.current = "";
    setUserMessage("");
    stoppingRef.current = false;

    try {
      recognitionRef.current.start();
      runningRef.current = true;
      setIsMicRecording(true);
    } catch (e) {
      console.warn("[mic] start() threw:", e);
      runningRef.current = false;
      setIsMicRecording(false);
    }
  }, []);

  // ── Start the 3-second countdown then send ────────────────────────────────
  const startSendCountdown = useCallback((text: string) => {
    cancelSendTimer();
    let secs = 3;
    setCountdown(secs);

    countdownIntervalRef.current = setInterval(() => {
      secs -= 1;
      if (secs <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setCountdown(null);
      } else {
        setCountdown(secs);
      }
    }, 1000);

    sendTimerRef.current = setTimeout(() => {
      setCountdown(null);
      if (text.trim()) {
        autoSentRef.current     = true;
        accumulatedText.current = "";
        setUserMessage("");
        onChatProcessStartRef.current(text.trim());
      }
    }, 3000);
  }, [cancelSendTimer]);

  // ── Build SpeechRecognition once ───────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setMicSupported(false);
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    // continuous: false → browser decides when you stop talking and fires onend
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final   = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        accumulatedText.current = (accumulatedText.current + " " + final).trim();
      }
      const displayed = interim
        ? (accumulatedText.current + " " + interim).trim()
        : accumulatedText.current;
      setUserMessage(displayed);
    };

    // onend fires automatically when the browser detects you stopped talking
    recognition.onend = () => {
      const wasIntentional = stoppingRef.current;
      stoppingRef.current = false;
      runningRef.current  = false;
      setIsMicRecording(false);

      if (wasIntentional) return; // we called stop() manually

      // Browser detected end of speech — start 3-second countdown then send
      const text = accumulatedText.current.trim();
      if (text) {
        startSendCountdown(text);
      } else if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
        // Nothing was said — just reopen the mic and keep listening
        setTimeout(() => startRecognition(), RESTART_DELAY_MS);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return;
      console.warn("[mic] error:", event.error);
      stoppingRef.current = false;
      runningRef.current  = false;
      setIsMicRecording(false);
      cancelSendTimer();
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micEnabledByUser.current = false;
        setMicSupported(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null as any;
      recognition.onend    = null as any;
      recognition.onerror  = null as any;
      if (runningRef.current) try { recognition.stop(); } catch (_) {}
      recognitionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TTS starts → stop mic ─────────────────────────────────────────────────
  useEffect(() => {
    if (ttsSpeaking && runningRef.current) {
      cancelSendTimer();
      stopMicRaw();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeaking]);

  // ── AI processing done → reopen mic if we auto-sent ───────────────────────
  useEffect(() => {
    if (!isChatProcessing && !_ttsSpeaking && micEnabledByUser.current && autoSentRef.current) {
      autoSentRef.current = false;
      const t = setTimeout(() => {
        if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
          startRecognition();
        }
      }, RESTART_DELAY_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatProcessing]);

  // ── TTS done → reopen mic if we auto-sent ─────────────────────────────────
  useEffect(() => {
    if (!ttsSpeaking && !isChatProcessing && micEnabledByUser.current && autoSentRef.current) {
      autoSentRef.current = false;
      const t = setTimeout(() => {
        if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
          startRecognition();
        }
      }, RESTART_DELAY_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeaking]);

  // ── Mic button ─────────────────────────────────────────────────────────────
  const handleClickMicButton = useCallback(() => {
    if (isMicRecording || countdown !== null) {
      // User turning off — cancel everything
      micEnabledByUser.current = false;
      autoSentRef.current      = false;
      cancelSendTimer();
      stopMicRaw();
    } else {
      micEnabledByUser.current = true;
      autoSentRef.current      = false;
      startRecognition();
    }
  }, [isMicRecording, countdown, startRecognition, stopMicRaw, cancelSendTimer]);

  // ── Send button — sends immediately, cancels countdown ────────────────────
  const handleClickSendButton = useCallback(() => {
    const text = userMessage.trim();
    if (!text) return;
    cancelSendTimer();
    micEnabledByUser.current = false;
    autoSentRef.current      = false;
    stopMicRaw();
    accumulatedText.current  = "";
    setUserMessage("");
    onChatProcessStart(text);
  }, [userMessage, cancelSendTimer, stopMicRaw, onChatProcessStart]);

  // ── Clear on AI processing start ──────────────────────────────────────────
  useEffect(() => {
    if (isChatProcessing) {
      setUserMessage("");
      accumulatedText.current = "";
    }
  }, [isChatProcessing]);

  // Placeholder text shows countdown when pending
  const placeholder = countdown !== null
    ? `Sending in ${countdown}… (press send to send now)`
    : isMicRecording
    ? "Listening…"
    : "Type a message...";

  return (
    <MessageInput
      userMessage={userMessage}
      isChatProcessing={isChatProcessing}
      isMicRecording={(isMicRecording || countdown !== null) && micSupported}
      onChangeUserMessage={(e) => {
        setUserMessage(e.target.value);
        accumulatedText.current = e.target.value;
        // If user types manually during countdown, cancel auto-send
        cancelSendTimer();
      }}
      onClickMicButton={handleClickMicButton}
      onClickSendButton={handleClickSendButton}
      placeholder={placeholder}
    />
  );
};
