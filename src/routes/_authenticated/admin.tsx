import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
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
  { to: "/admin/beats", label: "Beats", icon: Music },
  { to: "/admin/beat-requests", label: "Beat Requests", icon: Music },
  { to: "/admin/funnels", label: "Offer Page", icon: PanelsTopLeft },
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

function AdminLayout() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/beats" });
  }, [isAdmin, navigate]);

  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030915]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="admin-console min-h-screen overflow-x-hidden bg-[#030915] text-slate-100">
      <header className="border-b border-slate-800/80 bg-[#030915]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-3 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link to="/beats" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950/70 text-slate-400 transition hover:border-primary/60 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link to="/" className="min-w-0">
              <KrazyLogo className="text-base sm:text-xl" />
            </Link>
            <Badge variant="outline" className="hidden border-primary/40 bg-primary/10 text-primary sm:inline-flex">ADMIN</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 px-3 py-4 sm:px-6 sm:py-7 md:grid-cols-[250px_1fr] md:gap-8">
        <div className="md:hidden">
          <label className="sr-only" htmlFor="admin-mobile-nav">Admin section</label>
          <select
            id="admin-mobile-nav"
            value={NAV.find((item) => (item.exact ? path === item.to : path.startsWith(item.to)))?.to ?? "/admin"}
            onChange={(event) => navigate({ to: event.target.value as any })}
            className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-primary"
          >
            {NAV.map((item) => (
              <option key={item.to} value={item.to}>{item.label}</option>
            ))}
          </select>
        </div>

        <aside className="hidden rounded-2xl border border-slate-800/90 bg-slate-950/55 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.28)] md:block">
          <nav className="space-y-1">
            {NAV.map((item) => {
              const active = item.exact ? path === item.to : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-white shadow-[0_10px_30px_rgba(37,99,235,0.28)]"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Catalog Storage</p>
                <p className="mt-1 text-sm text-slate-200">Admin workspace</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-2/5 rounded-full bg-primary" />
            </div>
          </div>
        </aside>

        <main className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/45 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.24)] sm:p-5 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
