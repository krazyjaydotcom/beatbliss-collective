import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FREE_PLAY_LIMIT } from "@/lib/funnel-attribution";

export interface JoinCatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyForAccess: () => void;
}

export function JoinCatalogModal({ open, onOpenChange, onApplyForAccess }: JoinCatalogModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="text-xs font-bold tracking-wider text-primary">YOU'VE HEARD {FREE_PLAY_LIMIT}</p>
          <DialogTitle className="text-2xl">There are dozens more.</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Join the Beat Catalog to unlock the full library — fresh beats, full downloads, and
            members-only releases.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full font-bold"
            onClick={() => {
              onOpenChange(false);
              onApplyForAccess();
            }}
          >
            Apply for access
          </Button>
          <Link
            to="/login"
            className="text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Already a member? Log in
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
