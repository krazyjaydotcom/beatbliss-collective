import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, LogIn, Search, Sparkles, User, Waves, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { PlayerBar } from "@/components/store/player-bar";
import { CartButton } from "@/components/store/cart-sheet";

export type StoreView = "browse" | "new" | "saved";

export const STORE_VIEWS: { value: StoreView; label: string; icon: typeof Waves }[] = [
  { value: "browse", label: "Browse", icon: Waves },
  { value: "new", label: "New Releases", icon: Sparkles },
  { value: "saved", label: "Saved", icon: Heart },
];

function Brand() {
  return (
    <Link to="/" className="shrink-0 leading-none">
      <div className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
        MYBEAT<span className="text-primary">CATALOG</span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        by KRAZYJAYDOTCOM
      </div>
    </Link>
  );
}

export function StoreShell({
  view,
  onView,
  query,
  onQuery,
  savedCount,
  children,
  aside,
}: {
  view: StoreView;
  onView: (v: StoreView) => void;
  query: string;
  onQuery: (q: string) => void;
  savedCount: number;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-white/[0.08] px-4 py-3 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:gap-6">
          <Brand />
          <div className="order-last col-span-2 lg:order-none lg:col-span-1">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <span className="sr-only">Search beats</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search by title, producer or genre"
                className="h-11 w-full rounded-full border border-white/10 bg-white/[0.04] pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    onQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
          </div>
          <nav className="flex shrink-0 items-center gap-2">
            {user ? (
              <Link
                to="/account"
                aria-label="My account"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 px-3 text-xs font-medium text-foreground hover:border-primary/60 hover:text-primary sm:px-4"
              >
                <User className="h-4 w-4" aria-hidden />{" "}
                <span className="hidden sm:inline">My account</span>
              </Link>
            ) : (
              <Link
                to="/login"
                aria-label="Member login"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 px-3 text-xs font-medium text-foreground hover:border-primary/60 hover:text-primary sm:px-4"
              >
                <LogIn className="h-4 w-4" aria-hidden />{" "}
                <span className="hidden sm:inline">Member login</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[220px] shrink-0 overflow-y-auto border-r border-white/[0.08] px-3 py-5 lg:block">
          <ul className="space-y-1">
            {STORE_VIEWS.map((item) => (
              <li key={item.value}>
                <button
                  type="button"
                  onClick={() => onView(item.value)}
                  aria-current={view === item.value ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    view === item.value
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.value === "saved" && savedCount > 0 ? (
                    <span className="ml-auto text-xs tabular-nums">{savedCount}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-white/[0.08] pt-5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Membership</p>
            <p className="mt-1.5 leading-relaxed">
              Members get the full private catalog and classroom.
            </p>
            <Link
              to="/checkout"
              className="mt-3 inline-flex text-xs font-medium text-primary underline underline-offset-4"
            >
              Apply for access
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>

        {aside ? (
          <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-l border-white/[0.08] p-5 xl:block">
            {aside}
          </aside>
        ) : null}
      </div>

      <PlayerBar />

      <nav className="shrink-0 border-t border-white/[0.08] bg-card/95 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="grid grid-cols-3">
          {STORE_VIEWS.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                onClick={() => onView(item.value)}
                aria-current={view === item.value ? "page" : undefined}
                className={cn(
                  "flex h-14 w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                  view === item.value ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
