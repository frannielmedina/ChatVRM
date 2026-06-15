import { MessageInput } from "@/components/messageInput";
import { useState, useEffect, useCallback, useRef } from "react";

const SILENCE_TIMEOUT_MS = 10_000;
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
  // true only between recognition.start() and onstart firing
  const pendingStartRef  = useRef(false);
  // true only while recognition is confirmed running (onstart → onend)
  const runningRef       = useRef(false);
  // true when WE called stop() intentionally
  const stoppingRef      = useRef(false);
  // did the user press the button to enable mic?
  const micEnabledByUser = useRef(false);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedText  = useRef("");

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

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const text = accumulatedText.current.trim();
      if (recognitionRef.current && runningRef.current) {
        stoppingRef.current = true;
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      runningRef.current = false;
      pendingStartRef.current = false;
      setIsMicRecording(false);
      if (text) onChatProcessStartRef.current(text);
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer]);

  // ── Stop ───────────────────────────────────────────────────────────────────
  const stopRecognition = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current && (runningRef.current || pendingStartRef.current)) {
      stoppingRef.current = true;
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    runningRef.current = false;
    pendingStartRef.current = false;
    setIsMicRecording(false);
  }, [clearSilenceTimer]);

  // ── Start ──────────────────────────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (runningRef.current || pendingStartRef.current) return;
    if (_ttsSpeaking) return;
    if (isChatProcessingRef.current) return;

    accumulatedText.current = "";
    setUserMessage("");
    stoppingRef.current = false;
    pendingStartRef.current = true;
    // NOTE: do NOT set isMicRecording here — wait for onstart so the button
    // only goes green when the browser has actually opened the microphone.

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("[mic] start() threw:", e);
      pendingStartRef.current = false;
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
      setMicSupported(false);
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.lang            = "en-US";
    recognition.interimResults  = true;
    recognition.continuous      = true;
    recognition.maxAlternatives = 1;

    // ── onstart: browser confirmed the mic is open ─────────────────────────
    recognition.onstart = () => {
      pendingStartRef.current = false;
      runningRef.current = true;
      setIsMicRecording(true); // only NOW show green mic
    };

    // ── onresult ───────────────────────────────────────────────────────────
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
      resetSilenceTimer();
    };

    // ── onend ──────────────────────────────────────────────────────────────
    recognition.onend = () => {
      const wasIntentional = stoppingRef.current;
      stoppingRef.current = false;
      runningRef.current = false;
      pendingStartRef.current = false;
      clearSilenceTimer();
      setIsMicRecording(false);

      if (wasIntentional) return; // we called stop() — don't restart

      // Unexpected browser cut — restart if user still wants mic on
      if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
        setTimeout(() => {
          if (micEnabledByUser.current && !_ttsSpeaking && !isChatProcessingRef.current) {
            startRecognition();
          }
        }, RESTART_DELAY_MS);
      }
    };

    // ── onerror ────────────────────────────────────────────────────────────
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return; // we caused this, onend will clean up

      console.warn("[mic] SpeechRecognition error:", event.error);

      stoppingRef.current = false;
      runningRef.current = false;
      pendingStartRef.current = false;
      clearSilenceTimer();
      setIsMicRecording(false);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micEnabledByUser.current = false;
        setMicSupported(false);
        console.warn("[mic] Microphone permission denied.");
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

  // ── TTS starts → stop mic immediately ─────────────────────────────────────
  useEffect(() => {
    if (ttsSpeaking && (runningRef.current || pendingStartRef.current)) {
      clearSilenceTimer();
      if (recognitionRef.current) {
        stoppingRef.current = true;
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      runningRef.current = false;
      pendingStartRef.current = false;
      setIsMicRecording(false);
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

  // ── Mic button click ───────────────────────────────────────────────────────
  const handleClickMicButton = useCallback(() => {
    if (isMicRecording || pendingStartRef.current) {
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

  // ── Clear input when AI starts processing ─────────────────────────────────
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
