import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { validateInvite, claimInvite } from "@/lib/invites.functions";

export const Route = createFileRoute("/claim/$token")({
  component: ClaimPage,
});

interface InviteState {
  ok: boolean;
  email?: string;
  tierLabel?: string;
  reason?: "invalid" | "used" | "expired" | "revoked";
}

function ClaimPage() {
  const { token } = useParams({ from: "/claim/$token" });
  const navigate = useNavigate();
  const validateFn = useServerFn(validateInvite);
  const claimFn = useServerFn(claimInvite);

  const [invite, setInvite] = useState<InviteState | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    validateFn({ data: { token } }).then((res) => setInvite(res));
  }, [token, validateFn]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const result = await claimFn({ data: { token, password } });
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }
    // Sign in the new user
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: result.email!,
      password,
    });
    if (signInErr) {
      setError("Account created. Please log in.");
      navigate({ to: "/login" });
      return;
    }
    navigate({ to: "/beats" });
  };

  if (!invite) {
    return (
      <Shell>
        <p className="text-muted-foreground">Validating your invite…</p>
      </Shell>
    );
  }

  if (!invite.ok) {
    const messages: Record<string, { title: string; body: string }> = {
      invalid: {
        title: "Invite link not found",
        body: "This link is invalid. Double-check the URL or contact support.",
      },
      used: {
        title: "Invite already claimed",
        body: "This link has already been used. Try logging in instead.",
      },
      expired: {
        title: "Invite expired",
        body: "Claim links are valid for 7 days. Contact support and we'll send you a new one.",
      },
      revoked: {
        title: "Invite revoked",
        body: "This invite is no longer valid. Contact support if you believe this is a mistake.",
      },
    };
    const m = messages[invite.reason ?? "invalid"];
    return (
      <Shell>
        <h1 className="text-2xl font-bold">{m.title}</h1>
        <p className="mt-2 text-muted-foreground">{m.body}</p>
        <div className="mt-6 flex gap-3">
          <Button variant="hero" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button variant="heroOutline" asChild>
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs font-bold tracking-wider text-primary">YOU'RE IN</p>
      <h1 className="mt-2 text-3xl font-bold">Set your password</h1>
      <p className="mt-2 text-muted-foreground">
        Claiming <span className="text-foreground font-medium">{invite.tierLabel}</span> for{" "}
        <span className="text-foreground font-medium">{invite.email}</span>.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input
          type="email"
          value={invite.email}
          disabled
          className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        />
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Confirm password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account & enter"}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-2xl font-black tracking-tight mb-8">
          KRAZYJAY<span className="text-primary">DOTCOM</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8">{children}</div>
      </div>
    </div>
  );
}
