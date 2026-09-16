import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

import { listStoreBeats, type StoreBeat } from "@/lib/store.functions";
import { StoreShell, type StoreView } from "@/components/store/store-shell";
import { BeatRow } from "@/components/store/beat-row";
import {
  ActiveFilters,
  FilterBar,
  matchesBpm,
  type BpmBucket,
  type SortKey,
} from "@/components/store/filters";
import { BeatDetail, BeatDetailDrawer } from "@/components/store/beat-detail-drawer";
import { usePlayer } from "@/components/store/player-provider";
import { useSavedBeats } from "@/hooks/use-saved-beats";

const searchSchema = z.object({
  view: fallback(z.string(), "browse").default("browse"),
  q: fallback(z.string(), "").default(""),
  genre: fallback(z.string(), "all").default("all"),
  bpm: fallback(z.string(), "all").default("all"),
  sort: fallback(z.string(), "newest").default("newest"),
  beat: fallback(z.string().optional(), undefined),
  b: fallback(z.string().optional(), undefined),
});

const SITE = "https://mybeatcatalog.com";
const TITLE = "Find your next sound — MYBEATCATALOG";
const DESCRIPTION =
  "Browse and preview the MYBEATCATALOG beat catalog by KRAZYJAYDOTCOM. Listen free, filter by genre and tempo, and license the beat you want instantly.";

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  loader: () => listStoreBeats(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: SITE }],
  }),
  pendingComponent: () => (
    <div className="flex h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">
      Loading the catalog…
    </div>
  ),
  errorComponent: CatalogError,
  component: StorePage,
});

function CatalogError() {
  const router = useRouter();
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">
        The catalog didn&apos;t load. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => router.invalidate()}
        className="h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        Retry
      </button>
    </div>
  );
}

const VIEWS: StoreView[] = ["browse", "new", "charts", "saved"];

function StorePage() {
  const { beats, genres } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const player = usePlayer();
  const { savedIds, isSaved, toggle: toggleSaved } = useSavedBeats();

  const view = (VIEWS.includes(search.view as StoreView) ? search.view : "browse") as StoreView;
  const genre = search.genre;
  const bpm = search.bpm as BpmBucket;
  const sort = search.sort as SortKey;

  // Debounced search: the input stays instant, the URL follows.
  const [queryInput, setQueryInput] = useState(search.q);
  useEffect(() => {
    setQueryInput(search.q);
  }, [search.q]);
  useEffect(() => {
    if (queryInput === search.q) return;
    const t = setTimeout(() => {
      navigate({ search: (prev) => ({ ...prev, q: queryInput }), replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [queryInput, search.q, navigate]);

  const setSearch = (patch: Record<string, unknown>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const results = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    let list = beats.filter((b) => {
      if (q) {
        const haystack = `${b.title} ${b.producerName} ${b.genre ?? ""} ${b.mood ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (genre !== "all" && b.genre !== genre) return false;
      if (!matchesBpm(bpm, b.bpm)) return false;
      return true;
    });

    if (view === "saved") list = list.filter((b) => savedIds.includes(b.id));
    if (view === "new") {
      list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 30);
    } else if (view === "charts") {
      list = [...list]
        .sort((a, b) => {
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
          return a.createdAt < b.createdAt ? 1 : -1;
        })
        .slice(0, 20);
    } else {
      list = [...list].sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "bpm") return (a.bpm ?? 9999) - (b.bpm ?? 9999);
        return a.createdAt < b.createdAt ? 1 : -1;
      });
    }
    return list;
  }, [beats, search.q, genre, bpm, sort, view, savedIds]);

  const selected: StoreBeat | null = useMemo(() => {
    if (!search.beat) return null;
    return beats.find((b) => b.slug === search.beat || b.id === search.beat) ?? null;
  }, [beats, search.beat]);

  const openBeat = (b: StoreBeat) => setSearch({ beat: b.slug ?? b.id });
  const closeBeat = () => setSearch({ beat: undefined });

  const playBeat = (b: StoreBeat) => {
    if (player.current?.id === b.id) player.toggle();
    else player.play(b, results);
  };

  const activeFilters = [
    ...(genre !== "all" ? [{ label: genre, onClear: () => setSearch({ genre: "all" }) }] : []),
    ...(bpm !== "all" ? [{ label: `Tempo: ${bpm.replace("-plus", "+").replace("-", "–")}`, onClear: () => setSearch({ bpm: "all" }) }] : []),
    ...(search.q ? [{ label: `“${search.q}”`, onClear: () => setSearch({ q: "" }) }] : []),
  ];

  const heading =
    view === "new"
      ? { title: "New releases", sub: "The most recently added beats in the catalog." }
      : view === "charts"
        ? {
            title: "Producer picks",
            sub: "Curated by KRAZYJAYDOTCOM, ordered by featured status then release date — not a play-count or sales ranking.",
          }
        : view === "saved"
          ? { title: "Saved", sub: "Saved in this browser only. These do not sync between devices." }
          : { title: "Find your next sound", sub: `${beats.length} beats available to preview and license.` };

  const detail = selected ? (
    <BeatDetail
      beat={selected}
      isCurrent={player.current?.id === selected.id}
      isPlaying={player.isPlaying}
      isSaved={isSaved(selected.id)}
      onPlay={() => playBeat(selected)}
      onSave={() => toggleSaved(selected.id)}
    />
  ) : (
    <div className="text-sm text-muted-foreground">
      Select a beat to see its details and license options.
    </div>
  );

  return (
    <>
      <StoreShell
        view={view}
        onView={(v) => setSearch({ view: v })}
        query={queryInput}
        onQuery={setQueryInput}
        savedCount={savedIds.length}
        aside={detail}
      >
        <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-background/95 px-4 pb-3 pt-4 backdrop-blur sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{heading.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{heading.sub}</p>
          <div className="mt-3">
            <FilterBar
              genres={genres}
              genre={genre}
              bpm={bpm}
              sort={sort}
              onGenre={(v) => setSearch({ genre: v })}
              onBpm={(v) => setSearch({ bpm: v })}
              onSort={(v) => setSearch({ sort: v })}
            />
          </div>
          {activeFilters.length ? (
            <div className="mt-3">
              <ActiveFilters
                items={activeFilters}
                onReset={() => setSearch({ genre: "all", bpm: "all", q: "" })}
              />
            </div>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            {results.length} {results.length === 1 ? "beat" : "beats"}
          </p>
        </div>

        {results.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {view === "saved"
                ? "You haven't saved any beats in this browser yet."
                : "No beats match these filters."}
            </p>
            {activeFilters.length ? (
              <button
                type="button"
                onClick={() => setSearch({ genre: "all", bpm: "all", q: "" })}
                className="mt-4 h-11 rounded-full border border-white/12 px-5 text-sm font-medium hover:border-primary/60 hover:text-primary"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="pb-10">
            {results.map((b, i) => (
              <li key={b.id}>
                <BeatRow
                  beat={b}
                  rank={view === "charts" ? i + 1 : undefined}
                  isCurrent={player.current?.id === b.id}
                  isPlaying={player.isPlaying}
                  isSaved={isSaved(b.id)}
                  onPlay={() => playBeat(b)}
                  onSave={() => toggleSaved(b.id)}
                  onOpen={() => openBeat(b)}
                />
              </li>
            ))}
          </ul>
        )}
      </StoreShell>

      <BeatDetailDrawer
        beat={selected}
        onClose={closeBeat}
        isCurrent={player.current?.id === selected?.id}
        isPlaying={player.isPlaying}
        isSaved={selected ? isSaved(selected.id) : false}
        onPlay={() => selected && playBeat(selected)}
        onSave={() => selected && toggleSaved(selected.id)}
      />
    </>
  );
}
