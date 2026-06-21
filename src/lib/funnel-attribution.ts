const PLAY_KEY = "mbc_home_plays_v1";
const SOURCE_KEY = "mbc_signup_source_beat";
const MAX_FREE_PLAYS = 5;

type PlayState = { count: number; beatIds: string[] };

function read(): PlayState {
  if (typeof window === "undefined") return { count: 0, beatIds: [] };
  try {
    const raw = window.localStorage.getItem(PLAY_KEY);
    if (!raw) return { count: 0, beatIds: [] };
    const parsed = JSON.parse(raw);
    return {
      count: Number(parsed.count) || 0,
      beatIds: Array.isArray(parsed.beatIds) ? parsed.beatIds : [],
    };
  } catch {
    return { count: 0, beatIds: [] };
  }
}

function write(state: PlayState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAY_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function getPlayCount(): number {
  return read().count;
}

export function recordBeatPlayed(beatId: string): number {
  const state = read();
  if (state.beatIds.includes(beatId)) return state.count;
  const next: PlayState = {
    count: state.count + 1,
    beatIds: [...state.beatIds, beatId],
  };
  write(next);
  return next.count;
}

export function hasReachedPlayLimit(): boolean {
  return read().count >= MAX_FREE_PLAYS;
}

export const FREE_PLAY_LIMIT = MAX_FREE_PLAYS;

export function rememberSignupSourceBeat(beatId: string | null | undefined) {
  if (typeof window === "undefined" || !beatId) return;
  try {
    window.localStorage.setItem(SOURCE_KEY, beatId);
  } catch {
    /* ignore */
  }
}

export function takeSignupSourceBeat(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(SOURCE_KEY);
    if (v) window.localStorage.removeItem(SOURCE_KEY);
    return v;
  } catch {
    return null;
  }
}
