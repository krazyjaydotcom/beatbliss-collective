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
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  AUDIO_TAG_DEFAULTS,
  fetchAudioTagSettings,
  type AudioTagSettings,
} from "@/lib/audio-tag";
import { AdOverlay, fetchActiveAds, pickNextAd, type AdSpot } from "./ad-overlay";

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

// Guests hear a short sponsor message after 5 beats or 10 minutes of listening,
// whichever comes first. Signed-in listeners are never metered.
const BEAT_LIMIT = 5;
const SECONDS_LIMIT = 600;
const METER_KEY = "mbc.listen.meter";

type Meter = { beats: number; seconds: number };

function readMeter(): Meter {
  if (typeof window === "undefined") return { beats: 0, seconds: 0 };
  try {
    const raw = sessionStorage.getItem(METER_KEY);
    if (!raw) return { beats: 0, seconds: 0 };
    const parsed = JSON.parse(raw) as Partial<Meter>;
    return { beats: Number(parsed.beats) || 0, seconds: Number(parsed.seconds) || 0 };
  } catch {
    return { beats: 0, seconds: 0 };
  }
}

function writeMeter(meter: Meter) {
  try {
    sessionStorage.setItem(METER_KEY, JSON.stringify(meter));
  } catch {
    /* storage unavailable — the meter simply resets on reload */
  }
}

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

  const { user } = useAuth();
  const isGuest = !user;
  const isGuestRef = useRef(isGuest);
  isGuestRef.current = isGuest;

  const meterRef = useRef<Meter>({ beats: 0, seconds: 0 });
  const lastTimeRef = useRef(0);
  const adsRef = useRef<AdSpot[] | null>(null);
  const pendingRef = useRef<{ beat: StoreBeat; queue?: StoreBeat[] } | null>(null);
  const [ad, setAd] = useState<AdSpot | null>(null);

  // Producer audio tag laid over previews.
  const tagRef = useRef<HTMLAudioElement | null>(null);
  const tagSettingsRef = useRef<AudioTagSettings>(AUDIO_TAG_DEFAULTS);
  const nextTagAtRef = useRef<number>(Number.POSITIVE_INFINITY);
  const [tagUrl, setTagUrl] = useState<string | null>(null);

  // Stable per-browser key so repeated plays can be grouped without identifying anyone.
  const sessionKeyRef = useRef<string>("");

  useEffect(() => {
    meterRef.current = readMeter();
    try {
      let key = sessionStorage.getItem("mbc.session.key");
      if (!key) {
        key = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem("mbc.session.key", key);
      }
      sessionKeyRef.current = key;
    } catch {
      sessionKeyRef.current = "";
    }
    void fetchAudioTagSettings().then((s) => {
      tagSettingsRef.current = s;
      if (s.isEnabled && s.tagUrl) setTagUrl(s.tagUrl);
    });
  }, []);

  const resetMeter = useCallback(() => {
    meterRef.current = { beats: 0, seconds: 0 };
    writeMeter(meterRef.current);
  }, []);

  const playNow = useCallback((beat: StoreBeat, nextQueue?: StoreBeat[]) => {
    const audio = audioRef.current;
    if (!audio || !beat.previewUrl) {
      setStatus("error");
      return;
    }
    if (nextQueue && nextQueue.length) setQueue(nextQueue);
    setCurrent(beat);
    setProgress(0);
    lastTimeRef.current = 0;
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

    const tag = tagSettingsRef.current;
    nextTagAtRef.current =
      tag.isEnabled && tag.tagUrl ? tag.startOffsetSeconds : Number.POSITIVE_INFINITY;

    // Play counter (admin analytics). Never blocks playback.
    void (supabase as any)
      .rpc("record_beat_play", { _beat_id: beat.id, _session_key: sessionKeyRef.current || null })
      .then(() => undefined, () => undefined);

    if (isGuestRef.current) {
      meterRef.current = { ...meterRef.current, beats: meterRef.current.beats + 1 };
      writeMeter(meterRef.current);
    }
  }, []);

  const start = useCallback(
    (beat: StoreBeat, nextQueue?: StoreBeat[]) => {
      const meter = meterRef.current;
      const overLimit = meter.beats >= BEAT_LIMIT || meter.seconds >= SECONDS_LIMIT;
      if (!isGuestRef.current || !overLimit) {
        playNow(beat, nextQueue);
        return;
      }

      // Hold the requested beat, show the sponsor message, resume right after.
      audioRef.current?.pause();
      setIsPlaying(false);
      pendingRef.current = { beat, queue: nextQueue };

      const show = (list: AdSpot[]) => {
        const spot = pickNextAd(list);
        if (!spot) {
          pendingRef.current = null;
          resetMeter();
          playNow(beat, nextQueue);
          return;
        }
        setAd(spot);
      };

      if (adsRef.current) {
        show(adsRef.current);
      } else {
        void fetchActiveAds().then((list) => {
          adsRef.current = list;
          show(list);
        });
      }
    },
    [playNow, resetMeter],
  );

  const finishAd = useCallback(() => {
    setAd(null);
    resetMeter();
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) playNow(pending.beat, pending.queue);
  }, [playNow, resetMeter]);

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
    lastTimeRef.current = seconds;
    setProgress(seconds);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(value);
    if (audioRef.current) audioRef.current.volume = value;
  }, []);

  const retry = useCallback(() => {
    if (current) playNow(current);
  }, [current, playNow]);

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
      {ad ? <AdOverlay ad={ad} onDone={finishAd} /> : null}
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          const delta = t - lastTimeRef.current;
          lastTimeRef.current = t;
          if (isGuestRef.current && delta > 0 && delta < 2) {
            meterRef.current = {
              ...meterRef.current,
              seconds: meterRef.current.seconds + delta,
            };
            writeMeter(meterRef.current);
          }
          if (t >= nextTagAtRef.current) {
            const tag = tagRef.current;
            nextTagAtRef.current = t + tagSettingsRef.current.intervalSeconds;
            if (tag) {
              tag.volume = tagSettingsRef.current.volume;
              tag.currentTime = 0;
              void tag.play().catch(() => undefined);
            }
          }
          setProgress(t);
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setStatus("ready");
        }}
        onPlaying={() => {
          setStatus("ready");
          setIsPlaying(true);
        }}
        onWaiting={() => setStatus("loading")}
        onPause={() => {
          setIsPlaying(false);
          tagRef.current?.pause();
        }}
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
