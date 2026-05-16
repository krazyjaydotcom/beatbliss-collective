import { useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type VoiceMemoButtonProps = {
  disabled?: boolean;
  onRecorded: (blob: Blob, durationSeconds: number) => Promise<void> | void;
};

export function VoiceMemoButton({ disabled, onRecorded }: VoiceMemoButtonProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);

  async function startRecording() {
    if (disabled || processing) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        setRecording(false);
        setProcessing(true);
        stream.getTracks().forEach((track) => track.stop());
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        try {
          if (blob.size > 0) await onRecorded(blob, durationSeconds);
        } catch (error) {
          alert(error instanceof Error ? error.message : "Could not send voice memo.");
        } finally {
          setProcessing(false);
          recorderRef.current = null;
          streamRef.current = null;
        }
      };

      recorder.start();
      setRecording(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not start recording.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  if (recording) {
    return (
      <Button type="button" size="icon" variant="destructive" onClick={stopRecording} aria-label="Stop voice memo recording">
        <Square className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button type="button" size="icon" variant="outline" onClick={startRecording} disabled={disabled || processing} aria-label="Record voice memo">
      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
