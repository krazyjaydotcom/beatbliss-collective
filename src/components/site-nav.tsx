import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { KrazyLogo } from "@/components/krazy-logo";

type SiteNavProps = {
  onApplyForAccess?: () => void;
};

export function SiteNav({ onApplyForAccess: _onApplyForAccess }: SiteNavProps = {}) {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();
  const [menuOpen, setMenuOpen] = useState(false);

  const loggedInLinks = [
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
    { to: "/beats", label: "Beat Catalog" },
    { to: "/account", label: "My Account" },
    { to: "/classroom", label: "Classroom" },
    { to: "/downloads", label: "Downloads" },
  ];

  return (
    <header className="absolute left-0 right-0 top-0 z-50">
      <nav className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="text-2xl font-black tracking-tight">
          <KrazyLogo className="text-2xl" />
        </Link>

        <div className="relative flex items-center gap-3">
          {!loading && user ? (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white transition hover:border-primary/60 hover:text-primary"
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-14 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#05070c]/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur animate-in fade-in zoom-in-95 duration-200">
                  {loggedInLinks.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to as any}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
