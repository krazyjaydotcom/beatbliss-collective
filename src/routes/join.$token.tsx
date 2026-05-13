import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { validateJoinToken, claimJoinInvite } from "@/lib/join.functions";

export const Route = createFileRoute("/join/$token")({
  head: () => ({ meta: [{ title: "Join — MYBEATCATALOG" }] }),
  component: JoinPage,
});

type Status =
  | { state: "loading" }
  | { state: "valid" }
  | { state: "invalid"; reason: "invalid" | "used" | "expired" | "revoked" };

function JoinPage() {
  const { token } = useParams({ from: "/join/$token" });
  const navigate = useNavigate();
  const validateFn = useServerFn(validateJoinToken);
  const claimFn = useServerFn(claimJoinInvite);

  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    validateFn({ data: { token } }).then((res) => {
      if (res.ok) setStatus({ state: "valid" });
      else setStatus({ state: "invalid", reason: res.reason });
    });
  }, [token, validateFn]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setSubmitting(true);
    const result = await claimFn({
      data: { token, email, password, firstName, lastName },
    });
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: result.email!,
      password,
    });
    if (signInErr) {
      toast.success("Account created. Please log in.");
      navigate({ to: "/login" });
      return;
    }
    toast.success("Welcome! Your account is ready.");
    navigate({ to: "/beats" });
  };

  if (status.state === "loading") {
    return (
      <Shell>
        <p className="text-muted-foreground">Validating your invite…</p>
      </Shell>
    );
  }

  if (status.state === "invalid") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Invite link unavailable</h1>
        <p className="mt-3 text-muted-foreground">
          This invite link is no longer valid. Please contact KrazyJay for a new one.
        </p>
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
      <p className="text-xs font-bold tracking-wider text-primary">YOU'RE INVITED</p>
      <h1 className="mt-2 text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-muted-foreground">
        Set up your free member access. No payment required.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">First name</label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Last name</label>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
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
          {submitting ? "Creating account…" : "Create my account"}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-2xl font-black tracking-tight mb-8">
          KRAZYJAY<span className="text-primary">DOTCOM</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8">{children}</div>
      </div>
    </div>
  );
}
