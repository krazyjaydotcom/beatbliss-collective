import { useCallback, useEffect, useState } from "react";

/**
 * Saved beats are stored in this browser only. There is no cross-device sync,
 * and the UI must not claim there is one.
 */
const KEY = "mbc.saved-beats.v1";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

const listeners = new Set<(ids: string[]) => void>();

function broadcast(ids: string[]) {
  listeners.forEach((fn) => fn(ids));
}

export function useSavedBeats() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const fn = (next: string[]) => setIds(next);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id) ? current.filter((v) => v !== id) : [id, ...current];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
    broadcast(next);
  }, []);

  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);

  return { savedIds: ids, isSaved, toggle };
}
