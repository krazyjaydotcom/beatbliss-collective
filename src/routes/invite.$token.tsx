import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/invite/$token")({
  component: InviteTokenPage,
});

function InviteTokenPage() {
  const { token } = useParams({ from: "/invite/$token" });
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "invalid" | "used" | "redirecting">("loading");

  useEffect(() => {
    const checkInvite = async () => {
      const { data, error } = await (supabase as any).rpc("get_invite_by_token", {
        _token: token,
      });

      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setState("invalid");
        return;
      }

      if (row.used_at) {
        setState("used");
        return;
      }

      window.localStorage.setItem("pendingInviteToken", token);
      setState("redirecting");
      navigate({ to: "/checkout", search: { invite: token } as any });
    };

    void checkInvite();
  }, [navigate, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        {state === "loading" || state === "redirecting" ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="mt-4 text-2xl font-black tracking-tight">Checking your invite…</h1>
            <p className="mt-2 text-sm text-muted-foreground">We're validating your access and sending you to checkout.</p>
          </>
        ) : state === "used" ? (
          <>
            <h1 className="text-2xl font-black tracking-tight">Invite already used</h1>
            <p className="mt-2 text-sm text-muted-foreground">This invite has already been claimed. Try logging in instead.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild><Link to="/login">Log In</Link></Button>
              <Button variant="outline" asChild><Link to="/">Home</Link></Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black tracking-tight">Invite not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This invite link is invalid or unavailable.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" asChild><Link to="/">Back Home</Link></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
