import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Mail } from "lucide-react";
import { requestMyLicenses } from "@/lib/licenses.functions";

const TITLE = "Get your beat licenses — MYBEATCATALOG";
const DESC = "Bought a beat license? Enter your email and we'll send copies of all your MYBEATCATALOG license agreements.";

export const Route = createFileRoute("/licenses")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LicensesPage,
});

function LicensesPage() {
  const request = useServerFn(requestMyLicenses);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      await request({ data: { email, website } });
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <FileText className="h-8 w-8 text-primary" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">Get your licenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the email you used at checkout. We'll email you every license agreement you've purchased.
        </p>
        {state === "sent" ? (
          <p className="mt-5 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
            If that email has purchases, your licenses are on their way. Check your inbox (and spam) in a few minutes.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="hidden"
              aria-hidden
            />
            <label className="block text-sm font-medium text-foreground" htmlFor="lic-email">Email</label>
            <input
              id="lic-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Mail className="h-4 w-4" /> {state === "sending" ? "Sending…" : "Email my licenses"}
            </button>
            {state === "error" ? <p className="text-sm text-destructive">Something went wrong. Please try again.</p> : null}
          </form>
        )}
        <Link to="/" className="mt-5 inline-block text-xs text-muted-foreground underline">Back to the catalog</Link>
      </div>
    </div>
  );
}
