import { MessageInput } from "@/components/messageInput";
import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────────────────────
const SILENCE_TIMEOUT_MS = 10_000; // 10 s without new speech → auto-send
const RESTART_DELAY_MS   = 300;    // pause before re-opening mic after TTS

// ─────────────────────────────────────────────────────────────────────────────
// Global TTS-busy flag
// speakCharacter.ts imports setTtsSpeaking to toggle this.
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

  // ── Refs (stable, no stale closure issues) ────────────────────────────────
  const recognitionRef   = useRef<SpeechRecognition | null>(null);
  const runningRef       = useRef(false);   // is recognition.start() active?
  const stoppingRef      = useRef(false);   // did WE call stop() intentionally?
  const micEnabledByUser = useRef(false);   // did the user press the mic button?
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⚠️ KEY FIX: transcript lives in a ref so the 10-s timer callback always
  // reads the latest value, not a stale closure copy.
  const accumulatedText  = useRef("");

  // Latest callbacks as refs — avoids rebuilding recognition on every render
  const onChatProcessStartRef = useRef(onChatProcessStart);
  const isChatProcessingRef   = useRef(isChatProcessing);
  useEffect(() => { onChatProcessStartRef.current = onChatProcessStart; }, [onChatProcessStart]);
  useEffect(() => { isChatProcessingRef.current   = isChatProcessing;   }, [isChatProcessing]);

  const ttsSpeaking = useTtsSpeaking();

  // ── Silence timer ──────────────────────────────────────────────────────────
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Restarted every time we receive any speech fragment.
  // After SILENCE_TIMEOUT_MS with no new speech → stop mic and auto-send.
  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const text = accumulatedText.current.trim();

      // Stop mic
      if (runningRef.current && recognitionRef.current) {
        stoppingRef.current = true;
        recognitionRef.current.stop();
      }
      runningRef.current = false;
      setIsMicRecording(false);

      // Auto-send
      if (text) {
        onChatProcessStartRef.current(text);
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer]);

  // ── Stop recognition ───────────────────────────────────────────────────────
  const stopRecognition = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current && runningRef.current) {
      stoppingRef.current = true;
      recognitionRef.current.stop();
    }
    runningRef.current = false;
    setIsMicRecording(false);
  }, [clearSilenceTimer]);

  // ── Start recognition ──────────────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (runningRef.current) return;
    if (_ttsSpeaking) return;
    if (isChatProcessingRef.current) return;

    accumulatedText.current = "";
    setUserMessage("");
    stoppingRef.current = false;
    runningRef.current  = true;
    setIsMicRecording(true);

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("[mic] start() threw:", e);
      runningRef.current = false;
      setIsMicRecording(false);
    }
  }, []);

  // ── Build SpeechRecognition once on mount ──────────────────────────────────
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("[mic] SpeechRecognition not supported.");
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang            = "en-US";
    recognition.interimResults  = true;
    recognition.continuous      = true;  // we manage stop ourselves
    recognition.maxAlternatives = 1;

    // ── onresult ──────────────────────────────────────────────────────────
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

      // Permanently append final segments; show interim live
      if (final) {
        accumulatedText.current = (accumulatedText.current + " " + final).trim();
      }
      const displayed = interim
        ? (accumulatedText.current + " " + interim).trim()
        : accumulatedText.current;

      setUserMessage(displayed);

      // Reset the 10-second silence countdown every time speech arrives
      resetSilenceTimer();
    };

    // ── onend ─────────────────────────────────────────────────────────────
    recognition.onend = () => {
      runningRef.current = false;
      clearSilenceTimer();

      if (stoppingRef.current) {
        stoppingRef.current = false;
        return; // intentional stop — do not auto-restart
      }

      // Unexpected browser cut — restart if user still wants mic on
      if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
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
      if (event.error === "aborted") return; // expected on intentional stop
      console.warn("[mic] error:", event.error);
      runningRef.current = false;
      setIsMicRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null as any;
      recognition.onend    = null as any;
      recognition.onerror  = null as any;
      clearSilenceTimer();
      if (runningRef.current) recognition.stop();
      recognitionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once only

  // ── TTS starts → mute mic immediately (no feedback loop) ──────────────────
  useEffect(() => {
    if (ttsSpeaking && runningRef.current) {
      clearSilenceTimer();
      if (recognitionRef.current) {
        stoppingRef.current = true;
        recognitionRef.current.stop();
      }
      runningRef.current = false;
      setIsMicRecording(false);
      // micEnabledByUser stays true → re-enabled after TTS ends
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
      isMicRecording={isMicRecording}
      onChangeUserMessage={(e) => {
        setUserMessage(e.target.value);
        accumulatedText.current = e.target.value;
      }}
      onClickMicButton={handleClickMicButton}
      onClickSendButton={handleClickSendButton}
    />
  );
};
