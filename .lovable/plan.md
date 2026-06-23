## Goal
Reset the free preview counter every 24 hours so daily email recipients can listen to that day's beats without hitting the "Get Access" wall from a previous day.

## Approach
The preview limit lives entirely in the browser (`src/lib/funnel-attribution.ts`, key `mbc_home_plays_v1`). Today it stores `{ count, beatIds[] }` forever. We'll add a rolling 24‑hour window:

- Add a `windowStartedAt` timestamp to the stored state.
- On every read, if `Date.now() - windowStartedAt >= 24h`, treat state as empty (count 0, no beatIds) and persist the reset.
- On the first play after a reset, stamp a new `windowStartedAt`.
- `getPlayCount`, `hasReachedPlayLimit`, and `recordBeatPlayed` all go through the same helper so the player UI ("Previews left X / 5") updates correctly.

No backend, no schema, no other components change. The `HomeFunnelPlayer` already re-reads `getPlayCount()` on mount, so the next time a user opens an emailed beat link the counter shows 5/5 again.

## Edge cases
- Same-day repeat visits: window persists, count keeps accumulating (intended).
- Clock changes / very old timestamps: any `windowStartedAt` more than 24h old (or in the future) triggers a reset.
- Existing users with no `windowStartedAt` in storage: treated as expired on next load, so they get a fresh 5 previews once — acceptable.

## Files
- `src/lib/funnel-attribution.ts` — add `WINDOW_MS = 24 * 60 * 60 * 1000`, extend `PlayState` with `windowStartedAt`, add `readFresh()` that auto-resets, update `getPlayCount`, `hasReachedPlayLimit`, `recordBeatPlayed`.

That's the entire change.