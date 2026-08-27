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

    // Defensive: prevFetchPromise/prevSpeakPromise are module-level and
    // chained across every call. If either ever rejected without being
    // caught, every future call would inherit that rejection forever and
    // silently stop working. Catching here guarantees the shared chain
    // always resolves, no matter what goes wrong in one call.
    prevFetchPromise = fetchPromise.catch((e) => {
      console.error("[speakCharacter] fetch chain error", e);
      return null;
    });

    prevSpeakPromise = Promise.all([fetchPromise, prevSpeakPromise]).then(
      async ([audioBuffer]) => {
        onStart?.();
        if (!audioBuffer) return;

        // ── Signal TTS start ──────────────────────────────────────────────
        markTtsStart();

        try {
          await viewer.model?.speak(audioBuffer, screenplay);
        } catch (e) {
          console.error("[speakCharacter] playback error", e);
        } finally {
          markTtsEnd();
        }
      },
      (e) => {
        // Should be unreachable now that fetchPromise/prevSpeakPromise are
        // both guaranteed to resolve, but kept as a last-resort safety net.
        console.error("[speakCharacter] chain error", e);
        onStart?.();
      }
    );

    prevSpeakPromise = prevSpeakPromise.catch((e) => {
      console.error("[speakCharacter] unexpected chain error", e);
    });

    prevSpeakPromise.then(() => {
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
