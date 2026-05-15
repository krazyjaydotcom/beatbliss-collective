import { createFileRoute, Link } from "@tanstack/react-router";
import { KrazyLogo } from "@/components/krazy-logo";

export const Route = createFileRoute("/signup")({
  component: SignupClosed,
});

function SignupClosed() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 block text-center text-2xl font-black tracking-tight">
          <KrazyLogo className="text-2xl" />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-xs font-bold tracking-wider text-primary">INVITE-ONLY</p>
          <h1 className="mt-2 text-2xl font-bold">Private membership access</h1>
          <p className="mt-3 text-muted-foreground">
            Public signup stays closed. If you were invited directly, open your claim link from email to create your
            account. If you join through checkout, we send the same one-time claim link after payment.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/"
              hash="membership"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              View membership details
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
