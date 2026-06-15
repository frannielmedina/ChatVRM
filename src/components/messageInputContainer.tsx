import { MessageInput } from "@/components/messageInput";
import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────────────────────
const SILENCE_TIMEOUT_MS = 10_000; // 10 s without new speech → auto-send
const RESTART_DELAY_MS   = 300;    // pause before re-opening mic after TTS

// ─────────────────────────────────────────────────────────────────────────────
// Global TTS-busy flag
// ─────────────────────────────────────────────────────────────────────────────
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
// Component
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

  // Whether the browser even supports SpeechRecognition
  const [micSupported, setMicSupported]     = useState(true);

  // ── Refs (stable, no stale closure issues) ────────────────────────────────
  const recognitionRef   = useRef<SpeechRecognition | null>(null);
  const runningRef       = useRef(false);
  const stoppingRef      = useRef(false);
  const micEnabledByUser = useRef(false);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedText  = useRef("");

  const onChatProcessStartRef = useRef(onChatProcessStart);
  const isChatProcessingRef   = useRef(isChatProcessing);
  useEffect(() => { onChatProcessStartRef.current = onChatProcessStart; }, [onChatProcessStart]);
  useEffect(() => { isChatProcessingRef.current   = isChatProcessing;   }, [isChatProcessing]);

  const ttsSpeaking = useTtsSpeaking();

  // ── Safe state setter — always keeps UI in sync with runningRef ───────────
  const setMicState = useCallback((recording: boolean) => {
    runningRef.current = recording;
    setIsMicRecording(recording);
  }, []);

  // ── Silence timer ──────────────────────────────────────────────────────────
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const text = accumulatedText.current.trim();

      if (recognitionRef.current && runningRef.current) {
        stoppingRef.current = true;
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      setMicState(false);

      if (text) {
        onChatProcessStartRef.current(text);
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer, setMicState]);

  // ── Stop recognition ───────────────────────────────────────────────────────
  const stopRecognition = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current && runningRef.current) {
      stoppingRef.current = true;
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    setMicState(false);
  }, [clearSilenceTimer, setMicState]);

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
      setMicState(true);
    } catch (e) {
      console.warn("[mic] start() threw:", e);
      setMicState(false);
    }
  }, [setMicState]);

  // ── Build SpeechRecognition once on mount ──────────────────────────────────
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("[mic] SpeechRecognition not supported in this browser.");
      setMicSupported(false);
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang            = "en-US";
    recognition.interimResults  = true;
    recognition.continuous      = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final   = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }

      if (final) {
        accumulatedText.current = (accumulatedText.current + " " + final).trim();
      }
      const displayed = interim
        ? (accumulatedText.current + " " + interim).trim()
        : accumulatedText.current;

      setUserMessage(displayed);
      resetSilenceTimer();
    };

    recognition.onstart = () => {
      // Confirm the mic actually started (belt-and-suspenders)
      setMicState(true);
    };

    recognition.onend = () => {
      // Always clear the running flag when the browser fires onend
      const wasIntentional = stoppingRef.current;
      stoppingRef.current = false;

      // If we weren't running (e.g. start() threw before onstart fired),
      // just make sure UI is correct and bail.
      if (!runningRef.current && !wasIntentional) {
        setMicState(false);
        return;
      }

      runningRef.current = false; // clear BEFORE setMicState so callers see correct state
      clearSilenceTimer();

      if (wasIntentional) {
        setIsMicRecording(false);
        return; // intentional stop — do not auto-restart
      }

      // Unexpected browser cut — restart if user still wants mic on
      if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
        setIsMicRecording(false); // briefly show "off" before restart
        setTimeout(() => {
          if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
            startRecognition();
          }
        }, RESTART_DELAY_MS);
      } else {
        setIsMicRecording(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" fires when we call stop() intentionally — safe to ignore
      if (event.error === "aborted") return;

      console.warn("[mic] error:", event.error);

      // On any real error, ensure we reset to a clean state
      stoppingRef.current = false;
      setMicState(false);
      clearSilenceTimer();

      // "not-allowed" means the user denied mic permission — disable the button
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micEnabledByUser.current = false;
        setMicSupported(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null as any;
      recognition.onstart  = null as any;
      recognition.onend    = null as any;
      recognition.onerror  = null as any;
      clearSilenceTimer();
      if (runningRef.current) {
        try { recognition.stop(); } catch (_) {}
      }
      recognitionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once only

  // ── TTS starts → mute mic immediately ─────────────────────────────────────
  useEffect(() => {
    if (ttsSpeaking && runningRef.current) {
      clearSilenceTimer();
      if (recognitionRef.current) {
        stoppingRef.current = true;
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      setMicState(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeaking]);

  // ── TTS ends → re-enable mic ───────────────────────────────────────────────
  useEffect(() => {
    if (!ttsSpeaking && micEnabledByUser.current && !isChatProcessing) {
      const t = setTimeout(() => {
        if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
          startRecognition();
        }
      }, RESTART_DELAY_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeaking]);

  // ── AI processing ends → re-enable mic ────────────────────────────────────
  useEffect(() => {
    if (!isChatProcessing && micEnabledByUser.current && !_ttsSpeaking) {
      const t = setTimeout(() => {
        if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
          startRecognition();
        }
      }, RESTART_DELAY_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatProcessing]);

  // ── Mic button ─────────────────────────────────────────────────────────────
  const handleClickMicButton = useCallback(() => {
    if (isMicRecording) {
      micEnabledByUser.current = false;
      stopRecognition();
    } else {
      micEnabledByUser.current = true;
      startRecognition();
    }
  }, [isMicRecording, startRecognition, stopRecognition]);

  // ── Send button ────────────────────────────────────────────────────────────
  const handleClickSendButton = useCallback(() => {
    const text = userMessage.trim();
    if (!text) return;
    if (isMicRecording) stopRecognition();
    accumulatedText.current = "";
    onChatProcessStart(text);
  }, [userMessage, isMicRecording, stopRecognition, onChatProcessStart]);

  // ── Clear display when AI starts processing ────────────────────────────────
  useEffect(() => {
    if (isChatProcessing) {
      setUserMessage("");
      accumulatedText.current = "";
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
