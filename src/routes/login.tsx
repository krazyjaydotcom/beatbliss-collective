import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; plan?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect, plan } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (plan) {
      navigate({ to: "/checkout", search: { plan } });
    } else {
      navigate({ to: redirect ?? "/account" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-2xl font-black tracking-tight mb-8">
          KRAZYJAY<span className="text-primary">DOTCOM</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8">
          <h1 className="text-2xl font-bold">Log in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Let's get to work.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Logging in…" : "Log in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link
              to="/signup"
              search={{ plan, redirect }}
              className="text-primary font-medium hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
