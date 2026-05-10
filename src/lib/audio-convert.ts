// Browser audio conversion utilities. Decodes any audio that Web Audio
// supports (mp3/wav/m4a/ogg…) and re-encodes to wav (PCM16) or mp3 (lamejs).
import lamejs from "@breezystack/lamejs";

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  try {
    const ab = await file.arrayBuffer();
    return await ctx.decodeAudioData(ab.slice(0));
  } finally {
    // best-effort cleanup
    try { await ctx.close(); } catch {}
  }
}

function floatTo16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function encodeWav(buf: AudioBuffer): Blob {
  const numCh = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const dataLen = buf.length * numCh * 2;
  const ab = new ArrayBuffer(44 + dataLen);
  const view = new DataView(ab);
  let p = 0;
  const writeStr = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  writeStr("RIFF"); view.setUint32(p, 36 + dataLen, true); p += 4;
  writeStr("WAVE"); writeStr("fmt "); view.setUint32(p, 16, true); p += 4;
  view.setUint16(p, 1, true); p += 2;          // PCM
  view.setUint16(p, numCh, true); p += 2;
  view.setUint32(p, sr, true); p += 4;
  view.setUint32(p, sr * numCh * 2, true); p += 4;
  view.setUint16(p, numCh * 2, true); p += 2;
  view.setUint16(p, 16, true); p += 2;
  writeStr("data"); view.setUint32(p, dataLen, true); p += 4;

  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buf.getChannelData(c));
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      p += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

export function encodeMp3(buf: AudioBuffer, kbps = 192): Blob {
  const numCh = Math.min(2, buf.numberOfChannels);
  const enc = new lamejs.Mp3Encoder(numCh, buf.sampleRate, kbps);
  const left = floatTo16(buf.getChannelData(0));
  const right = numCh > 1 ? floatTo16(buf.getChannelData(1)) : null;
  const block = 1152;
  const out: Int8Array[] = [];
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const r = right ? right.subarray(i, i + block) : null;
    const chunk = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (chunk.length) out.push(chunk);
  }
  const tail = enc.flush();
  if (tail.length) out.push(tail);
  return new Blob(out, { type: "audio/mpeg" });
}

export function isMp3(file: File) {
  return /\.mp3$/i.test(file.name) || file.type === "audio/mpeg" || file.type === "audio/mp3";
}
export function isWav(file: File) {
  return /\.wave?$/i.test(file.name) || file.type === "audio/wav" || file.type === "audio/x-wav";
}
