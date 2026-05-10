import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ChatWidget } from "@/components/ChatWidget";
import { usePresenceBroadcast } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  usePresenceBroadcast(user, path);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: window.location.pathname } });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <Outlet />
      <ChatWidget />
    </>
  );
}
