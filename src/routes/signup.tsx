import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
  component: SignupClosed,
});

function SignupClosed() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-2xl font-black tracking-tight mb-8">
          KRAZYJAY<span className="text-primary">DOTCOM</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-xs font-bold tracking-wider text-primary">INVITE-ONLY</p>
          <h1 className="mt-2 text-2xl font-bold">Membership required</h1>
          <p className="mt-3 text-muted-foreground">
            Accounts are created automatically when you subscribe. Choose a plan and we'll email you a
            claim link to set up your account.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/"
              hash="pricing"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              View membership plans
            </Link>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Already a member? Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
