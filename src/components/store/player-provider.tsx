import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { StoreBeat } from "@/lib/store.functions";

type Status = "idle" | "loading" | "ready" | "error";

type PlayerValue = {
  current: StoreBeat | null;
  queue: StoreBeat[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  status: Status;
  play: (beat: StoreBeat, queue?: StoreBeat[]) => void;
  toggle: (beat?: StoreBeat, queue?: StoreBeat[]) => void;
  pause: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  previous: () => void;
  setVolume: (value: number) => void;
  retry: () => void;
};

const PlayerContext = createContext<PlayerValue | null>(null);

/**
 * ONE persistent <audio> element for the whole app. It lives above the router
 * outlet, so playback survives searching, filtering, opening detail drawers and
 * full route changes. Nothing ever autoplays before a user gesture.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<StoreBeat[]>([]);
  const [current, setCurrent] = useState<StoreBeat | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [status, setStatus] = useState<Status>("idle");

  const start = useCallback((beat: StoreBeat, nextQueue?: StoreBeat[]) => {
    const audio = audioRef.current;
    if (!audio || !beat.previewUrl) {
      setStatus("error");
      return;
    }
    if (nextQueue && nextQueue.length) setQueue(nextQueue);
    setCurrent(beat);
    setProgress(0);
    setDuration(beat.durationSeconds ?? 0);
    setStatus("loading");
    audio.src = beat.previewUrl;
    audio.load();
    void audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setIsPlaying(false);
        setStatus("error");
      });
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(
    (beat?: StoreBeat, nextQueue?: StoreBeat[]) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (beat && beat.id !== current?.id) {
        start(beat, nextQueue);
        return;
      }
      if (!current) return;
      if (audio.paused) {
        void audio.play().then(() => setIsPlaying(true)).catch(() => setStatus("error"));
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    },
    [current, start],
  );

  const step = useCallback(
    (delta: number) => {
      if (!current) return;
      const idx = queue.findIndex((b) => b.id === current.id);
      if (idx < 0) return;
      const target = queue[(idx + delta + queue.length) % queue.length];
      if (target) start(target);
    },
    [current, queue, start],
  );

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(seconds)) return;
    audio.currentTime = seconds;
    setProgress(seconds);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(value);
    if (audioRef.current) audioRef.current.volume = value;
  }, []);

  const retry = useCallback(() => {
    if (current) start(current);
  }, [current, start]);

  const value = useMemo<PlayerValue>(
    () => ({
      current,
      queue,
      isPlaying,
      progress,
      duration,
      volume,
      status,
      play: start,
      toggle,
      pause,
      seek,
      next: () => step(1),
      previous: () => step(-1),
      setVolume,
      retry,
    }),
    [current, queue, isPlaying, progress, duration, volume, status, start, toggle, pause, seek, step, setVolume, retry],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setStatus("ready");
        }}
        onPlaying={() => {
          setStatus("ready");
          setIsPlaying(true);
        }}
        onWaiting={() => setStatus("loading")}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setStatus("error");
          setIsPlaying(false);
        }}
        onEnded={() => step(1)}
        className="hidden"
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}

export function formatTime(seconds: number | null | undefined): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return "—:—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Keep the audio element volume in sync when a provider remounts.
export function useSyncedVolume() {
  const { volume, setVolume } = usePlayer();
  useEffect(() => {
    setVolume(volume);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
