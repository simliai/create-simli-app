// Microphone capture as raw PCM16, 16 kHz, mono: the format Deepgram is told to
// expect (encoding=linear16, sample_rate=16000).

// The AudioContext runs at the device's native rate (Firefox can't connect a mic
// to a context with a different rate), so the worklet downsamples to 16 kHz by
// averaging, and posts 100 ms chunks (1600 samples = 3200 bytes).
const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.t = 0; this.acc = 0; this.cnt = 0;
    this.buf = new Int16Array(1600); this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.cnt++; this.t += 1;
      if (this.t >= this.ratio) {
        this.t -= this.ratio;
        const s = Math.max(-1, Math.min(1, this.acc / this.cnt));
        this.acc = 0; this.cnt = 0;
        this.buf[this.n++] = Math.round(s * 32767);
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

export interface Mic {
  stop: () => void;
}

/** Opens the mic (with echo cancellation, so the avatar's voice isn't picked up). */
export async function openMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

/** Streams PCM16 16 kHz chunks from `stream` to `onChunk` until stopped. */
export async function startPcmCapture(stream: MediaStream, onChunk: (pcm: Int16Array) => void): Promise<Mic> {
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const node = new AudioWorkletNode(ctx, "pcm-capture");
  node.port.onmessage = (e: MessageEvent<Int16Array>) => onChunk(e.data);
  ctx.createMediaStreamSource(stream).connect(node);
  await ctx.resume();
  return {
    stop: () => {
      node.port.onmessage = null;
      node.disconnect();
      void ctx.close();
    },
  };
}
