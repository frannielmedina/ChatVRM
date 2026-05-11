import { MessageInput } from "@/components/messageInput";
import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────────────────────
const SILENCE_TIMEOUT_MS = 10_000; // 10 s of silence → stop mic
const RESTART_DELAY_MS   = 300;    // small gap before re-opening mic after TTS

// ─────────────────────────────────────────────────────────────────────────────
// Global TTS-busy flag
// Components that drive TTS should call setTtsSpeaking(true/false).
// We expose it so speakCharacter.ts can import and toggle it.
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
  const [userMessage, setUserMessage]   = useState("");
  const [isMicRecording, setIsMicRecording] = useState(false);

  // Whether the user deliberately activated the mic (we track this so we know
  // whether to re-enable it after TTS finishes)
  const micEnabledByUser = useRef(false);

  // SpeechRecognition instance
  const recognitionRef   = useRef<SpeechRecognition | null>(null);

  // Silence timer: restarted on every speech result, fires after SILENCE_TIMEOUT_MS
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether we're in the middle of stopping (prevents double-stop)
  const stoppingRef      = useRef(false);

  // Whether recognition is actually running (guards against calling start() twice)
  const runningRef       = useRef(false);

  const ttsSpeaking      = useTtsSpeaking();

  // ── Silence timer helpers ──────────────────────────────────────────────────
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback((onExpire: () => void) => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(onExpire, SILENCE_TIMEOUT_MS);
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
    if (runningRef.current) return;          // already running
    if (_ttsSpeaking) return;                // TTS is talking — don't listen
    if (isChatProcessing) return;            // AI is processing — don't listen

    stoppingRef.current = false;
    runningRef.current  = true;
    setIsMicRecording(true);

    try {
      recognitionRef.current.start();
    } catch (e) {
      // start() throws if called while already running (shouldn't happen, but guard)
      console.warn("[mic] start() threw:", e);
      runningRef.current = false;
      setIsMicRecording(false);
    }
  }, [isChatProcessing]);

  // ── Build SpeechRecognition once ───────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("[mic] SpeechRecognition not supported in this browser.");
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang             = "en-US";
    recognition.interimResults   = true;
    recognition.continuous       = true;   // keep mic open — we manage stop ourselves
    recognition.maxAlternatives  = 1;

    // ── onresult: update text + reset silence timer ────────────────────────
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript   = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }

      const current = (finalTranscript || interimTranscript).trim();
      if (current) setUserMessage(current);

      // Reset the silence timer every time we get speech
      resetSilenceTimer(() => {
        // Silence expired → stop mic and send what we have
        if (!runningRef.current) return;
        const textToSend = current || userMessage;
        stopRecognition();
        if (textToSend.trim()) {
          onChatProcessStart(textToSend.trim());
        }
      });
    };

    // ── onend: fires when recognition stops for ANY reason ─────────────────
    recognition.onend = () => {
      runningRef.current = false;
      clearSilenceTimer();

      if (stoppingRef.current) {
        // Intentional stop (silence timeout, user clicked, or TTS started)
        stoppingRef.current = false;
        return;
      }

      // Unexpected end (browser cut it) — restart if user still wants mic
      if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessing) {
        setTimeout(() => {
          if (micEnabledByUser.current && !_ttsSpeaking) {
            startRecognition();
          }
        }, RESTART_DELAY_MS);
      } else {
        setIsMicRecording(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" is expected when we call stop() — ignore it
      if (event.error === "aborted") return;
      console.warn("[mic] SpeechRecognition error:", event.error);
      runningRef.current = false;
      setIsMicRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null as any;
      recognition.onend    = null as any;
      recognition.onerror  = null as any;
      if (runningRef.current) recognition.stop();
      recognitionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-enable mic callbacks when deps change ───────────────────────────────
  // We need the latest closures but can't rebuild the recognition object each
  // time (that causes bugs).  Instead we store mutable refs for the callbacks.
  const onChatProcessStartRef = useRef(onChatProcessStart);
  const isChatProcessingRef   = useRef(isChatProcessing);

  useEffect(() => { onChatProcessStartRef.current = onChatProcessStart; }, [onChatProcessStart]);
  useEffect(() => { isChatProcessingRef.current   = isChatProcessing;   }, [isChatProcessing]);

  // ── When TTS finishes → re-activate mic if user had it on ─────────────────
  useEffect(() => {
    if (!ttsSpeaking && micEnabledByUser.current && !isChatProcessing) {
      // TTS just finished — restart mic after a short pause
      const t = setTimeout(() => {
        if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
          setUserMessage("");
          startRecognition();
        }
      }, RESTART_DELAY_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeaking]);

  // ── When TTS starts → stop mic immediately to avoid feedback ──────────────
  useEffect(() => {
    if (ttsSpeaking && runningRef.current) {
      // TTS just started speaking — mute mic
      clearSilenceTimer();
      if (recognitionRef.current && runningRef.current) {
        stoppingRef.current = true;
        recognitionRef.current.stop();
      }
      runningRef.current = false;
      setIsMicRecording(false);
      // Note: micEnabledByUser stays true so we re-enable after TTS ends
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeaking]);

  // ── When AI finishes processing + user had mic → restart mic ──────────────
  useEffect(() => {
    if (!isChatProcessing && micEnabledByUser.current && !_ttsSpeaking) {
      const t = setTimeout(() => {
        if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
          setUserMessage("");
          startRecognition();
        }
      }, RESTART_DELAY_MS);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatProcessing]);

  // ── Clear message when chat starts ────────────────────────────────────────
  useEffect(() => {
    if (isChatProcessing) setUserMessage("");
  }, [isChatProcessing]);

  // ── Mic button click ───────────────────────────────────────────────────────
  const handleClickMicButton = useCallback(() => {
    if (isMicRecording) {
      // User wants to turn OFF
      micEnabledByUser.current = false;
      stopRecognition();
    } else {
      // User wants to turn ON
      micEnabledByUser.current = true;
      setUserMessage("");
      startRecognition();
    }
  }, [isMicRecording, startRecognition, stopRecognition]);

  // ── Send button / Enter ────────────────────────────────────────────────────
  const handleClickSendButton = useCallback(() => {
    if (!userMessage.trim()) return;
    // Stop mic before sending (TTS will re-enable it when done)
    if (isMicRecording) {
      stopRecognition();
    }
    onChatProcessStart(userMessage.trim());
  }, [userMessage, isMicRecording, stopRecognition, onChatProcessStart]);

  return (
    <MessageInput
      userMessage={userMessage}
      isChatProcessing={isChatProcessing}
      isMicRecording={isMicRecording}
      onChangeUserMessage={(e) => setUserMessage(e.target.value)}
      onClickMicButton={handleClickMicButton}
      onClickSendButton={handleClickSendButton}
    />
  );
};
