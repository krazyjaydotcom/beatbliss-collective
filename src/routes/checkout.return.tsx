import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {session_id ? (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <h1 className="mt-6 text-3xl font-bold">You're in!</h1>
            <p className="mt-2 text-muted-foreground">
              Your subscription is active. Head to your account to start downloading beats.
            </p>
            <Button variant="hero" size="lg" className="mt-8" asChild>
              <Link to="/account">Go to my account</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">No payment found</h1>
            <p className="mt-2 text-muted-foreground">We didn't find a checkout session.</p>
            <Button variant="hero" size="lg" className="mt-8" asChild>
              <Link to="/">Back to home</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
