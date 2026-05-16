import { supabase } from "@/integrations/supabase/client";

export function playSentDing() {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.08);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.17);
  oscillator.onended = () => {
    void context.close();
  };
}

export async function uploadVoiceMemo(blob: Blob, userId: string) {
  const mimeType = (blob.type || "audio/webm").split(";")[0];
  const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from("chat-voice-memos").upload(path, blob, {
    upsert: false,
    contentType: mimeType,
  });

  if (upload.error) throw upload.error;
  return {
    audioUrl: supabase.storage.from("chat-voice-memos").getPublicUrl(path).data.publicUrl,
    mimeType,
  };
}
