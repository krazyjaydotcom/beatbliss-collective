import { useState } from "react";
import { MessageCircle, X, Mail } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export function PublicSupportButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Logged-in non-admin users already see the in-app ChatWidget.
  if (user) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-2xl hover:scale-105 transition flex items-center justify-center"
          aria-label="Open support"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <div>
              <div className="font-semibold">Need help?</div>
              <div className="text-xs text-muted-foreground">We usually reply within hours</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              Sign in to start a live chat with our team, or send us an email.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold hover:opacity-90"
              >
                Log in to chat
              </Link>
              <a
                href="mailto:support@krazyjay.com"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
              >
                <Mail className="h-4 w-4" /> Email support
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
