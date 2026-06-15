import { MessageInput } from "@/components/messageInput";
import { useState, useEffect, useCallback, useRef } from "react";

const SILENCE_TIMEOUT_MS = 1500; // 1.5s after last word → auto-send
const RESTART_DELAY_MS   = 300;

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

  const recognitionRef   = useRef<SpeechRecognition | null>(null);
  const pendingStartRef  = useRef(false);
  const runningRef       = useRef(false);
  const stoppingRef      = useRef(false);
  // Whether the user has the mic toggled ON
  const micEnabledByUser = useRef(false);
  // Whether the mic was stopped specifically to send (vs manually toggled off)
  // When true, mic restarts after AI finishes responding
  const stoppedToSendRef = useRef(false);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedText  = useRef("");
  const hasSpeechRef     = useRef(false);

  const onChatProcessStartRef = useRef(onChatProcessStart);
  const isChatProcessingRef   = useRef(isChatProcessing);
  useEffect(() => { onChatProcessStartRef.current = onChatProcessStart; }, [onChatProcessStart]);
  useEffect(() => { isChatProcessingRef.current   = isChatProcessing;   }, [isChatProcessing]);

  const ttsSpeaking = useTtsSpeaking();

  // ── Kill silence timer ─────────────────────────────────────────────────────
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // ── Raw stop (no send, no restart intent change) ───────────────────────────
  const stopMic = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current && (runningRef.current || pendingStartRef.current)) {
      stoppingRef.current = true;
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    runningRef.current  = false;
    pendingStartRef.current = false;
    setIsMicRecording(false);
  }, [clearSilenceTimer]);

  // ── Start mic ──────────────────────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (runningRef.current || pendingStartRef.current) return;
    if (_ttsSpeaking) return;
    if (isChatProcessingRef.current) return;

    accumulatedText.current = "";
    hasSpeechRef.current    = false;
    setUserMessage("");
    stoppingRef.current     = false;
    pendingStartRef.current = true;

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("[mic] start() threw:", e);
      pendingStartRef.current = false;
      runningRef.current      = false;
      setIsMicRecording(false);
    }
  }, []);

  // ── Send the accumulated text and stop mic ─────────────────────────────────
  // stoppedToSend=true → mic will restart automatically after AI responds
  // stoppedToSend=false → user manually sent, mic stays off
  const sendAndStop = useCallback((text: string, stoppedToSend: boolean) => {
    stoppedToSendRef.current = stoppedToSend;
    stopMic();
    accumulatedText.current = "";
    hasSpeechRef.current    = false;
    setUserMessage("");
    onChatProcessStartRef.current(text);
  }, [stopMic]);

  // ── Silence auto-send ──────────────────────────────────────────────────────
  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const text = accumulatedText.current.trim();
      if (text && hasSpeechRef.current) {
        // stoppedToSend=true so mic restarts after AI finishes
        sendAndStop(text, true);
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer, sendAndStop]);

  // ── Build SpeechRecognition once ───────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("[mic] SpeechRecognition not supported.");
      setMicSupported(false);
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang            = "en-US";
    recognition.interimResults  = true;
    recognition.continuous      = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      pendingStartRef.current = false;
      runningRef.current      = true;
      setIsMicRecording(true);
    };

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
        hasSpeechRef.current    = true;
      }
      const displayed = interim
        ? (accumulatedText.current + " " + interim).trim()
        : accumulatedText.current;
      setUserMessage(displayed);

      // Reset countdown every time speech arrives
      resetSilenceTimer();
    };

    recognition.onend = () => {
      const wasIntentional = stoppingRef.current;
      stoppingRef.current     = false;
      runningRef.current      = false;
      pendingStartRef.current = false;
      clearSilenceTimer();
      setIsMicRecording(false);

      if (wasIntentional) return; // we stopped it — onend is just confirming

      // Unexpected browser cut (network glitch, timeout, etc.)
      // Only restart if user has mic enabled AND we're not processing
      if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
        setTimeout(() => {
          if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
            startRecognition();
          }
        }, RESTART_DELAY_MS);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return;
      console.warn("[mic] error:", event.error);
      stoppingRef.current     = false;
      runningRef.current      = false;
      pendingStartRef.current = false;
      clearSilenceTimer();
      setIsMicRecording(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micEnabledByUser.current = false;
        setMicSupported(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart  = null as any;
      recognition.onresult = null as any;
      recognition.onend    = null as any;
      recognition.onerror  = null as any;
      clearSilenceTimer();
      if (runningRef.current || pendingStartRef.current) {
        try { recognition.stop(); } catch (_) {}
      }
      recognitionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TTS starts → stop mic (will restart after TTS ends) ───────────────────
  useEffect(() => {
    if (ttsSpeaking && (runningRef.current || pendingStartRef.current)) {
      stopMic();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeaking]);

  // ── TTS ends → restart mic only if it was stopped-to-send ─────────────────
  useEffect(() => {
    if (!ttsSpeaking && micEnabledByUser.current && stoppedToSendRef.current && !isChatProcessing) {
      const t = setTimeout(() => {
        if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
          stoppedToSendRef.current = false;
          startRecognition();
        }
      }, RESTART_DELAY_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeaking]);

  // ── AI processing ends → restart mic if we sent via silence detection ──────
  useEffect(() => {
    if (!isChatProcessing && micEnabledByUser.current && stoppedToSendRef.current && !_ttsSpeaking) {
      const t = setTimeout(() => {
        if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
          stoppedToSendRef.current = false;
          startRecognition();
        }
      }, RESTART_DELAY_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatProcessing]);

  // ── Mic button ─────────────────────────────────────────────────────────────
  const handleClickMicButton = useCallback(() => {
    if (isMicRecording || pendingStartRef.current) {
      // User manually turning mic off — do NOT restart after AI responds
      micEnabledByUser.current = false;
      stoppedToSendRef.current = false;
      stopMic();
    } else {
      micEnabledByUser.current = true;
      stoppedToSendRef.current = false;
      startRecognition();
    }
  }, [isMicRecording, startRecognition, stopMic]);

  // ── Send button ────────────────────────────────────────────────────────────
  const handleClickSendButton = useCallback(() => {
    const text = userMessage.trim();
    if (!text) return;
    // Manual send — mic stays off after (stoppedToSend=false)
    sendAndStop(text, false);
    micEnabledByUser.current = false;
  }, [userMessage, sendAndStop]);

  // ── Clear input when AI starts processing ─────────────────────────────────
  useEffect(() => {
    if (isChatProcessing) {
      setUserMessage("");
      accumulatedText.current = "";
      hasSpeechRef.current    = false;
    }
  }, [isChatProcessing]);

  return (
    <MessageInput
      userMessage={userMessage}
      isChatProcessing={isChatProcessing}
      isMicRecording={isMicRecording && micSupported}
      onChangeUserMessage={(e) => {
        setUserMessage(e.target.value);
        accumulatedText.current = e.target.value;
      }}
      onClickMicButton={handleClickMicButton}
      onClickSendButton={handleClickSendButton}
    />
  );
};
