import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart3, MessageSquare, Users, ArrowLeft, Loader2, Music, Gift, Download, Eye, ShieldCheck, Megaphone } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { KrazyLogo } from "@/components/krazy-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — KRAZYJAYDOTCOM" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/beats", label: "Beats", icon: Music },
  { to: "/admin/import", label: "Import beats", icon: Download },
  { to: "/admin/whitelist", label: "Whitelist", icon: ShieldCheck },
  { to: "/admin/gift", label: "Gift credits", icon: Gift },
  { to: "/admin/support", label: "Support", icon: MessageSquare },
  { to: "/admin/online", label: "Online Users", icon: Users },
  { to: "/admin/agreements", label: "Agreements", icon: BarChart3 },
  { to: "/beats", label: "View as user", icon: Eye },
];

function AdminLayout() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/beats" });
  }, [isAdmin, navigate]);

  if (isAdmin !== true) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/beats" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <Link to="/"><KrazyLogo className="text-xl" /></Link>
            <Badge variant="secondary">ADMIN</Badge>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
