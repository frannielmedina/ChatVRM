import { wait } from "@/utils/wait";
import { Viewer } from "../vrmViewer/viewer";
import { Screenplay, Talk } from "./messages";
import { TTSConfig } from "../tts/ttsConfig";
import { synthesizeWithProvider } from "../tts/ttsProviders";

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
        return viewer.model?.speak(audioBuffer, screenplay);
      }
    );
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
