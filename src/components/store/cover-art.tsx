import { cn } from "@/lib/utils";

/**
 * Honest fallback artwork.
 *
 * Real supplied cover art always wins. When a beat genuinely has no artwork we
 * render a deterministic typographic tile derived from the title, so the
 * catalog reads as designed rather than as a column of identical grey boxes.
 * Nothing here implies data the catalog does not have.
 */

const PALETTES: { from: string; to: string; ink: string }[] = [
  { from: "#1f2937", to: "#0b1220", ink: "#93c5fd" },
  { from: "#1e293b", to: "#0f172a", ink: "#bae6fd" },
  { from: "#262626", to: "#111111", ink: "#e5e5e5" },
  { from: "#1c2b3a", to: "#0d1a26", ink: "#7dd3fc" },
  { from: "#2a2320", to: "#141110", ink: "#fcd9a8" },
  { from: "#1b2a24", to: "#0c1512", ink: "#a7f3d0" },
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(title: string): string {
  const words = title.replace(/\(.*?\)/g, " ").split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return "MB";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function CoverArt({
  title,
  seed,
  src,
  className,
  textClassName,
}: {
  title: string;
  seed: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  const h = hash(seed || title);
  const palette = PALETTES[h % PALETTES.length];
  const angle = 25 + (h % 5) * 30;
  const dot = 20 + (h % 4) * 20;

  return (
    <div
      aria-hidden
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ background: `linear-gradient(${angle}deg, ${palette.from}, ${palette.to})` }}
    >
      <div
        className="absolute rounded-full opacity-25"
        style={{
          background: palette.ink,
          width: "120%",
          height: "120%",
          left: `${dot - 45}%`,
          top: `${45 - dot}%`,
          filter: "blur(22px)",
        }}
      />
      <div
        className="absolute inset-x-0 top-1/2 h-px opacity-40"
        style={{ background: palette.ink, transform: `rotate(${(h % 2 ? -1 : 1) * 12}deg)` }}
      />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[13px] font-semibold tracking-[0.12em]",
          textClassName,
        )}
        style={{ color: palette.ink }}
      >
        {initials(title)}
      </span>
    </div>
  );
}
