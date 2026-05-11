import { wait } from "@/utils/wait";
import { Viewer } from "../vrmViewer/viewer";
import { Screenplay, Talk } from "./messages";
import { TTSConfig } from "../tts/ttsConfig";
import { synthesizeWithProvider } from "../tts/ttsProviders";
// Import the TTS-busy flag so the mic container knows when to mute/unmute
import { setTtsSpeaking } from "@/components/messageInputContainer";

// ── How many speeches are currently in-flight ─────────────────────────────────
// We use a counter instead of a boolean so overlapping sentences don't
// prematurely clear the "speaking" flag.
let _activeSpeechCount = 0;

function markTtsStart() {
  _activeSpeechCount++;
  if (_activeSpeechCount === 1) setTtsSpeaking(true);
}

function markTtsEnd() {
  _activeSpeechCount = Math.max(0, _activeSpeechCount - 1);
  if (_activeSpeechCount === 0) setTtsSpeaking(false);
}

const createSpeakCharacter = () => {
  let lastTime = 0;
  let prevFetchPromise: Promise<unknown> = Promise.resolve();
  let prevSpeakPromise: Promise<unknown> = Promise.resolve();

  return (
    screenplay: Screenplay,
    viewer: Viewer,
    ttsConfig: TTSConfig,
    koeiroParam: { speakerX: number; speakerY: number },
    onStart?: () => void,
    onComplete?: () => void
  ) => {
    const fetchPromise = prevFetchPromise.then(async () => {
      const now = Date.now();
      if (now - lastTime < 1000) {
        await wait(1000 - (now - lastTime));
      }
      const buffer = await fetchAudio(screenplay.talk, ttsConfig, koeiroParam).catch(
        () => null
      );
      lastTime = Date.now();
      return buffer;
    });

    prevFetchPromise = fetchPromise;
    prevSpeakPromise = Promise.all([fetchPromise, prevSpeakPromise]).then(
      ([audioBuffer]) => {
        onStart?.();
        if (!audioBuffer) return;

        // ── Signal TTS start ──────────────────────────────────────────────
        markTtsStart();

        return viewer.model?.speak(audioBuffer, screenplay);
      }
    );

    prevSpeakPromise.then(() => {
      // ── Signal TTS end ────────────────────────────────────────────────
      markTtsEnd();
      onComplete?.();
    });
  };
};

export const speakCharacter = createSpeakCharacter();

export async function fetchAudio(
  talk: Talk,
  ttsConfig: TTSConfig,
  koeiroParam: { speakerX: number; speakerY: number }
): Promise<ArrayBuffer> {
  return synthesizeWithProvider(
    talk.message,
    talk.style,
    koeiroParam.speakerX,
    koeiroParam.speakerY,
    ttsConfig
  );
}
