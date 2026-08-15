import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
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
  Mail,
  Menu,
  Wallet,
} from "lucide-react";


import { useIsAdmin } from "@/hooks/use-is-admin";
import { KrazyLogo } from "@/components/krazy-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin - MYBEATCATALOG" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/sales", label: "Sales & Downloads", icon: Wallet },
  { to: "/admin/beats", label: "Beats", icon: Music },
  { to: "/admin/beat-landing", label: "Beat Landing Pages", icon: Link2 },
  { to: "/admin/email-templates", label: "Email Templates", icon: Mail },
  { to: "/admin/home-gallery", label: "Home Gallery", icon: ImageIcon },
  { to: "/admin/access-questions", label: "Access Questions", icon: FileText },
  { to: "/admin/access-applications", label: "Access Applications", icon: UserCheck },
  { to: "/admin/beat-requests", label: "Beat Requests", icon: Music },
  { to: "/admin/funnels", label: "Offer Page", icon: PanelsTopLeft },
  { to: "/admin/seo-pages", label: "SEO Pages", icon: FileText },
  { to: "/admin/tags", label: "Tags", icon: Tag },
  { to: "/admin/beat-claims", label: "Beat Claims", icon: Clock },
  { to: "/admin/members", label: "Members", icon: Users },
  { to: "/admin/access", label: "Manual Access", icon: UserCheck },
  { to: "/admin/invites", label: "Invites", icon: Link2 },
  { to: "/admin/classroom", label: "Classroom", icon: GraduationCap },
  { to: "/admin/import", label: "Import Beats", icon: Download },
  { to: "/admin/whitelist", label: "Whitelist", icon: ShieldCheck },
  { to: "/admin/gift", label: "Gift Credits", icon: Gift },
  { to: "/admin/support", label: "Support", icon: MessageSquare },
  { to: "/admin/online", label: "Online Users", icon: Users },
  { to: "/admin/agreements", label: "Agreements", icon: BarChart3 },
  { to: "/beats", label: "View as User", icon: Eye },
];

// Prioritized set for the mobile bottom bar.
const MOBILE_NAV = [
  { to: "/admin", label: "Home", icon: BarChart3, exact: true },
  { to: "/admin/beats", label: "Beats", icon: Music },
  { to: "/admin/beat-landing", label: "Landing", icon: Link2 },
  { to: "/admin/sales", label: "Sales", icon: Wallet },
  { to: "/admin/members", label: "Members", icon: Users },
] as const;

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function AdminLayout() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const now = useNow();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/beats" });
  }, [isAdmin, navigate]);

  useEffect(() => { setDrawerOpen(false); }, [path]);

  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030915]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="admin-console min-h-screen overflow-x-hidden bg-[#030915] text-slate-100 pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#030915]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/70 text-slate-300 hover:text-white"
              aria-label="Open admin menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/beats" className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950/70 text-slate-400 transition hover:border-primary/60 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link to="/" className="min-w-0">
              <KrazyLogo className="text-sm sm:text-lg" />
            </Link>
            <Badge variant="outline" className="hidden border-primary/40 bg-primary/10 text-primary sm:inline-flex">ADMIN</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">{dateStr}</div>
              <div className="text-sm font-semibold text-slate-200">{timeStr}</div>
            </div>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950/70 text-slate-300 hover:text-white" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/70" onClick={() => setDrawerOpen(false)}>
          <aside
            className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto border-r border-slate-800 bg-[#050b18] p-3 shadow-2xl animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <KrazyLogo className="text-base" />
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white" aria-label="Close menu">✕</button>
            </div>
            <nav className="space-y-1">
              {NAV.map((item) => {
                const active = item.exact ? path === item.to : path.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-primary text-white" : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 px-3 py-4 sm:px-6 sm:py-6 md:grid-cols-[240px_1fr] md:gap-6">
        <aside className="hidden rounded-2xl border border-slate-800/90 bg-slate-950/55 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.28)] md:block md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
          <nav className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.exact ? path === item.to : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-white shadow-[0_10px_30px_rgba(37,99,235,0.28)]"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/45 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.24)] sm:p-5 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-[#030915]/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = "exact" in item && item.exact ? path === item.to : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                  active ? "text-primary" : "text-slate-400 hover:text-white",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

