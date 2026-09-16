import { useEffect } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BpmBucket = "all" | "under-80" | "80-99" | "100-119" | "120-139" | "140-plus";
export type SortKey = "newest" | "title" | "bpm";

export const BPM_BUCKETS: { value: BpmBucket; label: string; test: (bpm: number) => boolean }[] = [
  { value: "under-80", label: "Under 80", test: (b) => b < 80 },
  { value: "80-99", label: "80–99", test: (b) => b >= 80 && b < 100 },
  { value: "100-119", label: "100–119", test: (b) => b >= 100 && b < 120 },
  { value: "120-139", label: "120–139", test: (b) => b >= 120 && b < 140 },
  { value: "140-plus", label: "140+", test: (b) => b >= 140 },
];

export const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "title", label: "A–Z" },
  { value: "bpm", label: "Tempo" },
];

export function matchesBpm(bucket: BpmBucket, bpm: number | null): boolean {
  if (bucket === "all") return true;
  if (bpm === null) return false;
  return BPM_BUCKETS.find((b) => b.value === bucket)?.test(bpm) ?? true;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors",
        active
          ? "border-primary/70 bg-primary/15 text-primary"
          : "border-white/12 text-muted-foreground hover:border-white/25 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  genres,
  genre,
  bpm,
  sort,
  onGenre,
  onBpm,
  onSort,
}: {
  genres: string[];
  genre: string;
  bpm: BpmBucket;
  sort: SortKey;
  onGenre: (value: string) => void;
  onBpm: (value: BpmBucket) => void;
  onSort: (value: SortKey) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={genre === "all"} onClick={() => onGenre("all")}>
          All genres
        </Chip>
        {genres.map((g) => (
          <Chip key={g} active={genre === g} onClick={() => onGenre(g)}>
            {g}
          </Chip>
        ))}
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={bpm === "all"} onClick={() => onBpm("all")}>
          Any tempo
        </Chip>
        {BPM_BUCKETS.map((b) => (
          <Chip key={b.value} active={bpm === b.value} onClick={() => onBpm(b.value)}>
            {b.label}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 w-px shrink-0 self-center bg-white/10" />
        {SORTS.map((s) => (
          <Chip key={s.value} active={sort === s.value} onClick={() => onSort(s.value)}>
            {s.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function ActiveFilters({
  items,
  onReset,
}: {
  items: { label: string; onClear: () => void }[];
  onReset: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClear}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/15 px-3 text-xs font-medium text-primary"
        >
          {item.label}
          <X className="h-3.5 w-3.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Reset all
      </button>
    </div>
  );
}

/** Compact mobile entry point: a button plus a bottom sheet holding every control. */
export function FilterSheetTrigger({
  activeCount,
  onOpen,
  summary,
}: {
  activeCount: number;
  onOpen: () => void;
  summary: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-10 w-full items-center gap-2 rounded-full border border-white/12 px-4 text-left text-xs font-medium text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
    >
      <SlidersHorizontal className="h-4 w-4 shrink-0" />
      <span className="truncate">{summary}</span>
      {activeCount ? (
        <span className="ml-auto shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}

export function FilterSheet({
  open,
  onClose,
  onReset,
  ...bar
}: {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  genres: string[];
  genre: string;
  bpm: BpmBucket;
  sort: SortKey;
  onGenre: (value: string) => void;
  onBpm: (value: BpmBucket) => void;
  onSort: (value: SortKey) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Genre
            </h3>
            <div className="flex flex-wrap gap-2">
              <Chip active={bar.genre === "all"} onClick={() => bar.onGenre("all")}>
                All genres
              </Chip>
              {bar.genres.map((g) => (
                <Chip key={g} active={bar.genre === g} onClick={() => bar.onGenre(g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tempo
            </h3>
            <div className="flex flex-wrap gap-2">
              <Chip active={bar.bpm === "all"} onClick={() => bar.onBpm("all")}>
                Any tempo
              </Chip>
              {BPM_BUCKETS.map((b) => (
                <Chip key={b.value} active={bar.bpm === b.value} onClick={() => bar.onBpm(b.value)}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sort
            </h3>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <Chip key={s.value} active={bar.sort === s.value} onClick={() => bar.onSort(s.value)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="h-11 flex-1 rounded-xl border border-white/12 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
