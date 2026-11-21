import { useEffect, useMemo, useRef, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, Loader2, Sparkles } from "lucide-react";
import { ArtistGiftCelebration } from "@/components/store/artist-gift-celebration";
import { Button } from "@/components/ui/button";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCartCheckoutSession } from "@/lib/cart.functions";
import type { LicenseTier } from "@/lib/licensing";
import { getPurchaseAttribution } from "@/lib/purchase-attribution";

export interface InlineCheckoutItem {
  beatId: string;
  tier: LicenseTier;
}
export interface CheckoutDownload {
  title: string;
  label: string;
  url: string;
}

export function InlineCheckout({
  items,
  onComplete,
  initialCode,
  buyerEmail,
}: {
  items: InlineCheckoutItem[];
  onComplete?: (downloads?: CheckoutDownload[]) => void;
  initialCode?: string;
  buyerEmail?: string;
}) {
  const checkoutRef = useRef<HTMLDivElement>(null);
  const create = useServerFn(createCartCheckoutSession);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [codeInput, setCodeInput] = useState(initialCode ?? "");
  const [code, setCode] = useState(initialCode ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [free, setFree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(buyerEmail ?? "");
  const [downloads, setDownloads] = useState<CheckoutDownload[]>([]);
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);
  const signature = items.map((i) => `${i.beatId}:${i.tier}`).join("|");
  // Stable across parent rerenders and while Stripe owns its payment form.
  const payload = useMemo(
    () =>
      signature
        .split("|")
        .filter(Boolean)
        .map((value) => {
          const [beatId, tier] = value.split(":");
          return { beatId: beatId ?? "", tier: tier as LicenseTier };
        }),
    [signature],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setClientSecret(null);
    setFree(false);
    setNote(null);
    async function open() {
      try {
        const data = {
          items: payload,
          environment: getStripeEnvironment(),
          ...(code ? { discountCode: code } : {}),
          ...(buyerEmail ? { email: buyerEmail } : {}),
          returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          attribution: getPurchaseAttribution(),
        };
        if (code) {
          const recoveryKey = `mbc-free-recovery:${data.environment}:${signature}:${code}`;
          const recovery = sessionStorage.getItem(recoveryKey);
          if (recovery) {
            const saved = JSON.parse(recovery) as {
              requestId: string;
              name: string;
              email: string;
            };
            const resumed = await create({ data: { ...data, action: "claim", ...saved } });
            if (!active) return;
            setName(saved.name);
            setEmail(saved.email);
            setFree(true);
            if (resumed.error) {
              setError(resumed.error);
              return;
            }
            setDownloads(resumed.downloads ?? []);
            setPending(!!resumed.deliveryPending);
            setDone(true);
            return;
          }
          const quote = await create({ data: { ...data, action: "quote" } });
          if (!active) return;
          if (quote.error) {
            setError(quote.error);
            return;
          }
          setNote(quote.discountNote ?? null);
          setOriginalTotal(quote.originalTotalCents ?? 0);
          if (quote.freeOrder) {
            setFree(true);
            return;
          }
        }
        const result = await create({ data });
        if (!active) return;
        if (result.error) setError(result.error);
        else if (result.freeOrder) setFree(true);
        else setClientSecret(result.clientSecret);
        setNote(result.discountNote ?? null);
      } catch {
        if (active) setError("Couldn't open checkout. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void open();
    return () => {
      active = false;
    };
  }, [create, payload, code, buyerEmail, reload, signature]);

  useEffect(() => {
    if (!free || loading || done) return;
    const frame = requestAnimationFrame(() =>
      checkoutRef.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [free, loading, done]);

  const options = useMemo(
    () => ({
      clientSecret: clientSecret ?? "",
      onComplete: () => {
        setDone(true);
        onComplete?.();
      },
    }),
    [clientSecret, onComplete],
  );

  async function claim() {
    setClaiming(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const key = `mbc-free-claim:${getStripeEnvironment()}:${signature}:${code}:${normalizedEmail}:${name.trim()}`;
      let requestId = sessionStorage.getItem(key);
      if (!requestId) {
        requestId = crypto.randomUUID();
        sessionStorage.setItem(key, requestId);
      }
      sessionStorage.setItem(
        `mbc-free-recovery:${getStripeEnvironment()}:${signature}:${code}`,
        JSON.stringify({ requestId, name: name.trim(), email: normalizedEmail }),
      );
      const result = await create({
        data: {
          action: "claim",
          requestId,
          items: payload,
          name: name.trim(),
          email: normalizedEmail,
          environment: getStripeEnvironment(),
          discountCode: code,
          returnUrl: window.location.href,
          attribution: getPurchaseAttribution(),
        },
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDownloads(result.downloads ?? []);
      setPending(!!result.deliveryPending);
      setDone(true);
      if (!result.deliveryPending) onComplete?.(result.downloads ?? []);
    } catch {
      setError(
        "Couldn't finish your claim. Retry with the same details — you won't receive a duplicate order.",
      );
    } finally {
      setClaiming(false);
    }
  }

  if (done)
    return (
      <div className="space-y-3">
        {free ? (
          <ArtistGiftCelebration complete originalCents={originalTotal} />
        ) : (
          <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
        )}
        {!free && <h3 className="text-center font-semibold">Payment complete</h3>}
        {downloads.map((download) => (
          <div key={download.url} className="border-b border-border pb-3">
            <p className="text-sm font-semibold">{download.title}</p>
            <p className="mb-2 text-xs text-muted-foreground">{download.label}</p>
            <Button asChild className="w-full">
              <a href={download.url} target="_blank" rel="noopener noreferrer">
                <Download /> Download beat &amp; license
              </a>
            </Button>
          </div>
        ))}
        <p className="text-center text-sm text-muted-foreground">
          {pending
            ? "Your claim is saved. Email delivery still needs another attempt; any available downloads are above."
            : "Your files and personalized agreement are ready. We've requested an email copy, too."}
        </p>
        {pending && (
          <Button
            className="w-full"
            variant="outline"
            disabled={claiming}
            onClick={() => void claim()}
          >
            {claiming ? <Loader2 className="animate-spin" /> : null} Retry delivery
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );

  return (
    <div ref={checkoutRef} className={free ? "space-y-2 scroll-mt-2" : "space-y-3"}>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = codeInput.trim().toUpperCase();
          setCode(next);
          if (next === code) setReload((v) => v + 1);
        }}
      >
        <input
          value={codeInput}
          onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
          placeholder="Discount code"
          aria-label="Discount code"
          disabled={claiming}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" variant="outline" disabled={!codeInput.trim() || claiming}>
          Apply
        </Button>
        {code && (
          <Button
            type="button"
            variant="ghost"
            disabled={claiming}
            onClick={() => {
              setCode("");
              setCodeInput("");
            }}
          >
            Remove
          </Button>
        )}
      </form>
      {loading ? (
        <div
          className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your order…
        </div>
      ) : null}
      {free && !loading ? (
        <>
          <ArtistGiftCelebration key={code} originalCents={originalTotal} />
          <p className="text-center text-xs text-muted-foreground">
            Your beat and personalized license paperwork are included.
          </p>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void claim();
            }}
          >
            <label className="block text-xs font-medium">
              Your name
              <input
                required
                maxLength={120}
                autoComplete="name"
                value={name}
                disabled={claiming}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              />
            </label>
            <label className="block text-xs font-medium">
              Email for your files &amp; license
              <input
                required
                type="email"
                maxLength={255}
                autoComplete="email"
                value={email}
                disabled={claiming}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              />
            </label>
            <Button type="submit" className="min-h-11 w-full" disabled={claiming}>
              {claiming ? <Loader2 className="animate-spin" /> : <Sparkles />}{" "}
              {claiming ? "Unlocking your music…" : "Claim my beat & license"}
            </Button>
          </form>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </>
      ) : null}
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
          <p className="font-semibold text-destructive">{error}</p>
          {!free && (
            <Button className="mt-2" variant="outline" onClick={() => setReload((v) => v + 1)}>
              Try again
            </Button>
          )}
        </div>
      )}
      {!loading && !free && clientSecret && (
        <>
          <p className="text-xs text-primary">{note}</p>
          <EmbeddedCheckoutProvider key={clientSecret} stripe={getStripe()} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </>
      )}
    </div>
  );
}
