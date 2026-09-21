import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  MessageSquare,
  Users,
  ArrowLeft,
  Loader2,
  Music,
  Gift,
  Download,
  Eye,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Link2,
  Clock,
  PanelsTopLeft,
  Tag,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Mail,
  Menu,
  Wallet,
  CheckSquare,
  Contact,
  LayoutGrid,
  X,
} from "lucide-react";

import { useIsAdmin } from "@/hooks/use-is-admin";
import { KrazyLogo } from "@/components/krazy-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin - MYBEATCATALOG" }] }),
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { to: "/admin", label: "Overview", icon: BarChart3, exact: true },
      { to: "/admin/customers", label: "Customers", icon: Contact },
      { to: "/admin/tasks", label: "Tasks", icon: CheckSquare },
    ],
  },
  {
    title: "Catalog",
    items: [
      { to: "/admin/beats", label: "Beats", icon: Music },
      { to: "/admin/beat-landing", label: "Landing Pages", icon: Link2 },
      { to: "/admin/beat-requests", label: "Beat Requests", icon: Music },
      { to: "/admin/import", label: "Import Beats", icon: Download },
      { to: "/admin/tags", label: "Tags", icon: Tag },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/admin/sales", label: "Sales & Downloads", icon: Wallet },
      { to: "/admin/members", label: "Members", icon: Users },
      { to: "/admin/agreements", label: "Agreements", icon: FileText },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/email-templates", label: "Email Templates", icon: Mail },
      { to: "/admin/invites", label: "Invites", icon: Link2 },
      { to: "/admin/funnels", label: "Offer Page", icon: PanelsTopLeft },
      { to: "/admin/seo-pages", label: "SEO Pages", icon: FileText },
      { to: "/admin/home-gallery", label: "Home Gallery", icon: ImageIcon },
      { to: "/admin/commercials", label: "Commercials", icon: Megaphone },
      { to: "/admin/analytics", label: "Plays & Ads", icon: BarChart3 },
      { to: "/admin/audio-tag", label: "Audio Tag", icon: Tag },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/admin/access-applications", label: "Access Applications", icon: UserCheck },
      { to: "/admin/access-questions", label: "Access Questions", icon: FileText },
      { to: "/admin/access", label: "Manual Access", icon: UserCheck },
      { to: "/admin/beat-claims", label: "Beat Claims", icon: Clock },
      { to: "/admin/classroom", label: "Classroom", icon: GraduationCap },
      { to: "/admin/whitelist", label: "Whitelist", icon: ShieldCheck },
      { to: "/admin/gift", label: "Gift Credits", icon: Gift },
      { to: "/admin/support", label: "Support", icon: MessageSquare },
      { to: "/admin/online", label: "Online Users", icon: Users },
      { to: "/beats", label: "View as User", icon: Eye },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { to: "/admin/customers", label: "Customers", icon: Contact },
  { to: "/admin/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/admin/beats", label: "Catalog", icon: Music },
];

function isActive(path: string, item: NavItem) {
  return item.exact ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function NavLinkRow({ item, path, onNavigate }: { item: NavItem; path: string; onNavigate?: () => void }) {
  const active = isActive(path, item);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function AdminLayout() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const now = useNow();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navGroup, setNavGroup] = useState("Workspace");
  useEffect(() => {
    const group = NAV_GROUPS.find((g) => g.items.some((item) => isActive(path, item)));
    if (group) setNavGroup(group.title);
  }, [path]);

  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/beats" });
  }, [isAdmin, navigate]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [path]);

  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dateStr = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
              aria-label="Open admin menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to="/beats"
              className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              aria-label="Back to site"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link to="/" className="min-w-0">
              <KrazyLogo className="text-sm sm:text-base" />
            </Link>
            <Badge variant="outline" className="hidden border-primary/40 bg-primary/10 text-primary sm:inline-flex">
              ADMIN
            </Badge>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{dateStr}</div>
            <div className="text-sm font-semibold tabular-nums">{timeStr}</div>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-label="All admin destinations"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 flex h-full w-[19rem] max-w-[88vw] flex-col border-r border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <KrazyLogo className="text-base" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 pb-[env(safe-area-inset-bottom)]">
              {NAV_GROUPS.map((g) => (
                <div key={g.title} className="mb-4">
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                    {g.title}
                  </div>
                  <div className="space-y-0.5">
                    {g.items.map((item) => (
                      <NavLinkRow key={item.to} item={item} path={path} onNavigate={() => setDrawerOpen(false)} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-[1600px] min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden px-3 py-3 sm:px-5 md:grid-cols-[208px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-y-auto overscroll-contain md:block">
          <nav className="space-y-2 pr-1" aria-label="Admin sections">
            <label className="mb-3 block">
              <span className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Jump to
              </span>
              <select
                aria-label="Jump to admin page"
                value={NAV_GROUPS.flatMap((g) => g.items).some((i) => i.to === path) ? path : "/admin"}
                onChange={(e) => navigate({ to: e.target.value })}
                className="h-11 w-full rounded-lg border border-border bg-card px-2 text-xs"
              >
                {NAV_GROUPS.map((g) => (
                  <optgroup key={g.title} label={g.title}>
                    {g.items.map((i) => (
                      <option key={i.to} value={i.to}>
                        {i.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {NAV_GROUPS.map((g) => (
              <div key={g.title} className="rounded-xl border border-border/60 bg-card/40">
                <button
                  type="button"
                  aria-expanded={navGroup === g.title}
                  aria-controls={"admin-nav-" + g.title}
                  onClick={() => setNavGroup(navGroup === g.title ? "" : g.title)}
                  className="flex min-h-11 w-full items-center justify-between px-3 text-xs font-semibold"
                >
                  <span>{g.title}</span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    {navGroup === g.title ? "−" : "+"}
                  </span>
                </button>
                <div id={"admin-nav-" + g.title} hidden={navGroup !== g.title} className="space-y-0.5 px-1 pb-1">
                  {g.items.map((item) => (
                    <NavLinkRow key={item.to} item={item} path={path} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main
          key={path}
          className={cn(
            "min-h-0 min-w-0 max-w-full overscroll-contain",
            path === "/admin" || path === "/admin/" || path === "/admin/beat-landing"
              ? "overflow-hidden"
              : "overflow-y-auto",
          )}
        >
          <Outlet />
        </main>
      </div>

      <nav
        className="md:hidden shrink-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Primary"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = isActive(path, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"
            aria-label="More destinations"
          >
            <LayoutGrid className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
