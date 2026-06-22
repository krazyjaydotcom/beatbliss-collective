import { ArrowRight, Sparkles } from "lucide-react";

type Props = {
  onApplyForAccess: () => void;
};

export function StickyOfferBar({ onApplyForAccess }: Props) {
  return (
    <div className="fixed left-0 right-0 top-0 z-[60] border-b border-primary/40 bg-gradient-to-r from-primary/95 via-primary to-primary/95 text-primary-foreground shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs font-bold sm:text-sm">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <span className="hidden sm:inline">Limited time — </span>
            <span className="font-black">$49.99/yr</span>
            <span className="hidden text-primary-foreground/80 sm:inline"> · 12 beats/month</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onApplyForAccess}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/85 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-md transition hover:bg-black sm:px-4 sm:text-sm"
        >
          Get Access
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
