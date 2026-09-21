// Browser-side tempo (BPM) and musical key detection.
// Runs entirely on the Web Audio API — no external services.

export type AudioAnalysis = {
  bpm: number | null;
  key: string | null;
  source: "filename" | "audio" | "mixed";
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ---------------------------------------------------------------- filename

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B", Fb: "E",
};

function normalizeNote(raw: string): string | null {
  const n = raw.trim();
  if (!n) return null;
  const letter = n[0].toUpperCase();
  const accidental = n.slice(1).replace(/\s+/g, "").replace("♯", "#").replace("♭", "b");
  let note = letter + (accidental === "#" || accidental === "b" ? accidental : "");
  if (note.endsWith("b")) note = FLAT_TO_SHARP[note] ?? note;
  return NOTE_NAMES.includes(note) ? note : null;
}

export function parseBpmFromName(name: string): number | null {
  const explicit = name.match(/(\d{2,3})\s*(?:bpm)/i);
  if (explicit) {
    const v = parseInt(explicit[1], 10);
    if (v >= 50 && v <= 220) return v;
  }
  const loose = name.match(/(?:^|[\s_\-\[\(])(\d{2,3})(?=[\s_\-\]\)]|$)/g);
  if (loose) {
    for (const chunk of loose) {
      const v = parseInt(chunk.replace(/\D/g, ""), 10);
      if (v >= 60 && v <= 200) return v;
    }
  }
  return null;
}

export function parseKeyFromName(name: string): string | null {
  const m = name.match(/(?:^|[\s_\-\[\(])([A-Ga-g])\s*([#♯b♭]?)\s*(maj(?:or)?|min(?:or)?|m)?(?=[\s_\-\]\)\.]|$)/);
  if (!m) return null;
  const note = normalizeNote(m[1] + (m[2] ?? ""));
  if (!note) return null;
  const q = (m[3] ?? "").toLowerCase();
  if (!q) return null; // a bare letter is too ambiguous to trust
  const minor = q === "m" || q.startsWith("min");
  return `${note} ${minor ? "Minor" : "Major"}`;
}

// ---------------------------------------------------------------- helpers

function toMono(buf: AudioBuffer): Float32Array {
  const ch = buf.numberOfChannels;
  const left = buf.getChannelData(0);
  if (ch === 1) return left;
  const right = buf.getChannelData(1);
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = (left[i] + right[i]) / 2;
  return out;
}

// ---------------------------------------------------------------- tempo

// Energy-envelope autocorrelation. Robust for beat-driven music.
export function detectBpm(buf: AudioBuffer): number | null {
  const data = toMono(buf);
  const sr = buf.sampleRate;
  const maxSamples = Math.min(data.length, sr * 60);
  if (maxSamples < sr * 4) return null;

  // Onset envelope at ~200 Hz
  const hop = Math.max(1, Math.round(sr / 200));
  const frames = Math.floor(maxSamples / hop);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * hop;
    for (let i = start; i < start + hop; i++) sum += data[i] * data[i];
    env[f] = Math.sqrt(sum / hop);
  }
  // Half-wave rectified difference = onset strength
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, env[f] - env[f - 1]);

  // Remove DC
  let mean = 0;
  for (let f = 0; f < frames; f++) mean += onset[f];
  mean /= frames || 1;
  for (let f = 0; f < frames; f++) onset[f] -= mean;

  const envRate = sr / hop;
  const minLag = Math.floor((60 / 185) * envRate);
  const maxLag = Math.ceil((60 / 60) * envRate);
  if (maxLag >= frames) return null;

  let bestLag = -1;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const n = frames - lag;
    for (let f = 0; f < n; f++) sum += onset[f] * onset[f + lag];
    // reinforce with the first harmonic (double-time consistency)
    const lag2 = lag * 2;
    if (lag2 < frames) {
      let sum2 = 0;
      const n2 = frames - lag2;
      for (let f = 0; f < n2; f++) sum2 += onset[f] * onset[f + lag2];
      sum += sum2 * 0.5;
    }
    const score = sum / n;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  if (bestLag <= 0) return null;

  let bpm = (60 * envRate) / bestLag;
  // fold into the usual production range
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  const rounded = Math.round(bpm);
  return rounded >= 60 && rounded <= 200 ? rounded : null;
}

// ---------------------------------------------------------------- key

function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// Krumhansl-Schmuckler profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(chroma: number[], profile: number[], shift: number): number {
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < 12; i++) {
    a.push(chroma[(i + shift) % 12]);
    b.push(profile[i]);
  }
  const ma = a.reduce((s, v) => s + v, 0) / 12;
  const mb = b.reduce((s, v) => s + v, 0) / 12;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

export function detectKey(buf: AudioBuffer): string | null {
  const data = toMono(buf);
  const sr = buf.sampleRate;
  const limit = Math.min(data.length, sr * 60);
  const size = 8192;
  const hop = size;
  if (limit < size * 2) return null;

  const chroma = new Array(12).fill(0);
  const re = new Float32Array(size);
  const im = new Float32Array(size);
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));

  let frames = 0;
  for (let start = 0; start + size <= limit; start += hop) {
    for (let i = 0; i < size; i++) {
      re[i] = data[start + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let bin = 1; bin < size / 2; bin++) {
      const freq = (bin * sr) / size;
      if (freq < 55 || freq > 2000) continue;
      const mag = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
      if (mag <= 0) continue;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      // midi 0 = C, our NOTE_NAMES start at C
      chroma[pc] += mag;
    }
    frames++;
    if (frames > 400) break;
  }
  if (!frames) return null;

  const total = chroma.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;

  let best = { score: -Infinity, name: "" };
  for (let shift = 0; shift < 12; shift++) {
    const maj = correlate(chroma, MAJOR_PROFILE, shift);
    const min = correlate(chroma, MINOR_PROFILE, shift);
    if (maj > best.score) best = { score: maj, name: `${NOTE_NAMES[shift]} Major` };
    if (min > best.score) best = { score: min, name: `${NOTE_NAMES[shift]} Minor` };
  }
  return best.name || null;
}

// ---------------------------------------------------------------- public API

export function analyzeBuffer(buf: AudioBuffer): { bpm: number | null; key: string | null } {
  let bpm: number | null = null;
  let key: string | null = null;
  try { bpm = detectBpm(buf); } catch { /* ignore */ }
  try { key = detectKey(buf); } catch { /* ignore */ }
  return { bpm, key };
}

export async function analyzeFile(file: File, buf?: AudioBuffer): Promise<AudioAnalysis> {
  const nameBpm = parseBpmFromName(file.name);
  const nameKey = parseKeyFromName(file.name);
  let audioBuf = buf;
  if (!audioBuf && (!nameBpm || !nameKey)) {
    audioBuf = await decode(await file.arrayBuffer());
  }
  const detected = audioBuf ? analyzeBuffer(audioBuf) : { bpm: null, key: null };
  const bpm = nameBpm ?? detected.bpm;
  const key = nameKey ?? detected.key;
  const source: AudioAnalysis["source"] =
    nameBpm && nameKey ? "filename" : nameBpm || nameKey ? "mixed" : "audio";
  return { bpm, key, source };
}

async function decode(ab: ArrayBuffer): Promise<AudioBuffer> {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(ab.slice(0));
  } finally {
    try { await ctx.close(); } catch { /* ignore */ }
  }
}

export async function analyzeUrl(url: string): Promise<{ bpm: number | null; key: string | null }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load audio (${res.status})`);
  const ab = await res.arrayBuffer();
  const buf = await decode(ab);
  return analyzeBuffer(buf);
}
