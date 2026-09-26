/**
 * Renders a beat with the producer tag laid over it, entirely in the browser.
 *
 * The Worker runtime has no ffmpeg, so mixing happens here with the Web Audio
 * API: both files are decoded, the tag is mixed in at the configured interval,
 * and the result is written out as a 16-bit WAV file.
 */

export type TagMixOptions = {
  intervalSeconds: number;
  startOffsetSeconds: number;
  volume: number;
};

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load audio (${res.status})`);
  return res.arrayBuffer();
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = 44 + frames * channels * 2;
  const view = new DataView(new ArrayBuffer(bytes));

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, frames * channels * 2, true);

  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = Math.max(-1, Math.min(1, data[c]![i]!));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view.buffer], { type: "audio/wav" });
}

/** Mixes the producer tag over the beat and returns the raw rendered audio. */
export async function renderTaggedBeatBuffer(
  beatUrl: string,
  tagUrl: string,
  options: TagMixOptions,
): Promise<AudioBuffer> {
  const Ctx: typeof AudioContext =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  const decodeCtx = new Ctx();
  try {
    const [beatData, tagData] = await Promise.all([fetchBuffer(beatUrl), fetchBuffer(tagUrl)]);
    const beat = await decodeCtx.decodeAudioData(beatData.slice(0));
    const tag = await decodeCtx.decodeAudioData(tagData.slice(0));

    const offline = new OfflineAudioContext(
      Math.max(beat.numberOfChannels, 1),
      beat.length,
      beat.sampleRate,
    );

    const beatSource = offline.createBufferSource();
    beatSource.buffer = beat;
    beatSource.connect(offline.destination);
    beatSource.start(0);

    const gain = offline.createGain();
    gain.gain.value = options.volume;
    gain.connect(offline.destination);

    const interval = Math.max(5, options.intervalSeconds);
    for (let t = Math.max(0, options.startOffsetSeconds); t < beat.duration; t += interval) {
      const src = offline.createBufferSource();
      src.buffer = tag;
      src.connect(gain);
      src.start(t);
    }

    return await offline.startRendering();
  } finally {
    void decodeCtx.close();
  }
}

export async function renderTaggedBeat(
  beatUrl: string,
  tagUrl: string,
  options: TagMixOptions,
): Promise<Blob> {
  return encodeWav(await renderTaggedBeatBuffer(beatUrl, tagUrl, options));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
