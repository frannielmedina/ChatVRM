import { LipSyncAnalyzeResult } from "./lipSyncAnalyzeResult";

const TIME_DOMAIN_DATA_LENGTH = 2048;

export class LipSync {
  public readonly audio: AudioContext;
  public readonly analyser: AnalyserNode;
  public readonly timeDomainData: Float32Array;

  public constructor(audio: AudioContext) {
    this.audio = audio;
    this.analyser = audio.createAnalyser();
    this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH);
  }

  public update(): LipSyncAnalyzeResult {
    this.analyser.getFloatTimeDomainData(this.timeDomainData);

    let volume = 0.0;
    for (let i = 0; i < TIME_DOMAIN_DATA_LENGTH; i++) {
      volume = Math.max(volume, Math.abs(this.timeDomainData[i]));
    }

    volume = 1 / (1 + Math.exp(-45 * volume + 5));
    if (volume < 0.1) volume = 0;

    return { volume };
  }

  public async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    try {
      const audioBuffer = await this.audio.decodeAudioData(buffer);
      const bufferSource = this.audio.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(this.audio.destination);
      bufferSource.connect(this.analyser);
      bufferSource.start();
      if (onEnded) {
        bufferSource.addEventListener("ended", onEnded);
      }
    } catch (e) {
      // decodeAudioData rejects if the TTS backend ever returns something
      // that isn't valid audio (an error page, empty body, truncated
      // stream, etc). Without this catch, that rejection vanishes into an
      // unawaited promise and onEnded never fires — which permanently
      // hangs the whole chat pipeline waiting for a callback that will
      // never come. Always call onEnded so the app can recover.
      console.error("[LipSync] Failed to decode/play TTS audio:", e);
      onEnded?.();
    }
  }

  public async playFromURL(url: string, onEnded?: () => void) {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    await this.playFromArrayBuffer(buffer, onEnded);
  }
}
