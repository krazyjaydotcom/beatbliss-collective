import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; plan?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { redirect, plan } = useSearch({ from: "/signup" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
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
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start downloading premium beats today.</p>
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              search={{ plan, redirect }}
              className="text-primary font-medium hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
