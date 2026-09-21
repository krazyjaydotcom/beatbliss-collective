import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/components/store/cart-provider";
import { createCartCheckoutSession } from "@/lib/cart.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { formatPrice } from "@/components/store/player-provider";
import { TIER_META } from "@/lib/licensing";
import { CoverArt } from "@/components/store/cover-art";

export function CartButton() {
  const { count, open } = useCart();
  return (
    <button
      type="button"
      onClick={open}
      aria-label={count ? `Cart, ${count} license${count === 1 ? "" : "s"}` : "Cart, empty"}
      className="relative inline-flex h-10 items-center gap-2 rounded-full border border-white/12 px-3 text-xs font-medium text-foreground hover:border-primary/60 hover:text-primary sm:px-4"
    >
      <ShoppingBag className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 ? (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function CartSheet() {
  const cart = useCart();
  const checkout = useServerFn(createCartCheckoutSession);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cart.isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let environment: "sandbox" | "live";
      try {
        environment = getStripeEnvironment();
      } catch {
        throw new Error("Payments are not configured. Please try again later or contact support.");
      }
      const origin = window.location.origin;
      const r = await checkout({
        data: {
          items: cart.items.map((i) => ({ beatId: i.beatId, tier: i.tier })),
          email,
          environment,
          successUrl: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: origin,
        },
      });
      if (r.error) throw new Error(r.error);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      throw new Error("Checkout is unavailable right now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={cart.close}
        className="absolute inset-0 bg-black/70"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className="relative flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-card"
        onKeyDown={(e) => {
          if (e.key === "Escape") cart.close();
        }}
      >
        <header className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Your cart</h2>
          <button
            type="button"
            onClick={cart.close}
            aria-label="Close cart"
            autoFocus
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {cart.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your cart is empty. Open any beat and add a license to buy several at once.
            </p>
          ) : (
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <li
                  key={`${item.beatId}-${item.tier}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.08] p-3"
                >
                  <CoverArt
                    src={item.coverUrl}
                    title={item.title}
                    seed={item.beatId}
                    className="h-12 w-12 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {TIER_META[item.tier].label} · {item.producerName}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPrice(item.priceCents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => cart.remove(item.beatId, item.tier)}
                    aria-label={`Remove ${item.title}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.items.length > 0 ? (
          <form
            onSubmit={submit}
            className="shrink-0 space-y-3 border-t border-white/[0.08] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                {cart.count} license{cart.count === 1 ? "" : "s"}
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatPrice(cart.totalCents)}
              </span>
            </div>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email for your licenses and files"
              className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Opening checkout…" : "Checkout"}
              {loading ? null : <ArrowRight className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={cart.clear}
              className="w-full text-center text-xs text-muted-foreground underline underline-offset-4"
            >
              Empty cart
            </button>
          </form>
        ) : null}
      </aside>
    </div>
  );
}
