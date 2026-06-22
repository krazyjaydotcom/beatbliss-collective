import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Crown } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FREE_PLAY_LIMIT } from "@/lib/funnel-attribution";

export interface JoinCatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyForAccess: () => void;
}

const BENEFITS = [
  "Download up to 12 beats every month",
  "Full monetization rights on every release",
  "New beats every week + members-only drops",
  "Direct line to KrazyJay",
];

export function JoinCatalogModal({ open, onOpenChange, onApplyForAccess }: JoinCatalogModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <div className="bg-gradient-to-br from-primary/25 via-background to-background p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
            <Crown className="h-3 w-3" />
            You've heard {FREE_PLAY_LIMIT} previews
          </div>
          <h2 className="mt-3 text-3xl font-black leading-tight">
            Unlock the <span className="text-primary">entire catalog</span> for $49.99/mo.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Limited time offer — dozens more beats, with new drops every week.
          </p>

          <ul className="mt-5 space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-end gap-2 rounded-xl border border-border bg-card/70 p-4">
            <span className="text-4xl font-black tracking-tight">$49.99</span>
            <span className="pb-1.5 text-sm text-muted-foreground">/ month</span>
            <span className="ml-auto rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
              Limited time
            </span>
          </div>

          <Button
            size="lg"
            variant="hero"
            className="mt-5 w-full"
            onClick={() => {
              onOpenChange(false);
              onApplyForAccess();
            }}
          >
            Apply For Access
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Link
            to="/login"
            className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Already a member? Log in →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
