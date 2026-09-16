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
